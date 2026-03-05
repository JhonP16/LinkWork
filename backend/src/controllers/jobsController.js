const { query } = require('../config/database');

const getJobs = async (req, res) => {
  const { city, modality, category, min_salary, max_salary, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let conditions = ["j.status = 'active'"];
  let params = [];
  let idx = 1;

  if (city) { conditions.push(`j.city ILIKE $${idx++}`); params.push(`%${city}%`); }
  if (modality) { conditions.push(`j.work_modality = $${idx++}`); params.push(modality); }
  if (category) { conditions.push(`j.category ILIKE $${idx++}`); params.push(`%${category}%`); }
  if (min_salary) { conditions.push(`j.salary_max >= $${idx++}`); params.push(min_salary); }
  if (max_salary) { conditions.push(`j.salary_min <= $${idx++}`); params.push(max_salary); }
  if (search) {
    conditions.push(`(j.title ILIKE $${idx} OR j.description ILIKE $${idx} OR j.company_name ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  
  const [jobsResult, countResult] = await Promise.all([
    query(
      `SELECT j.id, j.title, j.company_name, j.company_logo_url, j.city, j.work_modality,
              j.salary_min, j.salary_max, j.salary_disclosed, j.contract_type,
              j.required_experience_years, j.required_education, j.category,
              j.required_skills, j.posted_at, j.expires_at
       FROM jobs j ${whereClause}
       ORDER BY j.posted_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM jobs j ${whereClause}`, params)
  ]);

  res.json({
    jobs: jobsResult.rows,
    pagination: {
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(countResult.rows[0].count / limit)
    }
  });
};

const getJobById = async (req, res) => {
  const result = await query('SELECT * FROM jobs WHERE id = $1 AND status = $2', [req.params.id, 'active']);
  if (!result.rows.length) return res.status(404).json({ error: 'Vacante no encontrada' });
  res.json({ job: result.rows[0] });
};

module.exports = { getJobs, getJobById };
