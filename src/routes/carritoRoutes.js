const express = require('express');
const {
    getCarrito,
    addToCarrito,
    updateCarritoItem,
    removeFromCarrito,
    clearCarrito
} = require('../controllers/carritoController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getCarrito);
router.post('/', addToCarrito);
router.put('/:id', updateCarritoItem);
router.delete('/:id', removeFromCarrito);
router.delete('/', clearCarrito);

module.exports = router;