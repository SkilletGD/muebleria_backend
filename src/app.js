const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const productoRoutes = require('./routes/productoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const envioRoutes = require('./routes/envioRoutes');
const carritoRoutes = require('./routes/carritoRoutes');
const cuponRoutes = require('./routes/cuponRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');
const reseñaRoutes = require('./routes/reseñaRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/envios', envioRoutes);
app.use('/api/carrito', carritoRoutes);
app.use('/api/cupones', cuponRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/reseñas', reseñaRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ message: 'API de Mueblería funcionando' });
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejo de errores general
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;