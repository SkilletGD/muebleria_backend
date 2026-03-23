const express = require('express');
const {
    getNotificaciones,
    marcarLeida,
    marcarTodasLeidas
} = require('../controllers/notificacionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getNotificaciones);
router.put('/:id/leer', marcarLeida);
router.put('/leer-todas', marcarTodasLeidas);

module.exports = router;