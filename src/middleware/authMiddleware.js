const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const [users] = await pool.query(
                'SELECT id, nombre, email, rol FROM usuarios WHERE id = ? AND activo = true',
                [decoded.id]
            );

            if (users.length === 0) {
                return res.status(401).json({ message: 'Usuario no encontrado' });
            }

            req.user = users[0];
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Token inválido' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'No autorizado' });
    }
};

module.exports = { protect };