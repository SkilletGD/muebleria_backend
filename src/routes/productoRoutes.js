const express = require('express');
const {
    getProductos,
    getProductoById,
    createProducto,
    updateProducto,
    deleteProducto,
    createVariante
} = require('../controllers/productoController');
const { protect } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

// Rutas públicas
router.get('/', getProductos);
router.get('/:id', getProductoById);

// Rutas protegidas (solo admin)
router.post('/', protect, roleMiddleware('admin'), createProducto);
router.put('/:id', protect, roleMiddleware('admin'), updateProducto);
router.delete('/:id', protect, roleMiddleware('admin'), deleteProducto);
router.post('/variantes', protect, roleMiddleware('admin'), createVariante);

module.exports = router;