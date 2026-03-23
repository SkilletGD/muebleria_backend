const express = require('express');
const {
    asignarRepartidor,
    actualizarEstadoEnvio,
    getEventosEnvio,
    getMapaPedido
} = require('../controllers/envioController');
const { protect } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

// Admin
router.put('/:id/asignar', roleMiddleware('admin'), asignarRepartidor);

// Repartidor
router.put('/:id/estado', roleMiddleware('admin', 'repartidor'), actualizarEstadoEnvio);

// Cliente, Admin, Repartidor (todos pueden ver el mapa)
router.get('/:id/mapa', getMapaPedido);           // 👈 NUEVA RUTA
router.get('/:id/eventos', getEventosEnvio);

module.exports = router;