-- ============================================================
-- SISTEMA DE EMPLEABILIDAD - ESQUEMA POSTGRESQL
-- Colombia Employment Matching System
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABLA: users
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(20) DEFAULT 'CC' CHECK (document_type IN ('CC', 'CE', 'TI', 'PP', 'NIT')),
    document_number VARCHAR(50) UNIQUE,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'candidate' CHECK (role IN ('candidate', 'recruiter', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_document ON users(document_number);

-- ============================================================
-- TABLA: profiles
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Información personal
    birth_date DATE,
    gender VARCHAR(20),
    nationality VARCHAR(100) DEFAULT 'Colombiana',
    photo_url VARCHAR(500),
    
    -- Ubicación
    city VARCHAR(100),
    department VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Colombia',
    address VARCHAR(255),
    available_to_relocate BOOLEAN DEFAULT FALSE,
    relocation_cities TEXT[], -- Array de ciudades aceptadas
    
    -- Modalidad y disponibilidad
    work_modality VARCHAR(20)[] DEFAULT ARRAY['presencial'] CHECK (
        work_modality <@ ARRAY['presencial', 'remoto', 'hibrido']::VARCHAR[]
    ),
    immediate_availability BOOLEAN DEFAULT TRUE,
    available_from DATE,
    
    -- Expectativas laborales
    desired_salary_min INTEGER, -- En pesos COP
    desired_salary_max INTEGER,
    salary_negotiable BOOLEAN DEFAULT TRUE,
    contract_types VARCHAR(20)[] DEFAULT ARRAY['indefinido'] CHECK (
        contract_types <@ ARRAY['indefinido', 'fijo', 'prestacion_servicios', 'aprendizaje', 'obra_labor']::VARCHAR[]
    ),
    
    -- Educación
    education_level VARCHAR(50) CHECK (education_level IN (
        'bachillerato', 'tecnico', 'tecnologo', 'universitario',
        'especializacion', 'maestria', 'doctorado'
    )),
    education_area VARCHAR(100),
    institution VARCHAR(200),
    graduation_year INTEGER,
    
    -- Experiencia
    years_experience INTEGER DEFAULT 0,
    current_position VARCHAR(150),
    current_company VARCHAR(150),
    experience_sectors TEXT[],
    
    -- Habilidades
    technical_skills JSONB DEFAULT '[]'::jsonb, -- [{name, level: 1-5}]
    soft_skills TEXT[],
    languages JSONB DEFAULT '[]'::jsonb, -- [{language, level: basico/intermedio/avanzado/nativo}]
    
    -- Perfil profesional
    bio TEXT,
    linkedin_url VARCHAR(300),
    portfolio_url VARCHAR(300),
    
    -- Metadata
    profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX idx_profiles_user ON profiles(user_id);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_education ON profiles(education_level);
CREATE INDEX idx_profiles_experience ON profiles(years_experience);
CREATE INDEX idx_profiles_skills ON profiles USING gin(technical_skills);

-- ============================================================
-- TABLA: jobs (vacantes)
-- ============================================================
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Información de la empresa
    company_name VARCHAR(200) NOT NULL,
    company_logo_url VARCHAR(500),
    company_sector VARCHAR(100),
    company_size VARCHAR(50),
    
    -- Detalle de la vacante
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    responsibilities TEXT,
    benefits TEXT,
    
    -- Ubicación
    city VARCHAR(100),
    department VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Colombia',
    remote_allowed BOOLEAN DEFAULT FALSE,
    
    -- Modalidad
    work_modality VARCHAR(20) DEFAULT 'presencial' CHECK (work_modality IN ('presencial', 'remoto', 'hibrido')),
    contract_type VARCHAR(30) DEFAULT 'indefinido',
    
    -- Requisitos
    required_education VARCHAR(50),
    required_experience_years INTEGER DEFAULT 0,
    required_skills JSONB DEFAULT '[]'::jsonb,
    preferred_skills JSONB DEFAULT '[]'::jsonb,
    languages_required JSONB DEFAULT '[]'::jsonb,
    
    -- Salario
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(10) DEFAULT 'COP',
    salary_disclosed BOOLEAN DEFAULT TRUE,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed', 'draft')),
    expires_at TIMESTAMP,
    positions_available INTEGER DEFAULT 1,
    
    -- SEO / Búsqueda
    tags TEXT[],
    category VARCHAR(100),
    
    -- Origen
    source VARCHAR(100) DEFAULT 'manual',
    external_id VARCHAR(200),
    external_url VARCHAR(500),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    posted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_city ON jobs(city);
CREATE INDEX idx_jobs_modality ON jobs(work_modality);
CREATE INDEX idx_jobs_title_trgm ON jobs USING gin(title gin_trgm_ops);
CREATE INDEX idx_jobs_skills ON jobs USING gin(required_skills);
CREATE INDEX idx_jobs_category ON jobs(category);
CREATE INDEX idx_jobs_posted ON jobs(posted_at DESC);

-- ============================================================
-- TABLA: searches (búsquedas de empleo)
-- ============================================================
CREATE TABLE searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Criterios de búsqueda
    keywords TEXT,
    city VARCHAR(100),
    work_modality VARCHAR(20)[],
    min_salary INTEGER,
    max_salary INTEGER,
    contract_types VARCHAR(20)[],
    education_levels VARCHAR(50)[],
    categories TEXT[],
    
    -- Estado del proceso
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'scoring', 'completed', 'failed'
    )),
    jobs_found INTEGER DEFAULT 0,
    jobs_scored INTEGER DEFAULT 0,
    
    -- N8N tracking
    workflow_execution_id VARCHAR(255),
    
    triggered_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_searches_user ON searches(user_id);
CREATE INDEX idx_searches_status ON searches(status);
CREATE INDEX idx_searches_triggered ON searches(triggered_at DESC);

-- ============================================================
-- TABLA: matches (resultados del ranking)
-- ============================================================
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    
    -- Scores
    total_score DECIMAL(5,2) NOT NULL CHECK (total_score BETWEEN 0 AND 100),
    
    -- Score breakdown
    skills_score DECIMAL(5,2) DEFAULT 0,
    experience_score DECIMAL(5,2) DEFAULT 0,
    location_score DECIMAL(5,2) DEFAULT 0,
    salary_score DECIMAL(5,2) DEFAULT 0,
    education_score DECIMAL(5,2) DEFAULT 0,
    modality_score DECIMAL(5,2) DEFAULT 0,
    semantic_score DECIMAL(5,2) DEFAULT 0,
    
    -- Explicabilidad
    score_explanation JSONB DEFAULT '{}'::jsonb,
    matched_skills TEXT[],
    missing_skills TEXT[],
    
    -- Ranking
    rank_position INTEGER,
    
    -- Acciones del usuario
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'viewed', 'saved', 'applied', 'discarded', 'interview', 'offer'
    )),
    user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
    notes TEXT,
    
    viewed_at TIMESTAMP,
    action_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(search_id, job_id)
);

CREATE INDEX idx_matches_search ON matches(search_id);
CREATE INDEX idx_matches_user ON matches(user_id);
CREATE INDEX idx_matches_job ON matches(job_id);
CREATE INDEX idx_matches_score ON matches(total_score DESC);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_rank ON matches(search_id, rank_position);

-- ============================================================
-- TABLA: applications (postulaciones)
-- ============================================================
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    match_id UUID REFERENCES matches(id),
    
    -- Estado
    status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN (
        'submitted', 'viewed', 'shortlisted', 'interview_1',
        'interview_2', 'technical_test', 'offer', 'hired', 'rejected', 'withdrawn'
    )),
    
    -- Datos de postulación
    cover_letter TEXT,
    cv_url VARCHAR(500),
    portfolio_url VARCHAR(300),
    
    -- Tracking
    score_at_application DECIMAL(5,2),
    notes_internal TEXT,
    rejection_reason TEXT,
    
    submitted_at TIMESTAMP DEFAULT NOW(),
    last_status_change TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, job_id)
);

CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_status ON applications(status);

-- ============================================================
-- TABLA: audit_logs
-- ============================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contexto
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Evento
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    
    -- Datos
    old_data JSONB,
    new_data JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Sistema
    service VARCHAR(50) DEFAULT 'backend',
    severity VARCHAR(20) DEFAULT 'INFO' CHECK (severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
    message TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_severity ON audit_logs(severity);

-- ============================================================
-- TABLA: notifications
-- ============================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    channel VARCHAR(20) DEFAULT 'app' CHECK (channel IN ('app', 'email', 'sms', 'push')),
    sent_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCIÓN: calcular completitud del perfil
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_profile_completeness(p_id UUID)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    p RECORD;
BEGIN
    SELECT * INTO p FROM profiles WHERE id = p_id;
    
    IF p.city IS NOT NULL THEN score := score + 10; END IF;
    IF p.education_level IS NOT NULL THEN score := score + 15; END IF;
    IF jsonb_array_length(p.technical_skills) > 0 THEN score := score + 20; END IF;
    IF p.years_experience IS NOT NULL THEN score := score + 10; END IF;
    IF p.desired_salary_min IS NOT NULL THEN score := score + 10; END IF;
    IF p.work_modality IS NOT NULL THEN score := score + 5; END IF;
    IF p.bio IS NOT NULL AND length(p.bio) > 50 THEN score := score + 15; END IF;
    IF array_length(p.soft_skills, 1) > 0 THEN score := score + 10; END IF;
    IF jsonb_array_length(p.languages) > 0 THEN score := score + 5; END IF;
    
    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DATOS DE EJEMPLO
-- ============================================================

-- Usuario admin
INSERT INTO users (id, email, password_hash, full_name, document_type, document_number, phone, role)
VALUES 
(uuid_generate_v4(), 'admin@empleabilidad.co', '$2b$10$placeholder_hash_admin', 'Administrador Sistema', 'CC', '1000000001', '3001234567', 'admin'),
(uuid_generate_v4(), 'juan.perez@email.com', '$2b$10$placeholder_hash_juan', 'Juan Carlos Pérez Gómez', 'CC', '1234567890', '3109876543', 'candidate'),
(uuid_generate_v4(), 'maria.rodriguez@email.com', '$2b$10$placeholder_hash_maria', 'María Fernanda Rodríguez', 'CC', '9876543210', '3205551234', 'candidate');

-- Perfil de ejemplo
INSERT INTO profiles (user_id, city, department, available_to_relocate, work_modality, desired_salary_min, desired_salary_max, education_level, education_area, institution, years_experience, current_position, experience_sectors, technical_skills, soft_skills, languages, bio, profile_completeness)
SELECT 
    u.id,
    'Bogotá', 'Cundinamarca', TRUE,
    ARRAY['remoto', 'hibrido'],
    4500000, 7000000,
    'universitario', 'Ingeniería de Sistemas', 'Universidad Nacional de Colombia',
    3, 'Desarrollador Frontend Junior', ARRAY['tecnología', 'fintech', 'educación'],
    '[{"name":"React","level":4},{"name":"JavaScript","level":4},{"name":"Node.js","level":3},{"name":"PostgreSQL","level":2},{"name":"Docker","level":2}]'::jsonb,
    ARRAY['trabajo en equipo','comunicación asertiva','resolución de problemas','adaptabilidad'],
    '[{"language":"español","level":"nativo"},{"language":"inglés","level":"intermedio"}]'::jsonb,
    'Desarrollador apasionado por crear soluciones web modernas y escalables. Experiencia en React y Node.js con enfoque en UX.',
    85
FROM users u WHERE u.email = 'juan.perez@email.com';

-- Vacantes de ejemplo
INSERT INTO jobs (company_name, company_sector, title, description, requirements, city, work_modality, contract_type, required_education, required_experience_years, required_skills, preferred_skills, salary_min, salary_max, status, category, tags)
VALUES
(
    'TechCorp Colombia SAS', 'Tecnología',
    'Desarrollador React Senior',
    'Buscamos un desarrollador React apasionado para unirse a nuestro equipo de producto. Trabajarás en aplicaciones de alto impacto para más de 500,000 usuarios.',
    'Mínimo 3 años de experiencia en React. TypeScript requerido. Experiencia con Redux o Zustand.',
    'Bogotá', 'hibrido', 'indefinido',
    'universitario', 3,
    '[{"name":"React","required":true},{"name":"TypeScript","required":true},{"name":"JavaScript","required":true}]'::jsonb,
    '[{"name":"Next.js","required":false},{"name":"GraphQL","required":false}]'::jsonb,
    6000000, 9000000, 'active', 'Tecnología',
    ARRAY['react', 'frontend', 'javascript', 'typescript']
),
(
    'Bancolombia', 'Finanzas',
    'Desarrollador Full Stack',
    'Vinculación a equipo de transformación digital. Proyectos de modernización de sistemas core bancarios.',
    'Experiencia en Node.js y React. Conocimiento de metodologías ágiles. Deseable experiencia en sector financiero.',
    'Medellín', 'hibrido', 'indefinido',
    'universitario', 4,
    '[{"name":"Node.js","required":true},{"name":"React","required":true},{"name":"PostgreSQL","required":false}]'::jsonb,
    '[{"name":"Docker","required":false},{"name":"AWS","required":false}]'::jsonb,
    7000000, 11000000, 'active', 'Tecnología',
    ARRAY['fullstack', 'nodejs', 'react', 'fintech']
),
(
    'Rappi Tech', 'Tecnología',
    'Frontend Engineer',
    'Únete al equipo de engineering de Rappi. Construye interfaces para millones de usuarios en Latinoamérica.',
    'Experiencia sólida en JavaScript moderno. React o Vue. Capacidad de trabajo en equipos distribuidos.',
    'Bogotá', 'remoto', 'indefinido',
    'universitario', 2,
    '[{"name":"JavaScript","required":true},{"name":"React","required":true}]'::jsonb,
    '[{"name":"Vue","required":false},{"name":"React Native","required":false}]'::jsonb,
    5500000, 8500000, 'active', 'Tecnología',
    ARRAY['frontend', 'javascript', 'react', 'remoto']
),
(
    'Platzi', 'EdTech',
    'Desarrollador Web Junior',
    'Oportunidad para desarrollador con ganas de crecer. Trabajarás en la plataforma educativa más grande de LATAM.',
    'Conocimientos básicos de React y JavaScript. Actitud de aprendizaje constante.',
    'Bogotá', 'remoto', 'indefinido',
    'tecnologo', 1,
    '[{"name":"JavaScript","required":true},{"name":"React","required":false},{"name":"HTML","required":true}]'::jsonb,
    '[]'::jsonb,
    3500000, 5000000, 'active', 'Tecnología',
    ARRAY['junior', 'react', 'javascript', 'edtech', 'remoto']
),
(
    'EPM', 'Energía',
    'Analista de Sistemas',
    'Apoyo en gestión y mantenimiento de sistemas de información corporativos.',
    'Tecnólogo o profesional en sistemas. Manejo de bases de datos. Excel avanzado.',
    'Medellín', 'presencial', 'fijo',
    'tecnologo', 1,
    '[{"name":"SQL","required":true},{"name":"Excel","required":true}]'::jsonb,
    '[{"name":"Python","required":false}]'::jsonb,
    2800000, 3800000, 'active', 'Tecnología',
    ARRAY['analista', 'sistemas', 'sql', 'medellin']
);

-- ============================================================
-- TABLA: conversations (mensajería directa)
-- ============================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_one UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_two UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_text TEXT,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT conversations_unique_pair UNIQUE (user_one, user_two),
    CONSTRAINT conversations_different_users CHECK (user_one <> user_two)
);

CREATE INDEX idx_conversations_user_one ON conversations(user_one);
CREATE INDEX idx_conversations_user_two ON conversations(user_two);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLA: messages (mensajes individuales)
-- ============================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

-- Log de auditoría inicial
INSERT INTO audit_logs (entity_type, action, message, service, severity)
VALUES ('system', 'INIT', 'Base de datos inicializada correctamente', 'database', 'INFO');

COMMIT;
