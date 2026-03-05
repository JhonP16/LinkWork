# ⚡ EmpleoMatch — Sistema Automatizado de Empleabilidad Colombia

> Sistema completo de matching de empleo con IA, scoring explicable 0-100, workflow n8n y UI moderna.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                         SISTEMA                             │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│  │ Frontend │───▶│ Backend  │───▶│  PostgreSQL DB        │  │
│  │ React    │    │ Node.js  │    │  (users, jobs,        │  │
│  │ :3001    │    │ :3000    │    │   matches, searches)  │  │
│  └──────────┘    └────┬─────┘    └──────────────────────┘  │
│                       │                                     │
│                       ▼                                     │
│               ┌───────────────┐                            │
│               │  n8n Workflow │                            │
│               │  :5678        │                            │
│               │  (orquesta el │                            │
│               │   proceso)    │                            │
│               └───────┬───────┘                            │
│                       │                                     │
│                       ▼                                     │
│               ┌───────────────┐                            │
│               │  Scoring      │                            │
│               │  Microservice │                            │
│               │  Python:8001  │                            │
│               │  Score 0-100  │                            │
│               └───────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## 🐳 Inicio rápido

### Prerrequisitos
- Docker Engine 24+
- Docker Compose v2+
- 4GB RAM disponibles

### 1. Clonar y configurar
```bash
git clone <repo>
cd empleabilidad
cp .env.example .env
# Editar .env con tus configuraciones
```

### 2. Levantar todo
```bash
docker-compose up --build
```

### 3. Acceder a los servicios
| Servicio   | URL                          | Credenciales         |
|------------|------------------------------|----------------------|
| Frontend   | http://localhost:3001        | demo@empleabilidad.co / demo123 |
| Backend API| http://localhost:3000/api    | —                    |
| n8n        | http://localhost:5678        | admin / admin123     |
| Scoring    | http://localhost:8001/docs   | —                    |
| PostgreSQL | localhost:5432               | postgres / postgres123 |

### 4. Importar workflow en n8n
1. Abrir http://localhost:5678
2. Ir a **Workflows → Import from file**
3. Seleccionar `n8n/workflow.json`
4. Configurar credencial PostgreSQL apuntando a `postgres:5432`
5. Activar el workflow

---

## 📁 Estructura del proyecto

```
empleabilidad/
├── 📁 backend/              # API REST (Node.js + Express)
│   ├── src/
│   │   ├── controllers/     # Lógica de negocio por entidad
│   │   ├── routes/          # Definición de endpoints
│   │   ├── middleware/       # Auth JWT, validaciones
│   │   ├── config/          # Configuración BD
│   │   └── utils/           # Logger, helpers
│   ├── Dockerfile
│   └── package.json
│
├── 📁 scoring/              # Microservicio scoring (Python + FastAPI)
│   ├── src/
│   │   └── main.py          # Lógica de scoring 0-100
│   ├── Dockerfile
│   └── requirements.txt
│
├── 📁 frontend/             # UI React + Vite
│   ├── src/
│   │   └── App.jsx          # Aplicación completa
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── 📁 database/
│   └── schema.sql           # Schema PostgreSQL completo
│
├── 📁 n8n/
│   └── workflow.json        # Workflow exportable n8n
│
├── docker-compose.yml       # Orquestación completa
├── .env.example             # Variables de entorno
└── README.md
```

---

## 🔄 Flujo del sistema

```
Usuario busca empleo
       │
       ▼
POST /api/search (Backend)
       │
       ├─► Guarda búsqueda en DB (status: pending)
       │
       ├─► Trigger webhook n8n (asíncrono)
       │
       └─► Responde 202 al frontend
              │
              ▼
       n8n Workflow:
       1. Recibe datos del webhook
       2. Normaliza datos del candidato
       3. Marca búsqueda como 'processing'
       4. Consulta vacantes en PostgreSQL
       5. Agrega todas las vacantes
       6. Llama a POST /score en microservicio
       7. Guarda matches con scores en DB
       8. Marca búsqueda como 'completed'
       9. Crea notificación para el usuario
       10. Simula envío de email
              │
              ▼
       Frontend hace polling
       GET /api/search/:id
       Cuando status = 'completed'
       → Muestra matches rankeados
```

---

## 📊 Sistema de Scoring (0-100)

| Dimensión       | Peso | Descripción                           |
|-----------------|------|---------------------------------------|
| Habilidades     | 30%  | Skills requeridos vs. disponibles     |
| Experiencia     | 20%  | Años requeridos vs. años candidato    |
| Ubicación       | 15%  | Ciudad + disponibilidad traslado      |
| Salario         | 15%  | Aspiración vs. rango ofrecido         |
| Educación       | 10%  | Nivel educativo requerido vs. actual  |
| Modalidad       | 5%   | Preferencia de modalidad              |
| Semántico       | 5%   | Match bio ↔ descripción               |

### Interpretación de scores
- **80-100**: 🌟 Excelente match — aplica inmediatamente
- **60-79**: ✅ Buen match — vale la pena aplicar
- **40-59**: 👍 Match moderado — adapta tu CV
- **0-39**: ⚠️ Poca compatibilidad — evalúa otras opciones

---

## 🔌 API REST

### Autenticación
```bash
# Registro
POST /api/auth/register
{
  "email": "candidato@email.com",
  "password": "contraseña123",
  "full_name": "Juan Pérez",
  "document_number": "1234567890"
}

# Login
POST /api/auth/login
{ "email": "...", "password": "..." }
→ { "token": "...", "user": {...} }
```

### Perfil
```bash
GET  /api/profile           # Obtener perfil
PUT  /api/profile           # Actualizar perfil
```

### Búsqueda y Matches
```bash
POST /api/search            # Iniciar búsqueda (trigger n8n)
GET  /api/search/:id        # Estado + matches de búsqueda
GET  /api/searches          # Historial de búsquedas
GET  /api/matches/today     # Matches más recientes
PATCH /api/matches/:id      # Actualizar estado (applied/saved/discarded)
```

### Vacantes
```bash
GET /api/jobs               # Listar vacantes (filtros: city, modality, ...)
GET /api/jobs/:id           # Detalle de vacante
```

### Scoring Microservice
```bash
POST http://localhost:8001/score
{
  "profile": { "user_id": "...", "technical_skills": [...], ... },
  "vacancies": [{ "id": "...", "required_skills": [...], ... }],
  "top_n": 20
}

GET http://localhost:8001/docs   # Swagger UI
GET http://localhost:8001/weights # Pesos del sistema
```

---

## 🗄️ Base de Datos

### Tablas principales
| Tabla          | Descripción                              |
|----------------|------------------------------------------|
| `users`        | Usuarios del sistema (candidatos/admin)  |
| `profiles`     | Perfiles laborales detallados            |
| `jobs`         | Vacantes de empleo                       |
| `searches`     | Búsquedas realizadas por candidatos      |
| `matches`      | Resultados del scoring por búsqueda      |
| `applications` | Postulaciones formales                   |
| `audit_logs`   | Trazabilidad completa de acciones        |
| `notifications`| Sistema de notificaciones in-app         |

---

## 🔧 Comandos útiles

```bash
# Ver logs de un servicio
docker-compose logs -f backend
docker-compose logs -f n8n
docker-compose logs -f scoring

# Reiniciar un servicio
docker-compose restart backend

# Acceder a PostgreSQL
docker-compose exec postgres psql -U postgres empleabilidad

# Detener todo
docker-compose down

# Detener y eliminar volúmenes (⚠️ borra datos)
docker-compose down -v

# Rebuild específico
docker-compose up --build scoring
```

---

## 🚀 Producción

Para despliegue en producción:

1. **Cambiar contraseñas** en `.env`
2. **HTTPS**: configurar certificados SSL en nginx
3. **JWT_SECRET**: usar `openssl rand -hex 32`
4. **Email real**: reemplazar el nodo simulado en n8n con SendGrid/AWS SES
5. **Embeddings**: activar sentence-transformers en scoring para score semántico real
6. **Backups**: configurar pg_dump automático

---

## 📝 Modelo de datos Colombia

El perfil incluye campos específicos del mercado laboral colombiano:
- Tipos de documento: CC, CE, TI, PP, NIT
- Tipos de contrato: indefinido, fijo, prestación de servicios, aprendizaje, obra/labor
- Ciudades principales de Colombia
- Salarios en COP
- Huso horario: America/Bogota

---

*Construido con ❤️ para el mercado laboral colombiano*
