const { pool } = require('../config/database');

// Obtener todos los cupones (admin)
const getCupones = async (req, res) => {
    try {
        const [cupones] = await pool.query('SELECT * FROM cupones ORDER BY created_at DESC');
        res.json(cupones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Crear cupón (admin)
const createCupon = async (req, res) => {
    try {
        const { codigo, descuento_tipo, descuento_valor, minimo_compra, fecha_inicio, fecha_fin, uso_por_usuario } = req.body;

        const [result] = await pool.query(
            `INSERT INTO cupones (codigo, descuento_tipo, descuento_valor, minimo_compra, fecha_inicio, fecha_fin, uso_por_usuario) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [codigo, descuento_tipo, descuento_valor, minimo_compra || 0, fecha_inicio, fecha_fin, uso_por_usuario || 1]
        );

        res.status(201).json({
            message: 'Cupón creado exitosamente',
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Validar cupón
const validarCupon = async (req, res) => {
    try {
        const { codigo, total } = req.body;
        const usuario_id = req.user.id;

        const [cupones] = await pool.query(
            `SELECT * FROM cupones 
             WHERE codigo = ? AND activo = true 
             AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()
             AND (minimo_compra = 0 OR minimo_compra <= ?)`,
            [codigo, total]
        );

        if (cupones.length === 0) {
            return res.status(404).json({ message: 'Cupón inválido o expirado' });
        }

        const cupon = cupones[0];

        // Verificar uso por usuario
        const [usos] = await pool.query(
            'SELECT COUNT(*) as count FROM cupones_usados WHERE cupon_id = ? AND usuario_id = ?',
            [cupon.id, usuario_id]
        );

        if (usos[0].count >= cupon.uso_por_usuario) {
            return res.status(400).json({ message: 'Ya has usado este cupón el máximo de veces' });
        }

        let descuento = 0;
        if (cupon.descuento_tipo === 'porcentaje') {
            descuento = total * (cupon.descuento_valor / 100);
        } else {
            descuento = cupon.descuento_valor;
        }

        res.json({
            valido: true,
            cupon,
            descuento,
            total_con_descuento: total - descuento
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

module.exports = {
    getCupones,
    createCupon,
    validarCupon
};