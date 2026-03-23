const express = require('express');
const {
    createReseña,
    getReseñasByProducto
} = require('../controllers/reseñaController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Pública: ver reseñas de un producto
router.get('/producto/:producto_id', getReseñasByProducto);

// Protegida: crear reseña
router.post('/', protect, createReseña);

module.exports = router;