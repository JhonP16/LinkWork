const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Apply to a job directly from the Discover swipe.
 * Creates a search (if needed), a match record, and an application record.
 */
const applyToJob = async (req, res) => {
  const userId = req.user.id;
  const { job_id, score, breakdown, matched_skills, missing_skills } = req.body;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id es requerido' });
  }

  // Check if already applied
  const existingApp = await query(
    'SELECT id FROM applications WHERE user_id = $1 AND job_id = $2',
    [userId, job_id]
  );
  if (existingApp.rows.length) {
    return res.json({ message: 'Ya aplicaste a esta vacante', already_applied: true });
  }

  // Find or create a "swipe" search for today
  let searchId;
  const todaySearch = await query(
    `SELECT id FROM searches 
     WHERE user_id = $1 AND keywords = 'swipe_discover' 
     AND triggered_at::date = CURRENT_DATE
     ORDER BY triggered_at DESC LIMIT 1`,
    [userId]
  );

  if (todaySearch.rows.length) {
    searchId = todaySearch.rows[0].id;
  } else {
    const newSearch = await query(
      `INSERT INTO searches (user_id, keywords, status, jobs_found, jobs_scored, completed_at)
       VALUES ($1, 'swipe_discover', 'completed', 0, 0, NOW())
       RETURNING id`,
      [userId]
    );
    searchId = newSearch.rows[0].id;
  }

  // Create the match record
  const bd = breakdown || {};
  const matchResult = await query(
    `INSERT INTO matches (search_id, user_id, job_id, total_score,
      skills_score, experience_score, location_score, salary_score,
      education_score, modality_score, semantic_score,
      score_explanation, matched_skills, missing_skills,
      rank_position, status, action_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, 1, 'applied', NOW())
     ON CONFLICT (search_id, job_id) DO UPDATE SET status = 'applied', action_at = NOW()
     RETURNING id, total_score`,
    [
      searchId, userId, job_id,
      score || 0,
      bd.skills_score || 0,
      bd.experience_score || 0,
      bd.location_score || 0,
      bd.salary_score || 0,
      bd.education_score || 0,
      bd.modality_score || 0,
      bd.semantic_score || 0,
      JSON.stringify(bd),
      matched_skills || [],
      missing_skills || [],
    ]
  );

  const match = matchResult.rows[0];

  // Create application record
  await query(
    `INSERT INTO applications (user_id, job_id, match_id, score_at_application)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, job_id) DO NOTHING`,
    [userId, job_id, match.id, match.total_score]
  );

  // Update search counters
  await query(
    `UPDATE searches SET jobs_found = jobs_found + 1, jobs_scored = jobs_scored + 1 WHERE id = $1`,
    [searchId]
  );

  logger.info('Swipe apply', { userId, jobId: job_id, score: score || 0 });

  res.json({ success: true, match_id: match.id });
};


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

  // Get ALL applied matches across all searches for this user
  const matchesResult = await query(
    `SELECT m.id, m.total_score, m.skills_score, m.experience_score, m.location_score,
            m.salary_score, m.education_score, m.modality_score, m.semantic_score,
            m.score_explanation, m.matched_skills, m.missing_skills, m.rank_position,
            m.status AS match_status, m.action_at,
            j.id AS job_id, j.title, j.company_name, j.company_logo_url, j.city,
            j.work_modality, j.salary_min, j.salary_max, j.salary_disclosed,
            j.contract_type, j.required_experience_years, j.category, j.description,
            j.benefits, j.external_url, j.tags, j.posted_at
     FROM matches m JOIN jobs j ON j.id = m.job_id
     WHERE m.user_id = $1 AND m.status = 'applied'
     ORDER BY m.action_at DESC NULLS LAST, m.total_score DESC`,
    [userId]
  );

  res.json({
    matches: matchesResult.rows,
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

module.exports = { applyToJob, updateMatchStatus, getTodayMatches, getApplications };
