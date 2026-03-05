const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Actualiza el estado de un match (viewed/saved/applied/discarded)
 */
const updateMatchStatus = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { status, notes } = req.body;

  const validStatuses = ['viewed', 'saved', 'applied', 'discarded'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Estado inválido. Válidos: ${validStatuses.join(', ')}` });
  }

  const result = await query(
    `UPDATE matches SET status = $1, notes = COALESCE($2, notes),
     action_at = NOW(), viewed_at = CASE WHEN $1 = 'viewed' AND viewed_at IS NULL THEN NOW() ELSE viewed_at END
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [status, notes, id, userId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Match no encontrado' });
  }

  // Si aplica, crear registro de aplicación
  if (status === 'applied') {
    const match = result.rows[0];
    await query(
      `INSERT INTO applications (user_id, job_id, match_id, score_at_application)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, job_id) DO NOTHING`,
      [userId, match.job_id, id, match.total_score]
    );
    logger.info('Application created', { userId, jobId: match.job_id });
  }

  res.json({ match: result.rows[0] });
};

/**
 * Obtiene todos los matches del usuario (todas las búsquedas recientes)
 */
const getTodayMatches = async (req, res) => {
  const userId = req.user.id;

  // Búsqueda más reciente completada
  const searchResult = await query(
    `SELECT id FROM searches WHERE user_id = $1 AND status = 'completed'
     ORDER BY completed_at DESC LIMIT 1`,
    [userId]
  );

  if (!searchResult.rows.length) {
    return res.json({ matches: [], message: 'No hay búsquedas completadas aún' });
  }

  const searchId = searchResult.rows[0].id;

  const matchesResult = await query(
    `SELECT m.id, m.total_score, m.skills_score, m.experience_score, m.location_score,
            m.salary_score, m.education_score, m.modality_score, m.semantic_score,
            m.score_explanation, m.matched_skills, m.missing_skills, m.rank_position,
            m.status AS match_status,
            j.id AS job_id, j.title, j.company_name, j.company_logo_url, j.city,
            j.work_modality, j.salary_min, j.salary_max, j.salary_disclosed,
            j.contract_type, j.required_experience_years, j.category, j.description,
            j.benefits, j.external_url, j.tags, j.posted_at
     FROM matches m JOIN jobs j ON j.id = m.job_id
     WHERE m.search_id = $1 AND m.status != 'discarded'
     ORDER BY m.rank_position ASC`,
    [searchId]
  );

  res.json({
    matches: matchesResult.rows,
    search_id: searchId,
    total: matchesResult.rows.length
  });
};

/**
 * Obtiene las postulaciones del usuario
 */
const getApplications = async (req, res) => {
  const userId = req.user.id;

  const result = await query(
    `SELECT a.*, j.title, j.company_name, j.company_logo_url, j.city, j.work_modality
     FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE a.user_id = $1 ORDER BY a.submitted_at DESC`,
    [userId]
  );

  res.json({ applications: result.rows });
};

module.exports = { updateMatchStatus, getTodayMatches, getApplications };
