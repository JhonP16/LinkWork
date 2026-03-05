const fetch = require('node-fetch');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://n8n:5678/webhook/employment-search';
const SCORING_URL = process.env.SCORING_URL || 'http://scoring:8001';

/**
 * Inicia una búsqueda de empleo.
 * Guarda la búsqueda y dispara el webhook de n8n.
 */
const triggerSearch = async (req, res) => {
  const userId = req.user.id;
  const { keywords, city, work_modality, min_salary, max_salary, contract_types, categories } = req.body;

  // Verificar perfil
  const profileResult = await query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
  if (!profileResult.rows.length) {
    return res.status(400).json({ error: 'Debes completar tu perfil antes de buscar empleo' });
  }

  const profile = profileResult.rows[0];

  if (profile.profile_completeness < 30) {
    return res.status(400).json({
      error: 'Tu perfil está muy incompleto',
      completeness: profile.profile_completeness,
      minimum_required: 30
    });
  }

  // Crear registro de búsqueda
  const searchResult = await query(
    `INSERT INTO searches (user_id, keywords, city, work_modality, min_salary, max_salary, contract_types, categories, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING *`,
    [userId, keywords, city, work_modality, min_salary, max_salary, contract_types, categories]
  );

  const search = searchResult.rows[0];

  // Trigger n8n webhook (asíncrono)
  triggerN8nWorkflow(search.id, userId, profile, req.body).catch(err => {
    logger.error('N8N trigger failed', { searchId: search.id, error: err.message });
  });

  logger.info('Search triggered', { searchId: search.id, userId });

  // Audit log
  await query(
    `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, message, service)
     VALUES ($1, 'search', $2, 'SEARCH_TRIGGERED', 'Búsqueda iniciada', 'backend')`,
    [userId, search.id]
  );

  res.status(202).json({
    message: 'Búsqueda iniciada. El ranking estará listo en breve.',
    search_id: search.id,
    status: 'pending',
    estimated_time_seconds: 10
  });
};

/**
 * Dispara el workflow de n8n con los datos de la búsqueda.
 */
async function triggerN8nWorkflow(searchId, userId, profile, searchCriteria) {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search_id: searchId,
        user_id: userId,
        profile: {
          user_id: userId,
          city: profile.city,
          available_to_relocate: profile.available_to_relocate,
          relocation_cities: profile.relocation_cities || [],
          work_modality: profile.work_modality || ['presencial'],
          desired_salary_min: profile.desired_salary_min,
          desired_salary_max: profile.desired_salary_max,
          education_level: profile.education_level,
          years_experience: profile.years_experience || 0,
          experience_sectors: profile.experience_sectors || [],
          technical_skills: profile.technical_skills || [],
          soft_skills: profile.soft_skills || [],
          languages: profile.languages || [],
          bio: profile.bio
        },
        criteria: searchCriteria
      }),
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`N8N responded with ${response.status}`);
    }

    logger.info('N8N workflow triggered', { searchId });
  } catch (err) {
    logger.warn('N8N unavailable, processing directly', { searchId, error: err.message });
    // Fallback: procesar directamente sin n8n
    await processSearchDirectly(searchId, userId, profile, searchCriteria);
  }
}

/**
 * Fallback: procesar sin n8n (directo al scoring service).
 */
async function processSearchDirectly(searchId, userId, profile, criteria) {
  try {
    // Actualizar estado
    await query("UPDATE searches SET status = 'processing' WHERE id = $1", [searchId]);

    // Obtener vacantes
    let conditions = ["status = 'active'"];
    let params = [];
    let idx = 1;

    if (criteria.city) { conditions.push(`city ILIKE $${idx++}`); params.push(`%${criteria.city}%`); }
    if (criteria.work_modality?.length) { conditions.push(`work_modality = ANY($${idx++})`); params.push(criteria.work_modality); }

    const jobsResult = await query(
      `SELECT * FROM jobs WHERE ${conditions.join(' AND ')} LIMIT 50`,
      params
    );

    const jobs = jobsResult.rows;

    if (!jobs.length) {
      await query("UPDATE searches SET status = 'completed', jobs_found = 0 WHERE id = $1", [searchId]);
      return;
    }

    await query(`UPDATE searches SET status = 'scoring', jobs_found = $1 WHERE id = $2`, [jobs.length, searchId]);

    // Llamar scoring service
    const scoringResponse = await fetch(`${SCORING_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          user_id: userId,
          ...profile,
          technical_skills: profile.technical_skills || [],
          languages: profile.languages || [],
          work_modality: profile.work_modality || ['presencial']
        },
        vacancies: jobs.map(j => ({
          id: j.id,
          title: j.title,
          company_name: j.company_name,
          city: j.city,
          work_modality: j.work_modality,
          contract_type: j.contract_type,
          required_education: j.required_education,
          required_experience_years: j.required_experience_years,
          required_skills: j.required_skills || [],
          preferred_skills: j.preferred_skills || [],
          salary_min: j.salary_min,
          salary_max: j.salary_max,
          description: j.description,
          category: j.category
        })),
        top_n: 20
      }),
      timeout: 30000
    });

    if (!scoringResponse.ok) throw new Error('Scoring failed');

    const scoringData = await scoringResponse.json();

    // Guardar matches
    for (const result of scoringData.results) {
      await query(
        `INSERT INTO matches (search_id, user_id, job_id, total_score, skills_score, experience_score,
          location_score, salary_score, education_score, modality_score, semantic_score,
          score_explanation, matched_skills, missing_skills, rank_position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (search_id, job_id) DO NOTHING`,
        [
          searchId, userId, result.job_id,
          result.total_score,
          result.breakdown.skills_score,
          result.breakdown.experience_score,
          result.breakdown.location_score,
          result.breakdown.salary_score,
          result.breakdown.education_score,
          result.breakdown.modality_score,
          result.breakdown.semantic_score,
          JSON.stringify(result.explanation),
          result.matched_skills,
          result.missing_skills,
          result.rank_position
        ]
      );
    }

    // Completar búsqueda
    await query(
      `UPDATE searches SET status = 'completed', jobs_scored = $1, completed_at = NOW() WHERE id = $2`,
      [scoringData.results.length, searchId]
    );

    // Notificación
    await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, 'matches_ready', 'Matches de hoy listos', $2, $3)`,
      [
        userId,
        `Encontramos ${scoringData.results.length} vacantes compatibles con tu perfil.`,
        JSON.stringify({ search_id: searchId, count: scoringData.results.length })
      ]
    );

    logger.info('Search completed via fallback', { searchId, matches: scoringData.results.length });
  } catch (err) {
    await query("UPDATE searches SET status = 'failed' WHERE id = $1", [searchId]);
    logger.error('Direct processing failed', { searchId, error: err.message });
  }
}

/**
 * Obtiene el estado de una búsqueda y sus matches.
 */
const getSearchStatus = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const searchResult = await query(
    'SELECT * FROM searches WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (!searchResult.rows.length) {
    return res.status(404).json({ error: 'Búsqueda no encontrada' });
  }

  const search = searchResult.rows[0];

  if (search.status !== 'completed') {
    return res.json({ search, matches: [], message: 'Procesando...' });
  }

  // Obtener matches con datos de vacantes
  const matchesResult = await query(
    `SELECT m.*, j.title, j.company_name, j.company_logo_url, j.city, j.work_modality,
            j.salary_min, j.salary_max, j.salary_disclosed, j.contract_type,
            j.required_experience_years, j.required_skills, j.description, j.benefits,
            j.external_url, j.category, j.tags
     FROM matches m JOIN jobs j ON j.id = m.job_id
     WHERE m.search_id = $1
     ORDER BY m.rank_position ASC`,
    [id]
  );

  res.json({
    search,
    matches: matchesResult.rows,
    summary: {
      total: matchesResult.rows.length,
      excellent: matchesResult.rows.filter(m => m.total_score >= 80).length,
      good: matchesResult.rows.filter(m => m.total_score >= 60 && m.total_score < 80).length,
      moderate: matchesResult.rows.filter(m => m.total_score < 60).length
    }
  });
};

/**
 * Historial de búsquedas del usuario.
 */
const getSearchHistory = async (req, res) => {
  const userId = req.user.id;
  
  const result = await query(
    `SELECT id, status, jobs_found, jobs_scored, triggered_at, completed_at, keywords, city
     FROM searches WHERE user_id = $1 ORDER BY triggered_at DESC LIMIT 20`,
    [userId]
  );

  res.json({ searches: result.rows });
};

module.exports = { triggerSearch, getSearchStatus, getSearchHistory };
