const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const register = async (req, res) => {
  const { email, password, full_name, document_type, document_number, phone } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, contraseña y nombre completo son requeridos' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'El email ya está registrado' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, document_type, document_number, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, full_name, role, created_at`,
    [email, password_hash, full_name, document_type || 'CC', document_number, phone]
  );

  const user = result.rows[0];

  // Crear perfil vacío
  await query('INSERT INTO profiles (user_id) VALUES ($1)', [user.id]);

  const token = generateToken(user.id);

  // Audit log
  await query(
    `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, message, service)
     VALUES ($1, 'user', $2, 'REGISTER', 'Usuario registrado', 'backend')`,
    [user.id, user.id]
  );

  logger.info('User registered', { userId: user.id, email: user.email });

  res.status(201).json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const result = await query(
    'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1',
    [email]
  );

  if (!result.rows.length) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const user = result.rows[0];

  if (!user.is_active) {
    return res.status(401).json({ error: 'Cuenta inactiva' });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  // Actualizar last_login
  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  const token = generateToken(user.id);

  logger.info('User login', { userId: user.id });

  res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
  });
};

const me = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { register, login, me };
