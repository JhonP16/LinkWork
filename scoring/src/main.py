"""
MICROSERVICIO DE SCORING - Sistema de Empleabilidad Colombia
FastAPI + Python | Score 0-100 explicable
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
import time
import json
from datetime import datetime

# ============================================================
# SETUP
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s'
)
logger = logging.getLogger("scoring-service")

app = FastAPI(
    title="Scoring Microservice - Empleabilidad Colombia",
    description="Calcula el matching entre candidatos y vacantes (0-100)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# MODELOS
# ============================================================

class Skill(BaseModel):
    name: str
    level: int = Field(default=3, ge=1, le=5)

class Language(BaseModel):
    language: str
    level: str  # basico, intermedio, avanzado, nativo

class CandidateProfile(BaseModel):
    user_id: str
    full_name: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    available_to_relocate: bool = False
    relocation_cities: List[str] = []
    work_modality: List[str] = ["presencial"]
    immediate_availability: bool = True
    desired_salary_min: Optional[int] = None
    desired_salary_max: Optional[int] = None
    education_level: Optional[str] = None
    years_experience: int = 0
    experience_sectors: List[str] = []
    technical_skills: List[Skill] = []
    soft_skills: List[str] = []
    languages: List[Language] = []
    bio: Optional[str] = None

class JobVacancy(BaseModel):
    id: str
    title: str
    company_name: str
    city: Optional[str] = None
    work_modality: str = "presencial"
    contract_type: str = "indefinido"
    required_education: Optional[str] = None
    required_experience_years: int = 0
    required_skills: List[Dict[str, Any]] = []
    preferred_skills: List[Dict[str, Any]] = []
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    category: Optional[str] = None

class ScoreRequest(BaseModel):
    profile: CandidateProfile
    vacancies: List[JobVacancy]
    top_n: int = Field(default=20, ge=1, le=100)

class ScoreBreakdown(BaseModel):
    skills_score: float
    experience_score: float
    location_score: float
    salary_score: float
    education_score: float
    modality_score: float
    semantic_score: float
    total_score: float

class MatchResult(BaseModel):
    job_id: str
    job_title: str
    company_name: str
    total_score: float
    rank_position: int
    breakdown: ScoreBreakdown
    matched_skills: List[str]
    missing_skills: List[str]
    explanation: Dict[str, str]
    recommendation: str

class ScoreResponse(BaseModel):
    user_id: str
    scored_at: str
    total_processed: int
    results: List[MatchResult]
    processing_time_ms: float

# ============================================================
# CONSTANTES DE PESOS
# ============================================================
WEIGHTS = {
    "skills": 0.50,
    "experience": 0.10,
    "location": 0.15,
    "salary": 0.10,
    "education": 0.05,
    "modality": 0.05,
    "semantic": 0.05,
}

EDUCATION_LEVELS = {
    "bachillerato": 1,
    "tecnico": 2,
    "tecnologo": 3,
    "universitario": 4,
    "especializacion": 5,
    "maestria": 6,
    "doctorado": 7,
}

# ============================================================
# LÓGICA DE SCORING
# ============================================================

def normalize_str(s: str) -> str:
    """Normaliza string para comparación."""
    if not s:
        return ""
    return s.lower().strip().replace("_", " ").replace("-", " ")


def score_skills(profile: CandidateProfile, job: JobVacancy) -> tuple[float, List[str], List[str]]:
    """
    Calcula score de habilidades tecnicas (30%).
    Si el candidato no tiene NINGUNA habilidad del perfil, retorna -1 (excluir vacante).
    """
    if not job.required_skills and not job.preferred_skills:
        # Si la vacante no exige skills, solo aplica si el candidato tiene al menos algo
        if not profile.technical_skills:
            return -1.0, [], []
        return 70.0, [], []

    candidate_skills = {normalize_str(s.name): s.level for s in profile.technical_skills}

    # Si el candidato no tiene ninguna habilidad registrada, excluir vacante
    if not candidate_skills:
        required = [s for s in job.required_skills if s.get("required", True)]
        missing = [s["name"] for s in required]
        return -1.0, [], missing

    # Si la vacante tiene skills requeridos pero el candidato no tiene ninguno en comun
    # con NINGUN skill del candidato (ni requeridos ni preferidos), excluir
    all_job_skills = set()
    for s in (job.required_skills or []):
        all_job_skills.add(normalize_str(s.get("name", "")))
    for s in (job.preferred_skills or []):
        all_job_skills.add(normalize_str(s.get("name", "")))
    
    if all_job_skills:
        has_any_match = any(cs in all_job_skills for cs in candidate_skills.keys())
        if not has_any_match:
            all_missing = [s.get("name", s) for s in (job.required_skills or [])]
            return -1.0, [], all_missing

    required = [s for s in job.required_skills if s.get("required", True)]
    preferred = [s for s in job.preferred_skills]

    matched = []
    missing = []

    # Habilidades requeridas
    required_score = 0
    if required:
        for skill in required:
            skill_name = normalize_str(skill["name"])
            if skill_name in candidate_skills:
                level = candidate_skills[skill_name]
                matched.append(skill["name"])
                required_score += (level / 5) * 100
            else:
                missing.append(skill["name"])
        required_score = required_score / len(required)

        # Si no hay NI UNA habilidad requerida que coincida, excluir vacante
        if not matched:
            return -1.0, [], missing
    else:
        required_score = 80

    # Habilidades preferidas (bonus)
    preferred_score = 0
    if preferred:
        matched_preferred = 0
        for skill in preferred:
            skill_name = normalize_str(skill["name"])
            if skill_name in candidate_skills:
                matched_preferred += 1
                if skill["name"] not in matched:
                    matched.append(skill["name"])
        preferred_score = (matched_preferred / len(preferred)) * 20

    final_score = min(100, (required_score * 0.85) + (preferred_score * 0.15))

    # Penalizacion proporcional por skills faltantes
    missing_critical = len(missing)
    total_required = len(required) if required else 1
    if missing_critical > 0:
        penalty = (missing_critical / total_required) * 30
        final_score = max(0, final_score - penalty)

    return round(final_score, 2), matched, missing


def score_experience(profile: CandidateProfile, job: JobVacancy) -> float:
    """Calcula score de experiencia (20%)."""
    required_years = job.required_experience_years or 0
    candidate_years = profile.years_experience or 0
    
    if required_years == 0:
        return 80.0 if candidate_years >= 0 else 60.0
    
    ratio = candidate_years / required_years
    
    if ratio >= 1.5:
        return 90.0  # Sobrecalificado ligeramente
    elif ratio >= 1.0:
        return 100.0  # Exacto o más
    elif ratio >= 0.75:
        return 75.0  # Cercano
    elif ratio >= 0.5:
        return 50.0  # Menor pero aceptable
    elif ratio >= 0.25:
        return 25.0  # Muy por debajo
    else:
        return 10.0  # Sin experiencia relevante


def score_location(profile: CandidateProfile, job: JobVacancy) -> float:
    """Calcula score de ubicación (15%)."""
    # Si el trabajo es remoto, ubicación no importa
    if job.work_modality == "remoto":
        return 100.0
    
    if not profile.city or not job.city:
        return 60.0
    
    profile_city = normalize_str(profile.city)
    job_city = normalize_str(job.city)
    
    # Misma ciudad
    if profile_city == job_city:
        return 100.0
    
    # Candidato dispuesto a trasladarse
    if profile.available_to_relocate:
        if profile.relocation_cities:
            if job_city in [normalize_str(c) for c in profile.relocation_cities]:
                return 85.0
            return 65.0
        return 75.0
    
    # Mismo departamento (parcial)
    if profile.department and job.city:
        return 30.0
    
    return 10.0


def score_salary(profile: CandidateProfile, job: JobVacancy) -> float:
    """Calcula score de aspiración salarial (15%)."""
    if not profile.desired_salary_min or not job.salary_max:
        return 70.0  # Sin info suficiente
    
    candidate_min = profile.desired_salary_min
    candidate_max = profile.desired_salary_max or candidate_min * 1.3
    job_min = job.salary_min or 0
    job_max = job.salary_max
    
    # Rango del candidato dentro del rango de la empresa
    if candidate_min <= job_max and (candidate_max >= job_min or job_min == 0):
        overlap_start = max(candidate_min, job_min)
        overlap_end = min(candidate_max, job_max)
        candidate_range = candidate_max - candidate_min
        job_range = job_max - (job_min or job_max * 0.7)
        
        if candidate_range > 0:
            overlap = (overlap_end - overlap_start) / candidate_range
            return min(100, round(60 + (overlap * 40), 2))
        return 80.0
    
    # Candidato pide más de lo que ofrece la empresa
    if candidate_min > job_max:
        excess = (candidate_min - job_max) / job_max
        if excess < 0.1:
            return 50.0
        elif excess < 0.25:
            return 30.0
        else:
            return 10.0
    
    return 60.0


def score_education(profile: CandidateProfile, job: JobVacancy) -> float:
    """Calcula score de nivel educativo (10%)."""
    if not job.required_education:
        return 80.0
    
    candidate_level = EDUCATION_LEVELS.get(profile.education_level, 0)
    required_level = EDUCATION_LEVELS.get(job.required_education, 0)
    
    if candidate_level == 0:
        return 40.0
    
    diff = candidate_level - required_level
    
    if diff >= 2:
        return 80.0  # Sobrecalificado
    elif diff == 1:
        return 95.0  # Un nivel arriba
    elif diff == 0:
        return 100.0  # Exacto
    elif diff == -1:
        return 50.0  # Un nivel abajo
    else:
        return 15.0  # Muy por debajo


def score_modality(profile: CandidateProfile, job: JobVacancy) -> float:
    """Calcula score de modalidad (5%)."""
    job_modality = job.work_modality or "presencial"
    candidate_modalities = profile.work_modality or ["presencial"]
    
    if job_modality in candidate_modalities:
        return 100.0
    
    # Compatibilidad parcial
    if "hibrido" in candidate_modalities and job_modality in ["presencial", "remoto"]:
        return 70.0
    if job_modality == "hibrido" and ("presencial" in candidate_modalities or "remoto" in candidate_modalities):
        return 70.0
    
    return 20.0


def score_semantic(profile: CandidateProfile, job: JobVacancy) -> float:
    """
    Score semántico simplificado (5%).
    En producción, usar embeddings (sentence-transformers).
    """
    if not profile.bio or not job.description:
        return 50.0
    
    profile_words = set(normalize_str(profile.bio).split())
    job_words = set(normalize_str(job.description).split())
    
    # Palabras de parada
    stop_words = {"de", "la", "el", "en", "y", "a", "con", "para", "por", "que", "un", "una", "los", "las"}
    profile_words -= stop_words
    job_words -= stop_words
    
    if not profile_words or not job_words:
        return 50.0
    
    intersection = profile_words & job_words
    union = profile_words | job_words
    
    jaccard = len(intersection) / len(union) if union else 0
    
    # Sectores
    sector_bonus = 0
    if profile.experience_sectors and job.category:
        job_cat_words = set(normalize_str(job.category).split())
        for sector in profile.experience_sectors:
            sector_words = set(normalize_str(sector).split())
            if sector_words & job_cat_words:
                sector_bonus = 20
                break
    
    return min(100, round((jaccard * 100 * 0.7) + sector_bonus + 30, 2))


def generate_explanation(
    profile: CandidateProfile,
    job: JobVacancy,
    breakdown: ScoreBreakdown,
    matched_skills: List[str],
    missing_skills: List[str]
) -> Dict[str, str]:
    """Genera explicación legible del score."""
    explanations = {}
    
    # Skills
    if breakdown.skills_score >= 80:
        explanations["skills"] = f"Excelente coincidencia de habilidades. Tienes {len(matched_skills)} de las requeridas."
    elif breakdown.skills_score >= 60:
        explanations["skills"] = f"Buena coincidencia. Te faltan: {', '.join(missing_skills[:3]) if missing_skills else 'ninguna crítica'}."
    else:
        explanations["skills"] = f"Faltan habilidades clave: {', '.join(missing_skills[:3])}. Considera capacitarte."
    
    # Experiencia
    if breakdown.experience_score >= 80:
        explanations["experience"] = f"Tu experiencia ({profile.years_experience} años) cumple o supera lo requerido."
    elif breakdown.experience_score >= 50:
        explanations["experience"] = f"Tu experiencia es cercana a lo requerido ({job.required_experience_years} años)."
    else:
        explanations["experience"] = f"La empresa requiere {job.required_experience_years} años, tú tienes {profile.years_experience}."
    
    # Ubicación
    if breakdown.location_score >= 90:
        explanations["location"] = "Ubicación perfecta. Vives en la ciudad del cargo."
    elif breakdown.location_score >= 70:
        explanations["location"] = "Disponibilidad de traslado valorada positivamente."
    else:
        explanations["location"] = "La ubicación puede ser un factor de ajuste."
    
    # Salario
    if breakdown.salary_score >= 80:
        explanations["salary"] = "Tu aspiración salarial está dentro del rango ofrecido."
    elif breakdown.salary_score >= 50:
        explanations["salary"] = "Hay cierta diferencia entre tu aspiración y la oferta. Espacio para negociación."
    else:
        explanations["salary"] = "Tu aspiración supera el rango de esta vacante."
    
    return explanations


def generate_recommendation(score: float, matched: List[str], missing: List[str]) -> str:
    """Genera recomendación según el score."""
    if score >= 80:
        return "🌟 Excelente match. Aplica cuanto antes, tu perfil es muy compatible."
    elif score >= 65:
        return "✅ Buen match. Vale la pena aplicar y destacar tus fortalezas en la carta de presentación."
    elif score >= 50:
        return "👍 Match moderado. Considera adaptar tu CV para esta vacante antes de aplicar."
    elif score >= 35:
        return "⚠️ Match bajo. Evalúa si esta vacante está alineada con tu perfil actual."
    else:
        return "❌ Poca compatibilidad. Enfócate en vacantes más alineadas a tu perfil."


def calculate_score(profile: CandidateProfile, job: JobVacancy) -> MatchResult:
    """Función principal de scoring para un par perfil-vacante."""
    
    # Calcular cada dimension
    skills_score, matched_skills, missing_skills = score_skills(profile, job)

    # Si el candidato no tiene ninguna habilidad relevante, excluir esta vacante
    if skills_score == -1.0:
        return None

    experience_score = score_experience(profile, job)
    location_score = score_location(profile, job)
    salary_score = score_salary(profile, job)
    education_score = score_education(profile, job)
    modality_score = score_modality(profile, job)
    semantic_score = score_semantic(profile, job)
    
    # Score total ponderado
    total_score = (
        skills_score * WEIGHTS["skills"] +
        experience_score * WEIGHTS["experience"] +
        location_score * WEIGHTS["location"] +
        salary_score * WEIGHTS["salary"] +
        education_score * WEIGHTS["education"] +
        modality_score * WEIGHTS["modality"] +
        semantic_score * WEIGHTS["semantic"]
    )
    total_score = round(min(100, max(0, total_score)), 2)
    
    breakdown = ScoreBreakdown(
        skills_score=round(skills_score, 2),
        experience_score=round(experience_score, 2),
        location_score=round(location_score, 2),
        salary_score=round(salary_score, 2),
        education_score=round(education_score, 2),
        modality_score=round(modality_score, 2),
        semantic_score=round(semantic_score, 2),
        total_score=total_score
    )
    
    explanation = generate_explanation(profile, job, breakdown, matched_skills, missing_skills)
    recommendation = generate_recommendation(total_score, matched_skills, missing_skills)
    
    return MatchResult(
        job_id=job.id,
        job_title=job.title,
        company_name=job.company_name,
        total_score=total_score,
        rank_position=0,  # Se asigna después del sort
        breakdown=breakdown,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        explanation=explanation,
        recommendation=recommendation
    )


# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "scoring", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat()}


@app.get("/weights")
async def get_weights():
    """Retorna los pesos actuales del sistema de scoring."""
    return {
        "weights": WEIGHTS,
        "description": {
            "skills": "Coincidencia de habilidades técnicas (30%)",
            "experience": "Años de experiencia requeridos vs. disponibles (20%)",
            "location": "Proximidad geográfica y disponibilidad de traslado (15%)",
            "salary": "Alineación entre aspiración y oferta salarial (15%)",
            "education": "Nivel educativo vs. requerido (10%)",
            "modality": "Compatibilidad de modalidad de trabajo (5%)",
            "semantic": "Matching semántico bio/descripción (5%)",
        }
    }


@app.post("/score", response_model=ScoreResponse)
async def score_candidates(request: ScoreRequest):
    """
    Calcula ranking de vacantes para un candidato.
    
    - Recibe perfil del candidato y lista de vacantes
    - Calcula score 0-100 para cada vacante
    - Retorna ranking ordenado con breakdown explicable
    """
    start_time = time.time()
    
    logger.info(f"Scoring request for user {request.profile.user_id} | {len(request.vacancies)} vacancies")
    
    if not request.vacancies:
        raise HTTPException(status_code=400, detail="No se proporcionaron vacantes para evaluar")
    
    results = []
    
    for job in request.vacancies:
        try:
            match_result = calculate_score(request.profile, job)
            if match_result is None:
                logger.info(f"Vacante excluida (sin habilidades compatibles): {job.title}")
                continue
            results.append(match_result)
        except Exception as e:
            logger.error(f"Error scoring job {job.id}: {str(e)}")
            continue
    
    # Ordenar por score descendente
    results.sort(key=lambda x: x.total_score, reverse=True)
    
    # Asignar posición de ranking
    for i, result in enumerate(results):
        result.rank_position = i + 1
    
    # Top N
    results = results[:request.top_n]
    
    processing_time = (time.time() - start_time) * 1000
    
    logger.info(f"Scoring completed | {len(results)} results | {processing_time:.2f}ms")
    
    return ScoreResponse(
        user_id=request.profile.user_id,
        scored_at=datetime.utcnow().isoformat(),
        total_processed=len(request.vacancies),
        results=results,
        processing_time_ms=round(processing_time, 2)
    )


@app.post("/score/single")
async def score_single(profile: CandidateProfile, job: JobVacancy):
    """Calcula score para un par candidato-vacante específico."""
    result = calculate_score(profile, job)
    result.rank_position = 1
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
