const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'empleabilidad',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => logger.info('DB: Nueva conexión establecida'));
pool.on('error', (err) => logger.error('DB: Error en pool', { error: err.message }));

const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 200) {
      logger.warn('DB: Query lenta detectada', { duration, query: text.substring(0, 80) });
    }
    return result;
  } catch (err) {
    logger.error('DB: Error en query', { error: err.message, query: text.substring(0, 80) });
    throw err;
  }
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
