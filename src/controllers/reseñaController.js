const { pool } = require('../config/database');

// Crear reseña (solo si compró el producto)
const createReseña = async (req, res) => {
    try {
        const { variante_id, calificacion, comentario } = req.body;
        const usuario_id = req.user.id;

        // Verificar que el usuario haya comprado esta variante
        const [compras] = await pool.query(
            `SELECT DISTINCT dp.pedido_id 
             FROM detalle_pedido dp
             JOIN pedidos p ON dp.pedido_id = p.id
             WHERE dp.variante_id = ? AND p.usuario_id = ? AND p.estado_pedido = 'entregado'`,
            [variante_id, usuario_id]
        );

        if (compras.length === 0) {
            return res.status(403).json({ message: 'Debes comprar este producto para calificarlo' });
        }

        // Insertar reseña
        const [result] = await pool.query(
            `INSERT INTO reseñas (usuario_id, variante_id, pedido_id, calificacion, comentario) 
             VALUES (?, ?, ?, ?, ?)`,
            [usuario_id, variante_id, compras[0].pedido_id, calificacion, comentario]
        );

        res.status(201).json({
            message: 'Reseña creada exitosamente',
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Obtener reseñas de un producto
const getReseñasByProducto = async (req, res) => {
    try {
        const { producto_id } = req.params;

        const [reseñas] = await pool.query(
            `SELECT r.*, u.nombre as usuario_nombre
             FROM reseñas r
             JOIN usuarios u ON r.usuario_id = u.id
             WHERE r.variante_id IN (SELECT id FROM variantes WHERE producto_id = ?)
             ORDER BY r.fecha DESC`,
            [producto_id]
        );

        const [promedio] = await pool.query(
            `SELECT AVG(calificacion) as promedio, COUNT(*) as total
             FROM reseñas
             WHERE variante_id IN (SELECT id FROM variantes WHERE producto_id = ?)`,
            [producto_id]
        );

        res.json({
            reseñas,
            promedio: promedio[0].promedio || 0,
            total: promedio[0].total || 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

module.exports = {
    createReseña,
    getReseñasByProducto
};