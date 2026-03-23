const { pool } = require('../config/database');

// Asignar repartidor a un envío (admin)
const asignarRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        const { repartidor_id } = req.body;

        const [result] = await pool.query(
            'UPDATE envios SET repartidor_id = ? WHERE pedido_id = ?',
            [repartidor_id, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Envío no encontrado' });
        }

        res.json({ message: 'Repartidor asignado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Actualizar estado del envío con ubicación (repartidor)
const actualizarEstadoEnvio = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const { id } = req.params;
        const { estado_envio, ubicacion_lat, ubicacion_lng, comentario, foto_url } = req.body;

        await connection.beginTransaction();

        // Obtener el envío
        const [envios] = await connection.query(
            'SELECT * FROM envios WHERE pedido_id = ?',
            [id]
        );

        if (envios.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Envío no encontrado' });
        }

        const envio = envios[0];

        // Actualizar estado del envío
        let updateQuery = 'UPDATE envios SET estado_envio = ?';
        const params = [estado_envio];

        if (ubicacion_lat && ubicacion_lng) {
            updateQuery += ', ultima_ubicacion_lat = ?, ultima_ubicacion_lng = ?';
            params.push(ubicacion_lat, ubicacion_lng);
        }

        if (estado_envio === 'recogido_muebleria') {
            updateQuery += ', fecha_salida = NOW()';
        }

        if (estado_envio === 'entregado') {
            updateQuery += ', fecha_entrega = NOW()';
        }

        updateQuery += ' WHERE id = ?';
        params.push(envio.id);

        await connection.query(updateQuery, params);

        // Registrar evento
        await connection.query(
            `INSERT INTO eventos_envio (envio_id, estado, ubicacion_lat, ubicacion_lng, comentario, foto_url) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [envio.id, estado_envio, ubicacion_lat, ubicacion_lng, comentario, foto_url]
        );

        // Si es entregado, actualizar estado del pedido
        if (estado_envio === 'entregado') {
            await connection.query(
                'UPDATE pedidos SET estado_pedido = "entregado" WHERE id = ?',
                [id]
            );
            
            // Crear notificación
            const [pedidos] = await connection.query(
                'SELECT usuario_id FROM pedidos WHERE id = ?',
                [id]
            );
            
            if (pedidos.length > 0) {
                await connection.query(
                    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo) 
                     VALUES (?, ?, ?, 'envio')`,
                    [pedidos[0].usuario_id, '¡Pedido entregado!', 'Tu pedido ha sido entregado exitosamente']
                );
            }
        }

        await connection.commit();

        res.json({ message: 'Estado de envío actualizado' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    } finally {
        connection.release();
    }
};

// Obtener historial de eventos de un envío
const getEventosEnvio = async (req, res) => {
    try {
        const { id } = req.params;

        const [eventos] = await pool.query(
            `SELECT * FROM eventos_envio 
             WHERE envio_id = (SELECT id FROM envios WHERE pedido_id = ?)
             ORDER BY fecha_evento ASC`,
            [id]
        );

        res.json(eventos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Obtener URL del mapa para el cliente (usando Google Maps gratis)
const getMapaPedido = async (req, res) => {
    try {
        const { id } = req.params; // pedido_id
        
        // Obtener información del pedido, envío y dirección
        const [result] = await pool.query(
            `SELECT 
                p.id as pedido_id,
                p.estado_pedido,
                p.total,
                u.nombre as cliente_nombre,
                e.estado_envio,
                e.ultima_ubicacion_lat,
                e.ultima_ubicacion_lng,
                d.calle,
                d.numero,
                d.colonia,
                d.ciudad,
                d.estado,
                d.cp
             FROM pedidos p
             JOIN usuarios u ON p.usuario_id = u.id
             LEFT JOIN envios e ON p.id = e.pedido_id
             LEFT JOIN direcciones d ON p.direccion_envio_id = d.id
             WHERE p.id = ?`,
            [id]
        );
        
        if (result.length === 0) {
            return res.status(404).json({ message: 'Pedido no encontrado' });
        }
        
        const pedido = result[0];
        
        // Coordenadas de la mueblería (CÁMBIALAS por las coordenadas reales de tu local)
        const MUEBLERIA_LAT = 19.4326;
        const MUEBLERIA_LNG = -99.1332;
        
        // Ubicación actual (si no hay, usar la mueblería)
        let ubicacionLat = pedido.ultima_ubicacion_lat || MUEBLERIA_LAT;
        let ubicacionLng = pedido.ultima_ubicacion_lng || MUEBLERIA_LNG;
        
        // Construir dirección de entrega para URL
        const direccionTexto = `${pedido.calle || ''} ${pedido.numero || ''}, ${pedido.colonia || ''}, ${pedido.ciudad || ''}, ${pedido.estado || ''} ${pedido.cp || ''}`.trim();
        const direccionEncoded = encodeURIComponent(direccionTexto);
        
        // URLs de Google Maps (gratis, sin API key necesaria)
        const urls = {
            // Mapa con la ubicación actual del repartidor
            ubicacion_actual: `https://www.google.com/maps?q=${ubicacionLat},${ubicacionLng}`,
            
            // Mapa con la dirección de entrega
            direccion_entrega: direccionTexto ? `https://www.google.com/maps?q=${direccionEncoded}` : null,
            
            // Mapa para ver la ruta (opcional, necesita API key para mejor experiencia)
            ruta: (ubicacionLat && ubicacionLng && direccionTexto) ? 
                `https://www.google.com/maps/dir/?api=1&origin=${ubicacionLat},${ubicacionLng}&destination=${direccionEncoded}&travelmode=driving` : null,
            
            // Embed para iframe (para incrustar en la app)
            embed: `https://maps.google.com/maps?q=${ubicacionLat},${ubicacionLng}&z=15&output=embed`
        };
        
        // Información completa para el frontend
        res.json({
            pedido_id: pedido.pedido_id,
            estado_pedido: pedido.estado_pedido,
            estado_envio: pedido.estado_envio || 'pendiente',
            total: parseFloat(pedido.total),
            cliente: pedido.cliente_nombre,
            direccion_entrega: {
                calle: pedido.calle,
                numero: pedido.numero,
                colonia: pedido.colonia,
                ciudad: pedido.ciudad,
                estado: pedido.estado,
                cp: pedido.cp,
                texto_completo: direccionTexto || 'Dirección no registrada'
            },
            ubicacion_actual: {
                lat: ubicacionLat,
                lng: ubicacionLng,
                disponible: !!(pedido.ultima_ubicacion_lat && pedido.ultima_ubicacion_lng)
            },
            mapas: urls
        });
        
    } catch (error) {
        console.error('Error en getMapaPedido:', error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

module.exports = {
    asignarRepartidor,
    actualizarEstadoEnvio,
    getEventosEnvio,
    getMapaPedido 
};