const roleMiddleware = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado' });
        }

        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        next();
    };
};

module.exports = { roleMiddleware };