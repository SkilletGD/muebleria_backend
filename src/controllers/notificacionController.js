const { pool } = require('../config/database');

// Obtener notificaciones del usuario
const getNotificaciones = async (req, res) => {
    try {
        const { leido, limit = 50, offset = 0 } = req.query;

        let query = 'SELECT * FROM notificaciones WHERE usuario_id = ?';
        const params = [req.user.id];

        if (leido !== undefined) {
            query += ' AND leido = ?';
            params.push(leido === 'true');
        }

        query += ' ORDER BY fecha_envio DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [notificaciones] = await pool.query(query, params);

        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM notificaciones WHERE usuario_id = ? AND leido = false',
            [req.user.id]
        );

        res.json({
            notificaciones,
            no_leidas: countResult[0].total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Marcar notificación como leída
const marcarLeida = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            'UPDATE notificaciones SET leido = true WHERE id = ? AND usuario_id = ?',
            [id, req.user.id]
        );

        res.json({ message: 'Notificación marcada como leída' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Marcar todas como leídas
const marcarTodasLeidas = async (req, res) => {
    try {
        await pool.query(
            'UPDATE notificaciones SET leido = true WHERE usuario_id = ?',
            [req.user.id]
        );

        res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

module.exports = {
    getNotificaciones,
    marcarLeida,
    marcarTodasLeidas
};