const express = require('express');
const {
    getCupones,
    createCupon,
    validarCupon
} = require('../controllers/cuponController');
const { protect } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', roleMiddleware('admin'), getCupones);
router.post('/', roleMiddleware('admin'), createCupon);
router.post('/validar', validarCupon);

module.exports = router;