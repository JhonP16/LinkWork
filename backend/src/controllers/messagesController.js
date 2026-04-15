const { query } = require('../config/database');
const logger = require('../utils/logger');

// ============================================================
// Buscar usuarios por nombre (para iniciar conversación)
// ============================================================
const searchUsers = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ users: [] });
  }

  const searchTerm = `%${q.trim()}%`;
  const result = await query(
    `SELECT u.id, u.full_name, u.email, u.role, p.city, p.current_position, p.photo_url
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id != $1
       AND u.is_active = TRUE
       AND (u.full_name ILIKE $2 OR u.email ILIKE $2)
     ORDER BY u.full_name
     LIMIT 20`,
    [req.user.id, searchTerm]
  );

  res.json({ users: result.rows });
};

// ============================================================
// Obtener conversaciones del usuario
// ============================================================
const getConversations = async (req, res) => {
  const userId = req.user.id;

  const result = await query(
    `SELECT
       c.id,
       c.last_message_text,
       c.last_message_at,
       c.created_at,
       CASE WHEN c.user_one = $1 THEN c.user_two ELSE c.user_one END AS other_user_id,
       u.full_name AS other_user_name,
       u.email AS other_user_email,
       u.role AS other_user_role,
       p.city AS other_user_city,
       p.current_position AS other_user_position,
       p.photo_url AS other_user_photo,
       (SELECT COUNT(*) FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id != $1
          AND m.is_read = FALSE) AS unread_count
     FROM conversations c
     JOIN users u ON u.id = CASE WHEN c.user_one = $1 THEN c.user_two ELSE c.user_one END
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE c.user_one = $1 OR c.user_two = $1
     ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`,
    [userId]
  );

  res.json({ conversations: result.rows });
};

// ============================================================
// Obtener mensajes de una conversación
// ============================================================
const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.id;

  // Verificar que el usuario pertenece a la conversación
  const conv = await query(
    'SELECT id FROM conversations WHERE id = $1 AND (user_one = $2 OR user_two = $2)',
    [conversationId, userId]
  );
  if (!conv.rows.length) {
    return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
  }

  const result = await query(
    `SELECT m.id, m.sender_id, m.content, m.is_read, m.created_at,
            u.full_name AS sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [conversationId]
  );

  res.json({ messages: result.rows });
};

// ============================================================
// Enviar mensaje (crea conversación si no existe)
// ============================================================
const sendMessage = async (req, res) => {
  const { recipient_id, content, conversation_id } = req.body;
  const senderId = req.user.id;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  }

  let convId = conversation_id;

  // Si no hay conversation_id, buscar o crear conversación
  if (!convId) {
    if (!recipient_id) {
      return res.status(400).json({ error: 'recipient_id o conversation_id requerido' });
    }

    // Canonical ordering: user_one < user_two
    const userOne = senderId < recipient_id ? senderId : recipient_id;
    const userTwo = senderId < recipient_id ? recipient_id : senderId;

    // Buscar conversación existente
    const existing = await query(
      'SELECT id FROM conversations WHERE user_one = $1 AND user_two = $2',
      [userOne, userTwo]
    );

    if (existing.rows.length) {
      convId = existing.rows[0].id;
    } else {
      // Crear nueva conversación
      const newConv = await query(
        'INSERT INTO conversations (user_one, user_two) VALUES ($1, $2) RETURNING id',
        [userOne, userTwo]
      );
      convId = newConv.rows[0].id;
    }
  }

  // Verificar acceso
  const conv = await query(
    'SELECT id FROM conversations WHERE id = $1 AND (user_one = $2 OR user_two = $2)',
    [convId, senderId]
  );
  if (!conv.rows.length) {
    return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
  }

  // Insertar mensaje
  const msg = await query(
    `INSERT INTO messages (conversation_id, sender_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, sender_id, content, is_read, created_at`,
    [convId, senderId, content.trim()]
  );

  // Actualizar última fecha y texto de la conversación
  await query(
    'UPDATE conversations SET last_message_text = $1, last_message_at = NOW() WHERE id = $2',
    [content.trim().substring(0, 200), convId]
  );

  const message = msg.rows[0];
  message.sender_name = req.user.full_name;

  res.status(201).json({ message, conversation_id: convId });
};

// ============================================================
// Marcar mensajes como leídos
// ============================================================
const markAsRead = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.id;

  // Verificar acceso
  const conv = await query(
    'SELECT id FROM conversations WHERE id = $1 AND (user_one = $2 OR user_two = $2)',
    [conversationId, userId]
  );
  if (!conv.rows.length) {
    return res.status(403).json({ error: 'No tienes acceso a esta conversación' });
  }

  await query(
    `UPDATE messages SET is_read = TRUE, read_at = NOW()
     WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE`,
    [conversationId, userId]
  );

  res.json({ success: true });
};

// ============================================================
// Contar mensajes no leídos totales
// ============================================================
const getUnreadCount = async (req, res) => {
  const userId = req.user.id;

  const result = await query(
    `SELECT COUNT(*) as count
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.user_one = $1 OR c.user_two = $1)
       AND m.sender_id != $1
       AND m.is_read = FALSE`,
    [userId]
  );

  res.json({ unread_count: parseInt(result.rows[0].count) });
};

module.exports = { searchUsers, getConversations, getMessages, sendMessage, markAsRead, getUnreadCount };
