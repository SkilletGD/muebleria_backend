const { pool } = require('../config/database');

// Obtener todos los productos (con filtros)
const getProductos = async (req, res) => {
    try {
        const { categoria_id, activo, search, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT p.*, c.nombre as categoria_nombre 
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (categoria_id) {
            query += ' AND p.categoria_id = ?';
            params.push(categoria_id);
        }

        if (activo !== undefined) {
            query += ' AND p.activo = ?';
            params.push(activo === 'true');
        }

        if (search) {
            query += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [productos] = await pool.query(query, params);

        // Obtener variantes para cada producto
        for (let producto of productos) {
            const [variantes] = await pool.query(
                'SELECT * FROM variantes WHERE producto_id = ?',
                [producto.id]
            );
            producto.variantes = variantes;
        }

        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Obtener un producto por ID
const getProductoById = async (req, res) => {
    try {
        const { id } = req.params;

        const [productos] = await pool.query(
            `SELECT p.*, c.nombre as categoria_nombre 
             FROM productos p
             LEFT JOIN categorias c ON p.categoria_id = c.id
             WHERE p.id = ?`,
            [id]
        );

        if (productos.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        const producto = productos[0];

        // Obtener variantes
        const [variantes] = await pool.query(
            'SELECT * FROM variantes WHERE producto_id = ?',
            [id]
        );
        producto.variantes = variantes;

        // Obtener reseñas
        const [reseñas] = await pool.query(
            `SELECT r.*, u.nombre as usuario_nombre 
             FROM reseñas r
             JOIN usuarios u ON r.usuario_id = u.id
             WHERE r.variante_id IN (SELECT id FROM variantes WHERE producto_id = ?)
             ORDER BY r.fecha DESC
             LIMIT 10`,
            [id]
        );
        producto.reseñas = reseñas;

        res.json(producto);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Crear producto (solo admin)
const createProducto = async (req, res) => {
    try {
        const { nombre, descripcion, precio_base, categoria_id, imagen_url } = req.body;

        const [result] = await pool.query(
            `INSERT INTO productos (nombre, descripcion, precio_base, categoria_id, imagen_url) 
             VALUES (?, ?, ?, ?, ?)`,
            [nombre, descripcion, precio_base, categoria_id, imagen_url]
        );

        res.status(201).json({
            message: 'Producto creado exitosamente',
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Actualizar producto (solo admin)
const updateProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio_base, categoria_id, activo, imagen_url } = req.body;

        const [result] = await pool.query(
            `UPDATE productos 
             SET nombre = ?, descripcion = ?, precio_base = ?, categoria_id = ?, activo = ?, imagen_url = ?
             WHERE id = ?`,
            [nombre, descripcion, precio_base, categoria_id, activo, imagen_url, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto actualizado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Eliminar producto (solo admin)
const deleteProducto = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query('DELETE FROM productos WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Crear variante de producto (solo admin)
const createVariante = async (req, res) => {
    try {
        const { producto_id, color, sku, stock, precio_adicional, imagen_url } = req.body;

        const [result] = await pool.query(
            `INSERT INTO variantes (producto_id, color, sku, stock, precio_adicional, imagen_url) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [producto_id, color, sku, stock, precio_adicional || 0, imagen_url]
        );

        res.status(201).json({
            message: 'Variante creada exitosamente',
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

module.exports = {
    getProductos,
    getProductoById,
    createProducto,
    updateProducto,
    deleteProducto,
    createVariante
};