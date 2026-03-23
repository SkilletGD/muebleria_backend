const express = require('express');
const {
    createPedido,
    getMisPedidos,
    getAllPedidos,
    updatePedidoEstado,
    updatePagoEstado
} = require('../controllers/pedidoController');
const { protect } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect); // Todas las rutas requieren autenticación

router.post('/', createPedido);
router.get('/mis-pedidos', getMisPedidos);
router.get('/all', roleMiddleware('admin', 'repartidor'), getAllPedidos);
router.put('/:id/estado', roleMiddleware('admin'), updatePedidoEstado);
router.put('/:id/pago', roleMiddleware('admin'), updatePagoEstado);

module.exports = router;