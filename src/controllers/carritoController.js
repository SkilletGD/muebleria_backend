const { pool } = require('../config/database');

// Obtener carrito del usuario
const getCarrito = async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT ci.*, v.color, v.sku, v.precio_adicional, v.stock as stock_disponible,
                    p.id as producto_id, p.nombre as producto_nombre, p.precio_base, p.imagen_url
             FROM carrito_items ci
             JOIN variantes v ON ci.variante_id = v.id
             JOIN productos p ON v.producto_id = p.id
             WHERE ci.usuario_id = ?`,
            [req.user.id]
        );

        let total = 0;
        for (let item of items) {
            const precio = parseFloat(item.precio_base) + parseFloat(item.precio_adicional);
            item.precio_unitario = precio;
            total += precio * item.cantidad;
        }

        res.json({
            items,
            total,
            cantidad_items: items.reduce((sum, item) => sum + item.cantidad, 0)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Agregar item al carrito
const addToCarrito = async (req, res) => {
    try {
        const { variante_id, cantidad } = req.body;

        // Verificar stock
        const [variantes] = await pool.query(
            'SELECT stock FROM variantes WHERE id = ?',
            [variante_id]
        );

        if (variantes.length === 0) {
            return res.status(404).json({ message: 'Variante no encontrada' });
        }

        if (variantes[0].stock < cantidad) {
            return res.status(400).json({ message: 'Stock insuficiente' });
        }

        // Insertar o actualizar carrito
        await pool.query(
            `INSERT INTO carrito_items (usuario_id, variante_id, cantidad) 
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE cantidad = cantidad + ?`,
            [req.user.id, variante_id, cantidad, cantidad]
        );

        res.json({ message: 'Producto agregado al carrito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Actualizar cantidad de un item
const updateCarritoItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { cantidad } = req.body;

        if (cantidad <= 0) {
            await pool.query(
                'DELETE FROM carrito_items WHERE id = ? AND usuario_id = ?',
                [id, req.user.id]
            );
        } else {
            await pool.query(
                'UPDATE carrito_items SET cantidad = ? WHERE id = ? AND usuario_id = ?',
                [cantidad, id, req.user.id]
            );
        }

        res.json({ message: 'Carrito actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Eliminar item del carrito
const removeFromCarrito = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            'DELETE FROM carrito_items WHERE id = ? AND usuario_id = ?',
            [id, req.user.id]
        );

        res.json({ message: 'Producto eliminado del carrito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Vaciar carrito
const clearCarrito = async (req, res) => {
    try {
        await pool.query('DELETE FROM carrito_items WHERE usuario_id = ?', [req.user.id]);
        res.json({ message: 'Carrito vaciado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

module.exports = {
    getCarrito,
    addToCarrito,
    updateCarritoItem,
    removeFromCarrito,
    clearCarrito
};