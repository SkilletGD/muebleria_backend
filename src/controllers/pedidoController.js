const { pool } = require('../config/database');

// Crear pedido (descuenta stock automáticamente)
const createPedido = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { direccion_id, metodo_pago, items, cupon_codigo } = req.body;
        const usuario_id = req.user.id;

        // Verificar dirección
        const [direcciones] = await connection.query(
            'SELECT * FROM direcciones WHERE id = ? AND usuario_id = ?',
            [direccion_id, usuario_id]
        );
        if (direcciones.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Dirección no válida' });
        }

        let total = 0;
        const detalleItems = [];

        // Calcular total y verificar stock
        for (const item of items) {
            const [variantes] = await connection.query(
                'SELECT * FROM variantes WHERE id = ?',
                [item.variante_id]
            );
            
            if (variantes.length === 0) {
                await connection.rollback();
                return res.status(400).json({ message: `Variante ${item.variante_id} no existe` });
            }
            
            const variante = variantes[0];
            
            if (variante.stock < item.cantidad) {
                await connection.rollback();
                return res.status(400).json({ message: `Stock insuficiente para ${variante.color}` });
            }
            
            const [productos] = await connection.query(
                'SELECT precio_base FROM productos WHERE id = ?',
                [variante.producto_id]
            );
            
            const precio_unitario = parseFloat(productos[0].precio_base) + parseFloat(variante.precio_adicional);
            const subtotal = precio_unitario * item.cantidad;
            total += subtotal;
            
            detalleItems.push({
                variante_id: item.variante_id,
                cantidad: item.cantidad,
                precio_unitario,
                stock_actual: variante.stock
            });
        }

        // Aplicar cupón si existe
        let cupon_aplicado_id = null;
        if (cupon_codigo) {
            const [cupones] = await connection.query(
                `SELECT * FROM cupones 
                 WHERE codigo = ? AND activo = true 
                 AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()
                 AND (minimo_compra = 0 OR minimo_compra <= ?)`,
                [cupon_codigo, total]
            );
            
            if (cupones.length > 0) {
                const cupon = cupones[0];
                
                // Verificar uso por usuario
                const [usos] = await connection.query(
                    'SELECT COUNT(*) as count FROM cupones_usados WHERE cupon_id = ? AND usuario_id = ?',
                    [cupon.id, usuario_id]
                );
                
                if (usos[0].count < cupon.uso_por_usuario) {
                    cupon_aplicado_id = cupon.id;
                    if (cupon.descuento_tipo === 'porcentaje') {
                        total = total * (1 - cupon.descuento_valor / 100);
                    } else {
                        total = total - cupon.descuento_valor;
                    }
                    total = Math.max(total, 0);
                }
            }
        }

        // Crear pedido
        const [pedidoResult] = await connection.query(
            `INSERT INTO pedidos 
             (usuario_id, direccion_envio_id, total, metodo_pago, estado_pago, cupon_aplicado_id) 
             VALUES (?, ?, ?, ?, 'pendiente', ?)`,
            [usuario_id, direccion_id, total, metodo_pago, cupon_aplicado_id]
        );
        
        const pedido_id = pedidoResult.insertId;

        // Insertar detalle y descontar stock
        for (const item of detalleItems) {
            await connection.query(
                `INSERT INTO detalle_pedido (pedido_id, variante_id, cantidad, precio_unitario) 
                 VALUES (?, ?, ?, ?)`,
                [pedido_id, item.variante_id, item.cantidad, item.precio_unitario]
            );
            
            await connection.query(
                'UPDATE variantes SET stock = stock - ? WHERE id = ?',
                [item.cantidad, item.variante_id]
            );
        }

        // Limpiar carrito
        await connection.query('DELETE FROM carrito_items WHERE usuario_id = ?', [usuario_id]);

        // Registrar cupón usado
        if (cupon_aplicado_id) {
            await connection.query(
                'INSERT INTO cupones_usados (cupon_id, usuario_id, pedido_id) VALUES (?, ?, ?)',
                [cupon_aplicado_id, usuario_id, pedido_id]
            );
        }

        // Crear envío asociado
        await connection.query(
            `INSERT INTO envios (pedido_id, estado_envio) VALUES (?, 'etiqueta_creada')`,
            [pedido_id]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Pedido creado exitosamente',
            pedido_id,
            total
        });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    } finally {
        connection.release();
    }
};

// Obtener pedidos del usuario autenticado
const getMisPedidos = async (req, res) => {
    try {
        const { estado, limit = 50, offset = 0 } = req.query;
        const usuario_id = req.user.id;

        let query = `
            SELECT p.*, d.calle, d.numero, d.colonia, d.ciudad, d.estado as direccion_estado, d.cp,
                   e.estado_envio, e.ultima_ubicacion_lat, e.ultima_ubicacion_lng
            FROM pedidos p
            LEFT JOIN direcciones d ON p.direccion_envio_id = d.id
            LEFT JOIN envios e ON p.id = e.pedido_id
            WHERE p.usuario_id = ?
        `;
        const params = [usuario_id];

        if (estado) {
            query += ' AND p.estado_pedido = ?';
            params.push(estado);
        }

        query += ' ORDER BY p.fecha_pedido DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [pedidos] = await pool.query(query, params);

        // Obtener detalles de cada pedido
        for (let pedido of pedidos) {
            const [detalles] = await pool.query(
                `SELECT dp.*, v.color, v.sku, p.nombre as producto_nombre, p.imagen_url
                 FROM detalle_pedido dp
                 JOIN variantes v ON dp.variante_id = v.id
                 JOIN productos p ON v.producto_id = p.id
                 WHERE dp.pedido_id = ?`,
                [pedido.id]
            );
            pedido.detalles = detalles;

            // Obtener eventos de envío
            const [eventos] = await pool.query(
                `SELECT * FROM eventos_envio 
                 WHERE envio_id = (SELECT id FROM envios WHERE pedido_id = ?)
                 ORDER BY fecha_evento DESC`,
                [pedido.id]
            );
            pedido.eventos_envio = eventos;
        }

        res.json(pedidos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Obtener todos los pedidos (admin/repartidor)
const getAllPedidos = async (req, res) => {
    try {
        const { estado, repartidor_id, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT p.*, u.nombre as cliente_nombre, u.email as cliente_email,
                   d.calle, d.numero, d.colonia, d.ciudad, d.estado as direccion_estado, d.cp,
                   e.estado_envio, e.repartidor_id, e.ultima_ubicacion_lat, e.ultima_ubicacion_lng,
                   r.nombre as repartidor_nombre
            FROM pedidos p
            JOIN usuarios u ON p.usuario_id = u.id
            LEFT JOIN direcciones d ON p.direccion_envio_id = d.id
            LEFT JOIN envios e ON p.id = e.pedido_id
            LEFT JOIN usuarios r ON e.repartidor_id = r.id
            WHERE 1=1
        `;
        const params = [];

        if (estado) {
            query += ' AND p.estado_pedido = ?';
            params.push(estado);
        }

        if (repartidor_id) {
            query += ' AND e.repartidor_id = ?';
            params.push(repartidor_id);
        }

        // Si es repartidor, solo ver sus pedidos asignados
        if (req.user.rol === 'repartidor') {
            query += ' AND e.repartidor_id = ?';
            params.push(req.user.id);
        }

        query += ' ORDER BY p.fecha_pedido DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [pedidos] = await pool.query(query, params);

        res.json(pedidos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Actualizar estado del pedido
const updatePedidoEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado_pedido } = req.body;

        const [result] = await pool.query(
            'UPDATE pedidos SET estado_pedido = ? WHERE id = ?',
            [estado_pedido, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pedido no encontrado' });
        }

        res.json({ message: 'Estado del pedido actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Actualizar estado de pago
const updatePagoEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado_pago, comprobante_url } = req.body;

        await pool.query(
            'UPDATE pedidos SET estado_pago = ? WHERE id = ?',
            [estado_pago, id]
        );

        if (estado_pago === 'pagado_total') {
            await pool.query(
                'UPDATE pedidos SET estado_pedido = "pagado" WHERE id = ?',
                [id]
            );
        }

        res.json({ message: 'Estado de pago actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

module.exports = {
    createPedido,
    getMisPedidos,
    getAllPedidos,
    updatePedidoEstado,
    updatePagoEstado
};