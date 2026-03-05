const { query } = require('../config/database');
const logger = require('../utils/logger');

const getProfile = async (req, res) => {
  const userId = req.user.id;
  
  const result = await query(
    `SELECT p.*, u.full_name, u.email, u.document_type, u.document_number, u.phone
     FROM profiles p JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1`,
    [userId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Perfil no encontrado' });
  }

  res.json({ profile: result.rows[0] });
};

const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const {
    birth_date, gender, city, department, available_to_relocate, relocation_cities,
    work_modality, immediate_availability, available_from,
    desired_salary_min, desired_salary_max, salary_negotiable, contract_types,
    education_level, education_area, institution, graduation_year,
    years_experience, current_position, current_company, experience_sectors,
    technical_skills, soft_skills, languages, bio, linkedin_url, portfolio_url
  } = req.body;

  // Convertir arrays JS a formato que PostgreSQL entiende
  const toPostgresArray = (arr) => {
    if (!arr || !Array.isArray(arr)) return null;
    return arr; // pg driver maneja arrays nativos correctamente
  };

  const result = await query(
    `UPDATE profiles SET
      birth_date = COALESCE($1, birth_date),
      gender = COALESCE($2, gender),
      city = COALESCE($3, city),
      department = COALESCE($4, department),
      available_to_relocate = COALESCE($5, available_to_relocate),
      relocation_cities = COALESCE($6::text[], relocation_cities),
      work_modality = COALESCE($7::text[], work_modality),
      immediate_availability = COALESCE($8, immediate_availability),
      available_from = COALESCE($9, available_from),
      desired_salary_min = COALESCE($10, desired_salary_min),
      desired_salary_max = COALESCE($11, desired_salary_max),
      salary_negotiable = COALESCE($12, salary_negotiable),
      contract_types = COALESCE($13::text[], contract_types),
      education_level = COALESCE($14, education_level),
      education_area = COALESCE($15, education_area),
      institution = COALESCE($16, institution),
      graduation_year = COALESCE($17, graduation_year),
      years_experience = COALESCE($18, years_experience),
      current_position = COALESCE($19, current_position),
      current_company = COALESCE($20, current_company),
      experience_sectors = COALESCE($21::text[], experience_sectors),
      technical_skills = COALESCE($22::jsonb, technical_skills),
      soft_skills = COALESCE($23::text[], soft_skills),
      languages = COALESCE($24::jsonb, languages),
      bio = COALESCE($25, bio),
      linkedin_url = COALESCE($26, linkedin_url),
      portfolio_url = COALESCE($27, portfolio_url),
      updated_at = NOW()
    WHERE user_id = $28
    RETURNING *`,
    [
      birth_date || null,
      gender || null,
      city || null,
      department || null,
      available_to_relocate !== undefined ? available_to_relocate : null,
      toPostgresArray(relocation_cities),
      toPostgresArray(work_modality),
      immediate_availability !== undefined ? immediate_availability : null,
      available_from || null,
      desired_salary_min || null,
      desired_salary_max || null,
      salary_negotiable !== undefined ? salary_negotiable : null,
      toPostgresArray(contract_types),
      education_level || null,
      education_area || null,
      institution || null,
      graduation_year || null,
      years_experience !== undefined ? years_experience : null,
      current_position || null,
      current_company || null,
      toPostgresArray(experience_sectors),
      technical_skills ? JSON.stringify(technical_skills) : null,
      toPostgresArray(soft_skills),
      languages ? JSON.stringify(languages) : null,
      bio || null,
      linkedin_url || null,
      portfolio_url || null,
      userId
    ]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Perfil no encontrado' });
  }

  // Recalcular completitud
  const completeness = await query('SELECT calculate_profile_completeness($1)', [result.rows[0].id]);
  const comp = completeness.rows[0].calculate_profile_completeness;
  await query('UPDATE profiles SET profile_completeness = $1 WHERE id = $2', [comp, result.rows[0].id]);

  logger.info('Profile updated', { userId });

  res.json({ profile: { ...result.rows[0], profile_completeness: comp } });
};

module.exports = { getProfile, updateProfile };
