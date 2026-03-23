const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(process.env.DB_SSL === 'true' && {
        ssl: {
            rejectUnauthorized: false
        }
    })
});

// Función para probar conexión
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión exitosa a la base de datos');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        return false;
    }
};

module.exports = { pool, testConnection };