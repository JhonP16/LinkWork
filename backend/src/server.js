require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const logger = require('./utils/logger');
const { pool } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas peticiones. Intenta en unos minutos.' }
}));

// Rate limit estricto para auth
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }));

// ============================================================
// ROUTES
// ============================================================
app.use('/api', routes);

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method 
  });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message
  });
});

// ============================================================
// START
// ============================================================
const waitForDB = async (retries = 15) => {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      logger.info('Conexión a PostgreSQL establecida');
      return true;
    } catch (err) {
      logger.warn(`Esperando PostgreSQL... intento ${i + 1}/${retries}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('No se pudo conectar a PostgreSQL');
};

waitForDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Backend corriendo en http://0.0.0.0:${PORT}`);
    logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  logger.error('Fallo al iniciar', { error: err.message });
  process.exit(1);
});

module.exports = app;
