const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');

const { authenticate } = require('../middleware/auth');
const { register, login, me } = require('../controllers/authController');
const { getProfile, updateProfile } = require('../controllers/profileController');
const { getJobs, getJobById } = require('../controllers/jobsController');
const { triggerSearch, getSearchStatus, getSearchHistory } = require('../controllers/searchController');
const { applyToJob, updateMatchStatus, getTodayMatches, getApplications } = require('../controllers/matchesController');
const { searchUsers, getConversations, getMessages, sendMessage, markAsRead, getUnreadCount } = require('../controllers/messagesController');
const { query } = require('../config/database');

// ============================================================
// AUTH
// ============================================================
router.post('/auth/register', asyncHandler(register));
router.post('/auth/login', asyncHandler(login));
router.get('/auth/me', authenticate, asyncHandler(me));

// ============================================================
// PROFILE
// ============================================================
router.get('/profile', authenticate, asyncHandler(getProfile));
router.put('/profile', authenticate, asyncHandler(updateProfile));

// ============================================================
// JOBS
// ============================================================
router.get('/jobs', asyncHandler(getJobs));
router.get('/jobs/:id', asyncHandler(getJobById));

// ============================================================
// SEARCH (workflow trigger)
// ============================================================
router.post('/search', authenticate, asyncHandler(triggerSearch));
router.get('/search/:id', authenticate, asyncHandler(getSearchStatus));
router.get('/searches', authenticate, asyncHandler(getSearchHistory));

// ============================================================
// MATCHES
// ============================================================
router.get('/matches/today', authenticate, asyncHandler(getTodayMatches));
router.post('/matches/apply', authenticate, asyncHandler(applyToJob));
router.patch('/matches/:id', authenticate, asyncHandler(updateMatchStatus));
router.get('/applications', authenticate, asyncHandler(getApplications));

// ============================================================
// MESSAGES
// ============================================================
router.get('/users/search', authenticate, asyncHandler(searchUsers));
router.get('/messages/conversations', authenticate, asyncHandler(getConversations));
router.get('/messages/unread-count', authenticate, asyncHandler(getUnreadCount));
router.get('/messages/:conversationId', authenticate, asyncHandler(getMessages));
router.post('/messages', authenticate, asyncHandler(sendMessage));
router.patch('/messages/:conversationId/read', authenticate, asyncHandler(markAsRead));

// ============================================================
// NOTIFICATIONS
// ============================================================
router.get('/notifications', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
    [req.user.id]
  );
  res.json({ notifications: result.rows });
}));

router.patch('/notifications/:id/read', authenticate, asyncHandler(async (req, res) => {
  await query(
    'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  res.json({ success: true });
}));

// ============================================================
// N8N CALLBACK (recibe resultados del workflow)
// ============================================================
router.post('/n8n/callback', asyncHandler(async (req, res) => {
  const { search_id, matches, status } = req.body;
  
  if (!search_id) return res.status(400).json({ error: 'search_id requerido' });

  if (status === 'completed' && matches?.length) {
    const search = await query('SELECT user_id FROM searches WHERE id = $1', [search_id]);
    if (!search.rows.length) return res.status(404).json({ error: 'Búsqueda no encontrada' });
    
    const userId = search.rows[0].user_id;

    for (const m of matches) {
      await query(
        `INSERT INTO matches (search_id, user_id, job_id, total_score, skills_score, experience_score,
          location_score, salary_score, education_score, modality_score, semantic_score,
          score_explanation, matched_skills, missing_skills, rank_position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (search_id, job_id) DO NOTHING`,
        [search_id, userId, m.job_id, m.total_score, m.skills_score, m.experience_score,
         m.location_score, m.salary_score, m.education_score, m.modality_score, m.semantic_score,
         JSON.stringify(m.explanation), m.matched_skills, m.missing_skills, m.rank_position]
      );
    }

    await query(
      `UPDATE searches SET status = 'completed', jobs_scored = $1, completed_at = NOW() WHERE id = $2`,
      [matches.length, search_id]
    );

    await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'matches_ready', '¡Tus matches están listos!', $2, $3)`,
      [userId, `Encontramos ${matches.length} vacantes compatibles con tu perfil hoy.`,
       JSON.stringify({ search_id, count: matches.length })]
    );
  } else if (status === 'failed') {
    await query("UPDATE searches SET status = 'failed' WHERE id = $1", [search_id]);
  }

  res.json({ success: true });
}));

// ============================================================
// HEALTH
// ============================================================
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'backend', version: '1.0.0', timestamp: new Date().toISOString() });
});

module.exports = router;
