import { useState, useEffect } from "react";
import linkworkMark from "./assets/linkwork-m.png";

const API_BASE = '/api';

const api = {
  token: null,
  setToken(t) { this.token = t; if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); },
  getToken() { return this.token || localStorage.getItem('token'); },
  async req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = this.getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  },
  get(p) { return this.req('GET', p); },
  post(p, b) { return this.req('POST', p, b); },
  put(p, b) { return this.req('PUT', p, b); },
  patch(p, b) { return this.req('PATCH', p, b); },
};

const MOCK_MATCHES = [
  { id: "m1", rank_position: 1, total_score: 92, skills_score: 95, experience_score: 90, location_score: 100, salary_score: 88, education_score: 100, modality_score: 100, semantic_score: 78, match_status: "pending", matched_skills: ["React", "JavaScript", "Node.js", "TypeScript"], missing_skills: [], score_explanation: { skills: "Excelente coincidencia de habilidades.", experience: "Tu experiencia cumple lo requerido.", location: "Trabajo remoto disponible.", salary: "Tu aspiracion esta dentro del rango." }, title: "Desarrollador Full Stack", company_name: "Bancolombia", company_sector: "FinTech", city: "Medellin", work_modality: "remoto", salary_min: 3900000, salary_max: 5500000, salary_disclosed: true, contract_type: "indefinido", required_experience_years: 3, category: "Tecnologia", description: "Vinculacion a equipo de transformacion digital. Proyectos de modernizacion de sistemas core bancarios.", posted_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "m2", rank_position: 2, total_score: 88, skills_score: 88, experience_score: 85, location_score: 100, salary_score: 82, education_score: 100, modality_score: 100, semantic_score: 70, match_status: "pending", matched_skills: ["JavaScript", "React", "CSS"], missing_skills: ["Vue"], score_explanation: { skills: "Buena coincidencia.", experience: "Experiencia adecuada.", location: "Trabajo remoto.", salary: "Rango compatible." }, title: "Disenador Web", company_name: "Spotify", company_sector: "Music Streaming", city: "Bogota", work_modality: "remoto", salary_min: 4500000, salary_max: 6000000, salary_disclosed: true, contract_type: "indefinido", required_experience_years: 2, category: "Diseno", description: "Crear interfaces visuales atractivas para la plataforma de streaming mas grande del mundo.", posted_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "m3", rank_position: 3, total_score: 78, skills_score: 80, experience_score: 75, location_score: 100, salary_score: 70, education_score: 100, modality_score: 100, semantic_score: 65, match_status: "pending", matched_skills: ["React", "JavaScript"], missing_skills: ["AWS"], score_explanation: { skills: "Match moderado.", experience: "Brecha en experiencia.", location: "Remoto.", salary: "Diferencia de aspiracion." }, title: "Ingeniero Frontend", company_name: "Airbnb", company_sector: "Hospitality", city: "Bogota", work_modality: "remoto", salary_min: 5000000, salary_max: 7000000, salary_disclosed: true, contract_type: "indefinido", required_experience_years: 4, category: "Tecnologia", description: "Construye la proxima generacion de interfaces para millones de viajeros en todo el mundo.", posted_at: new Date(Date.now() - 259200000).toISOString() },
];

const formatCOP = (n) => { if (!n) return null; if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`; return `$${(n / 1000).toFixed(0)}K`; };

const ScoreCircle = ({ score, size = 60 }) => {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : '#dc2626';
  const bg = score >= 80 ? '#dcfce7' : score >= 60 ? '#fef9c3' : '#fee2e2';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill={bg} stroke="#e5e7eb" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 700, color, fontFamily: 'Inter,sans-serif' }}>{score}%</span>
      </div>
    </div>
  );
};

const Tag = ({ children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f3f4f6', color: '#6b7280', fontSize: 12, padding: '4px 10px', borderRadius: 999, fontFamily: 'Inter,sans-serif' }}>{children}</span>
);

const DiscoverIcon = ({ active }) => <svg width="18" height="18" fill="none" stroke={active ? '#16a34a' : '#9ca3af'} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
const HeartIcon = ({ active }) => <svg width="18" height="18" fill={active ? '#16a34a' : 'none'} stroke={active ? '#16a34a' : '#9ca3af'} strokeWidth="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
const MsgIcon = ({ active }) => <svg width="18" height="18" fill="none" stroke={active ? '#16a34a' : '#9ca3af'} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const UserIcon = ({ active }) => <svg width="18" height="18" fill="none" stroke={active ? '#16a34a' : '#9ca3af'} strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;

const Sidebar = ({ user, activePage, setActivePage, onLogout, matchCount }) => {
  const nav = [{ key: 'discover', Icon: DiscoverIcon, label: 'Descubre' }, { key: 'matches', Icon: HeartIcon, label: 'Mis Match', badge: matchCount }, { key: 'messages', Icon: MsgIcon, label: 'Mensajes' }, { key: 'profile', Icon: UserIcon, label: 'Perfil' }];
  return (
    <div style={{ width: 220, minHeight: '100vh', background: 'white', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50 }}>
      <div style={{ padding: '28px 24px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={linkworkMark} alt="M de LinkWork" style={{ width: 34, height: 34, display: 'block' }} />
        <span style={{ fontWeight: 700, fontSize: 17, color: '#111827', fontFamily: 'Inter,sans-serif' }}>LinkWork</span>
      </div>
      <nav style={{ flex: 1, padding: '8px 12px' }}>
        {nav.map(({ key, Icon, label, badge }) => {
          const active = activePage === key;
          return (
            <button key={key} onClick={() => setActivePage(key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: active ? '#f0fdf4' : 'transparent', color: active ? '#16a34a' : '#6b7280', fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: active ? 600 : 400, marginBottom: 2, transition: 'all 0.15s', textAlign: 'left' }}>
              <Icon active={active} />
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && <span style={{ background: '#16a34a', color: 'white', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>{badge}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
          {user.full_name?.charAt(0) || 'U'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.full_name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'Inter,sans-serif' }}>Candidato</div>
        </div>
        <button onClick={onLogout} title="Cerrar sesion" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, fontSize: 16 }}>⚙</button>
      </div>
    </div>
  );
};

const MatchCard = ({ match, onAction, expanded, onToggle, readOnly = false }) => {
  const isApplied = match.match_status === 'applied', isSaved = match.match_status === 'saved';
  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
  const color = colors[match.company_name?.charCodeAt(0) % colors.length] || '#6b7280';
  const isExcellent = match.total_score >= 80, isGood = match.total_score >= 60;
  const badgeColor = isExcellent ? '#16a34a' : isGood ? '#ca8a04' : '#dc2626';
  const badgeLabel = isExcellent ? 'Match Excelente' : isGood ? 'Buena Match' : 'Match Regular';

  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 20, flexShrink: 0, fontFamily: 'Inter,sans-serif' }}>
            {match.company_name?.charAt(0) || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827', fontFamily: 'Inter,sans-serif' }}>{match.title}</h3>
            <p style={{ margin: '3px 0 10px', fontSize: 13, color: '#9ca3af', fontFamily: 'Inter,sans-serif' }}>{match.company_name} · {match.company_sector || match.category}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag>📍 {match.city} · {match.work_modality === 'remoto' ? 'Remoto' : match.work_modality === 'hibrido' ? 'Hibrido' : 'Presencial'}</Tag>
              {match.salary_disclosed && match.salary_min && <Tag>💰 {formatCOP(match.salary_min)} - {formatCOP(match.salary_max)}</Tag>}
              <Tag>📋 {match.contract_type === 'indefinido' ? 'Full-time' : match.contract_type}</Tag>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: badgeColor, fontFamily: 'Inter,sans-serif', textTransform: 'uppercase' }}>{badgeLabel}</span>
              <ScoreCircle score={match.total_score} size={60} />
            </div>
            <button onClick={onToggle} style={{ padding: '8px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif', boxShadow: '0 2px 8px rgba(22,163,74,0.25)' }}>
              {expanded ? 'Ocultar' : 'Ver Detalles'}
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '20px 24px', background: '#fafafa' }}>
          <h4 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desglose del score</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 16 }}>
            {[{ label: 'Habilidades', value: match.skills_score, icon: '💻' }, { label: 'Experiencia', value: match.experience_score, icon: '📅' }, { label: 'Ubicacion', value: match.location_score, icon: '📍' }, { label: 'Salario', value: match.salary_score, icon: '💰' }, { label: 'Educacion', value: match.education_score, icon: '🎓' }, { label: 'Modalidad', value: match.modality_score, icon: '🏠' }].map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Inter,sans-serif' }}>{s.icon} {s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: s.value >= 80 ? '#16a34a' : s.value >= 60 ? '#ca8a04' : '#dc2626', fontFamily: 'Inter,sans-serif' }}>{Math.round(s.value)}%</span>
                </div>
                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.value}%`, background: s.value >= 80 ? '#16a34a' : s.value >= 60 ? '#ca8a04' : '#dc2626', borderRadius: 999, transition: 'width 0.8s' }} />
                </div>
              </div>
            ))}
          </div>
          {match.matched_skills?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Inter,sans-serif' }}>Skills que coinciden: </span>
              {match.matched_skills.map(s => <span key={s} style={{ display: 'inline-block', background: '#dcfce7', color: '#16a34a', fontSize: 11, padding: '2px 8px', borderRadius: 999, marginRight: 4, marginTop: 4, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{s}</span>)}
              {match.missing_skills?.map(s => <span key={s} style={{ display: 'inline-block', background: '#fee2e2', color: '#dc2626', fontSize: 11, padding: '2px 8px', borderRadius: 999, marginRight: 4, marginTop: 4, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>- {s}</span>)}
            </div>
          )}
          <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b7280', fontFamily: 'Inter,sans-serif', lineHeight: 1.6 }}>{match.description}</p>
          {!readOnly && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => onAction(match.id, 'applied')} disabled={isApplied} style={{ flex: 2, padding: '10px 0', background: isApplied ? '#dcfce7' : '#16a34a', border: isApplied ? '1px solid #16a34a' : 'none', borderRadius: 10, color: isApplied ? '#16a34a' : 'white', cursor: isApplied ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>
                {isApplied ? 'Aplicado' : 'Aplicar ahora'}
              </button>
              <button onClick={() => onAction(match.id, 'saved')} style={{ flex: 1, padding: '10px 0', background: isSaved ? '#f0fdf4' : 'white', border: `1px solid ${isSaved ? '#16a34a' : '#e5e7eb'}`, borderRadius: 10, color: isSaved ? '#16a34a' : '#6b7280', cursor: 'pointer', fontSize: 13, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
                {isSaved ? 'Guardado' : 'Guardar'}
              </button>
              <button onClick={() => onAction(match.id, 'discarded')} style={{ padding: '10px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>X</button>
            </div>
          )}
          {readOnly && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 20px' }}>
              <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>✓ Aplicado</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MatchesPage = ({ user, refreshKey }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');
  const [expandedMatch, setExpandedMatch] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/matches/today').then(d => {
      setMatches(d.matches || []);
    }).catch(() => setMatches([])).finally(() => setLoading(false));
  }, [refreshKey]);

  const stats = {
    total: matches.length,
    avgScore: matches.length ? Math.round(matches.reduce((a, b) => a + (parseFloat(b.total_score) || 0), 0) / matches.length) : 0,
    topScore: matches.length ? Math.max(...matches.map(m => parseFloat(m.total_score) || 0)) : 0
  };

  const sorted = [...matches].sort((a, b) => sortBy === 'score' ? b.total_score - a.total_score : new Date(b.posted_at || 0) - new Date(a.posted_at || 0));

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Mis Match</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {matches.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} /><span style={{ fontSize: 13, color: '#16a34a', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>Perfil activo</span></div>}
          <span style={{ color: '#9ca3af', fontSize: 18 }}>🔔</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontFamily: 'Inter,sans-serif' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p>Cargando tus postulaciones...</p>
        </div>
      ) : matches.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 20, padding: 52, textAlign: 'center', border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📭</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Aun no te has postulado a ninguna oferta</h2>
          <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: 14, fontFamily: 'Inter,sans-serif' }}>Ve a <strong>Descubre</strong>, busca vacantes compatibles y aplica.</p>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>Tus postulaciones apareceran aqui automaticamente.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
            {[{ icon: '🚀', label: 'Postulaciones', value: stats.total }, { icon: '📈', label: 'Prom. Match', value: `${stats.avgScore}%` }, { icon: '⭐', label: 'Mejor Match', value: `${stats.topScore}%` }].map(s => (
              <div key={s.label} style={{ background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: 'Inter,sans-serif' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Tus postulaciones ({matches.length})</h2>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, fontFamily: 'Inter,sans-serif', color: '#374151', background: 'white', cursor: 'pointer', outline: 'none' }}>
              <option value="recent">Mas recientes</option>
              <option value="score">Mayor score</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sorted.map(m => (
              <MatchCard key={m.id} match={m} onAction={() => { }} expanded={expandedMatch === m.id} onToggle={() => setExpandedMatch(expandedMatch === m.id ? null : m.id)} readOnly={true} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const DiscoverPage = ({ user, onApplied }) => {
  const [jobs, setJobs] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [done, setDone] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [action, setAction] = useState(null); // 'apply' | 'discard'
  const [applying, setApplying] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

  const runSearch = async () => {
    setScoring(true); setDone(false); setJobs([]); setCurrentIdx(0);
    try {
      const [jobsData, profileData] = await Promise.all([
        api.get('/jobs?limit=30'),
        api.get('/profile')
      ]);
      const jobsList = jobsData.jobs || [];
      if (!jobsList.length) { setDone(true); setScoring(false); return; }
      const p = profileData.profile;
      const scoreRes = await fetch('/scoring/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            user_id: p.user_id || 'anon', city: p.city || '',
            available_to_relocate: p.available_to_relocate || false,
            relocation_cities: p.relocation_cities || [],
            work_modality: p.work_modality || ['presencial'],
            desired_salary_min: p.desired_salary_min || null,
            desired_salary_max: p.desired_salary_max || null,
            education_level: p.education_level || null,
            years_experience: p.years_experience || 0,
            experience_sectors: p.experience_sectors || [],
            technical_skills: p.technical_skills || [],
            soft_skills: p.soft_skills || [],
            languages: p.languages || [], bio: p.bio || ''
          },
          vacancies: jobsList.map(j => ({
            id: j.id, title: j.title, company_name: j.company_name,
            city: j.city, work_modality: j.work_modality, contract_type: j.contract_type,
            required_education: j.required_education,
            required_experience_years: j.required_experience_years || 0,
            required_skills: j.required_skills || [],
            preferred_skills: j.preferred_skills || [],
            salary_min: j.salary_min, salary_max: j.salary_max,
            description: j.description, category: j.category
          })),
          top_n: 30
        })
      });
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        const scoreMap = {};
        (scoreData.results || []).forEach(r => { scoreMap[r.job_id] = r; });
        const scored = jobsList
          .filter(j => scoreMap[j.id])
          .map(j => ({
            ...j,
            score: scoreMap[j.id].total_score,
            breakdown: scoreMap[j.id].breakdown,
            matched_skills: scoreMap[j.id].matched_skills || [],
            missing_skills: scoreMap[j.id].missing_skills || [],
            recommendation: scoreMap[j.id].recommendation || '',
          }))
          .sort((a, b) => b.score - a.score);
        setJobs(scored);
      }
    } catch (e) { console.error(e); }
    finally { setScoring(false); setDone(true); }
  };

  const applyJob = async (job) => {
    setApplying(true);
    try {
      await api.post('/matches/apply', {
        job_id: job.id,
        score: job.score,
        breakdown: job.breakdown,
        matched_skills: job.matched_skills || [],
        missing_skills: job.missing_skills || [],
      });
      if (onApplied) onApplied();
    } catch (e) { console.error(e); }
    finally { setApplying(false); }
  };

  const handleSwipe = async (dir) => {
    if (currentIdx >= jobs.length) return;
    const job = jobs[currentIdx];
    setAction(dir);
    await new Promise(r => setTimeout(r, 350));
    if (dir === 'apply') await applyJob(job);
    setAction(null);
    setDragX(0);
    setShowBreakdown(false);
    setCurrentIdx(i => i + 1);
  };

  // Drag handlers
  const onMouseDown = (e) => { setDragging(true); setDragStart(e.clientX); };
  const onMouseMove = (e) => { if (!dragging || !dragStart) return; setDragX(e.clientX - dragStart); };
  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX > 80) handleSwipe('apply');
    else if (dragX < -80) handleSwipe('discard');
    else setDragX(0);
    setDragStart(null);
  };
  const onTouchStart = (e) => { setDragging(true); setDragStart(e.touches[0].clientX); };
  const onTouchMove = (e) => { if (!dragging || !dragStart) return; setDragX(e.touches[0].clientX - dragStart); };
  const onTouchEnd = () => {
    setDragging(false);
    if (dragX > 80) handleSwipe('apply');
    else if (dragX < -80) handleSwipe('discard');
    else setDragX(0);
    setDragStart(null);
  };

  const current = jobs[currentIdx];
  const next = jobs[currentIdx + 1];
  const swipeProgress = Math.min(Math.abs(dragX) / 120, 1);
  const isRight = dragX > 0;
  const allSkills = current ? [
    ...(current.required_skills || []).map(s => ({ name: s.name || s, required: true })),
    ...(current.preferred_skills || []).map(s => ({ name: s.name || s, required: false }))
  ] : [];

  const scoreColor = current ? (current.score >= 80 ? '#16a34a' : current.score >= 60 ? '#ca8a04' : '#dc2626') : '#6b7280';
  const scoreBg = current ? (current.score >= 80 ? '#dcfce7' : current.score >= 60 ? '#fef9c3' : '#fee2e2') : '#f3f4f6';

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Descubre</h1>
        <button onClick={runSearch} disabled={scoring} style={{ padding: '10px 24px', background: scoring ? '#e5e7eb' : '#16a34a', border: 'none', borderRadius: 10, color: 'white', cursor: scoring ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'Inter,sans-serif', boxShadow: scoring ? 'none' : '0 4px 14px rgba(22,163,74,0.3)' }}>
          {scoring ? 'Buscando...' : done ? 'Nueva busqueda' : 'Buscar con IA'}
        </button>
      </div>

      {!done && !scoring && (
        <div style={{ background: 'white', borderRadius: 20, padding: 52, textAlign: 'center', border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Encuentra vacantes compatibles</h2>
          <p style={{ margin: '0 0 10px', color: '#6b7280', fontSize: 14, fontFamily: 'Inter,sans-serif' }}>La IA analiza tus habilidades y filtra solo las vacantes donde tienes posibilidades reales.</p>
          <p style={{ margin: '0 0 28px', color: '#9ca3af', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>Desliza a la derecha para aplicar, a la izquierda para descartar.</p>
          <button onClick={runSearch} style={{ padding: '13px 40px', background: '#16a34a', border: 'none', borderRadius: 12, color: 'white', fontSize: 15, fontWeight: 600, fontFamily: 'Inter,sans-serif', boxShadow: '0 4px 14px rgba(22,163,74,0.3)', cursor: 'pointer' }}>
            Buscar empleos ahora
          </button>
        </div>
      )}

      {scoring && (
        <div style={{ background: 'white', borderRadius: 20, padding: 52, textAlign: 'center', border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>⚡</div>
          <p style={{ color: '#374151', fontSize: 15, fontFamily: 'Inter,sans-serif', fontWeight: 600, margin: '0 0 8px' }}>Calculando compatibilidad con IA...</p>
          <p style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'Inter,sans-serif', margin: 0 }}>Analizando tus habilidades contra las vacantes disponibles</p>
        </div>
      )}

      {done && jobs.length === 0 && (
        <div style={{ background: 'white', borderRadius: 20, padding: 52, textAlign: 'center', border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🎯</div>
          <p style={{ color: '#374151', fontSize: 16, fontFamily: 'Inter,sans-serif', fontWeight: 600, margin: '0 0 8px' }}>No encontramos vacantes compatibles</p>
          <p style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'Inter,sans-serif', margin: '0 0 24px' }}>Agrega habilidades en tu Perfil para ver vacantes</p>
          <button onClick={runSearch} style={{ padding: '11px 28px', background: '#16a34a', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, fontFamily: 'Inter,sans-serif', cursor: 'pointer' }}>Intentar de nuevo</button>
        </div>
      )}

      {done && jobs.length > 0 && currentIdx >= jobs.length && (
        <div style={{ background: 'white', borderRadius: 20, padding: 52, textAlign: 'center', border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🎉</div>
          <p style={{ color: '#374151', fontSize: 16, fontFamily: 'Inter,sans-serif', fontWeight: 600, margin: '0 0 8px' }}>Revisaste todas las vacantes</p>
          <p style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'Inter,sans-serif', margin: '0 0 24px' }}>Ve a Mis Match para ver tus postulaciones</p>
          <button onClick={runSearch} style={{ padding: '11px 28px', background: '#16a34a', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, fontFamily: 'Inter,sans-serif', cursor: 'pointer' }}>Buscar mas vacantes</button>
        </div>
      )}

      {done && current && (
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(currentIdx / jobs.length) * 100}%`, background: '#16a34a', borderRadius: 999, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>{currentIdx + 1} / {jobs.length}</span>
          </div>

          {/* Instructions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#dc2626', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>← Descartar</span>
            <span style={{ fontSize: 12, color: '#16a34a', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>Aplicar →</span>
          </div>

          {/* Stack of cards */}
          <div style={{ position: 'relative', height: 580, userSelect: 'none' }}>
            {/* Card behind (next) */}
            {next && (
              <div style={{ position: 'absolute', inset: 0, background: 'white', borderRadius: 28, border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transform: 'scale(0.96) translateY(12px)', zIndex: 1 }} />
            )}

            {/* Current card */}
            <div
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
              style={{
                position: 'absolute', inset: 0, background: 'white', borderRadius: 28,
                boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                transform: action === 'apply' ? 'translateX(160%) rotate(18deg)' : action === 'discard' ? 'translateX(-160%) rotate(-18deg)' : `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
                transition: action ? 'transform 0.38s ease' : dragging ? 'none' : 'transform 0.25s ease',
                cursor: dragging ? 'grabbing' : 'grab',
                zIndex: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column'
              }}
            >
              {/* APPLY overlay */}
              {dragX > 20 && (
                <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 10, background: '#16a34a', color: 'white', borderRadius: 12, padding: '8px 18px', fontSize: 15, fontWeight: 800, fontFamily: 'Inter,sans-serif', opacity: Math.min(swipeProgress * 2, 1), letterSpacing: '0.05em', border: '3px solid white', transform: 'rotate(-15deg)' }}>
                  APLICAR ✓
                </div>
              )}
              {/* DISCARD overlay */}
              {dragX < -20 && (
                <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10, background: '#dc2626', color: 'white', borderRadius: 12, padding: '8px 18px', fontSize: 15, fontWeight: 800, fontFamily: 'Inter,sans-serif', opacity: Math.min(swipeProgress * 2, 1), letterSpacing: '0.05em', border: '3px solid white', transform: 'rotate(15deg)' }}>
                  DESCARTAR ✕
                </div>
              )}

              {/* Cover image / gradient header */}
              <div style={{ height: 140, background: `linear-gradient(135deg, ${colors[current.company_name?.charCodeAt(0) % colors.length]}dd, ${colors[(current.company_name?.charCodeAt(0) + 2) % colors.length]}aa)`, position: 'relative', flexShrink: 0 }}>
                {/* Decorative pattern */}
                <div style={{ position: 'absolute', inset: 0, opacity: 0.15, backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                {/* Company logo */}
                <div style={{ position: 'absolute', bottom: -22, left: 20, width: 48, height: 48, borderRadius: 14, background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: colors[current.company_name?.charCodeAt(0) % colors.length] }}>
                  {current.company_name?.charAt(0) || '?'}
                </div>
                {/* Score badge top right */}
                <div style={{ position: 'absolute', top: 14, right: 14, background: 'white', borderRadius: 50, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  <div style={{ position: 'relative', width: 36, height: 36 }}>
                    <svg width="36" height="36" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="18" cy="18" r="15" fill={scoreBg} stroke="#e5e7eb" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={scoreColor} strokeWidth="2.5" strokeDasharray={`${(current.score / 100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: scoreColor, fontFamily: 'Inter,sans-serif' }}>{Math.round(current.score)}%</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#9ca3af', fontFamily: 'Inter,sans-serif', lineHeight: 1 }}>MATCH</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor, fontFamily: 'Inter,sans-serif', lineHeight: 1.2 }}>{current.score >= 80 ? 'Excelente' : current.score >= 60 ? 'Bueno' : 'Regular'}</div>
                  </div>
                </div>
                {/* Category badge */}
                <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#374151', fontFamily: 'Inter,sans-serif' }}>
                  {current.category || current.company_sector || 'Tecnologia'}
                </div>
              </div>

              {/* Card body */}
              <div style={{ flex: 1, padding: '28px 20px 16px', overflowY: 'auto' }}>
                {/* Title & company */}
                <div style={{ marginBottom: 12 }}>
                  <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>{current.title}</h2>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b7280', fontFamily: 'Inter,sans-serif' }}>{current.company_name} · {current.work_modality === 'remoto' ? 'Remoto' : current.work_modality === 'hibrido' ? 'Hibrido' : 'Presencial'}</p>
                  {current.posted_at && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', fontFamily: 'Inter,sans-serif' }}>Hace {Math.floor((Date.now() - new Date(current.posted_at)) / 86400000)} dias · {current.contract_type === 'indefinido' ? 'Full-time' : current.contract_type}</p>}
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, fontFamily: 'Inter,sans-serif', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>{Math.round(current.score)}% — {current.score >= 80 ? 'Excelente' : current.score >= 60 ? 'Bueno' : 'Regular'}</div>
                  </div>
                  {current.salary_min && (
                    <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, fontFamily: 'Inter,sans-serif', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Salario</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>{formatCOP(current.salary_min)} - {formatCOP(current.salary_max)}</div>
                    </div>
                  )}
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, fontFamily: 'Inter,sans-serif', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ubicacion</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'Inter,sans-serif' }}>{current.city} {current.work_modality === 'remoto' ? '+ Remoto' : ''}</div>
                  </div>
                  {current.required_experience_years > 0 && (
                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, fontFamily: 'Inter,sans-serif', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Experiencia</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'Inter,sans-serif' }}>{current.required_experience_years} años requeridos</div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280', fontFamily: 'Inter,sans-serif', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{current.description}</p>

                {/* Skills */}
                {allSkills.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 700, color: '#374151', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Habilidades requeridas</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {allSkills.slice(0, 8).map(s => {
                        const isMatched = current.matched_skills?.includes(s.name);
                        return (
                          <span key={s.name} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, fontFamily: 'Inter,sans-serif', fontWeight: 600, background: isMatched ? '#dcfce7' : s.required ? '#fee2e2' : '#f3f4f6', color: isMatched ? '#16a34a' : s.required ? '#dc2626' : '#9ca3af', border: `1px solid ${isMatched ? '#bbf7d0' : s.required ? '#fca5a5' : '#e5e7eb'}` }}>
                            {isMatched ? '✓' : s.required ? '✕' : '+'} {s.name}
                          </span>
                        );
                      })}
                      {allSkills.length > 8 && <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'Inter,sans-serif', padding: '4px 6px' }}>+{allSkills.length - 8} mas</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 20 }}>
            <button onClick={() => handleSwipe('discard')} disabled={applying} style={{ width: 60, height: 60, borderRadius: '50%', background: 'white', border: '2px solid #fca5a5', cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(220,38,38,0.15)', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.1)'} onMouseLeave={e => e.target.style.transform = 'scale(1)'}>
              ✕
            </button>
            <button onClick={() => handleSwipe('apply')} disabled={applying} style={{ width: 72, height: 72, borderRadius: '50%', background: '#16a34a', border: 'none', cursor: applying ? 'default' : 'pointer', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px rgba(22,163,74,0.35)', transition: 'transform 0.15s', color: 'white' }}>
              {applying ? '⏳' : '✓'}
            </button>
            <button onClick={() => handleSwipe('discard')} disabled={applying} style={{ width: 60, height: 60, borderRadius: '50%', background: 'white', border: '2px solid #e5e7eb', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.15s' }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.1)'} onMouseLeave={e => e.target.style.transform = 'scale(1)'}>
              →
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', fontFamily: 'Inter,sans-serif', marginTop: 10 }}>
            Arrastra la tarjeta o usa los botones
          </p>
        </div>
      )}
    </div>
  );
};
const ProfilePage = ({ user }) => {
  const [profile, setProfile] = useState({ city: '', department: '', available_to_relocate: false, work_modality: ['presencial'], desired_salary_min: '', desired_salary_max: '', education_level: 'universitario', years_experience: 0, current_position: '', technical_skills: [], soft_skills: [], languages: [], bio: '', profile_completeness: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [newSkill, setNewSkill] = useState({ name: '', level: 3 });

  useEffect(() => { api.get('/profile').then(d => { const p = d.profile; setProfile({ city: p.city || '', department: p.department || '', available_to_relocate: p.available_to_relocate || false, relocation_cities: p.relocation_cities || [], work_modality: p.work_modality || ['presencial'], immediate_availability: p.immediate_availability !== false, desired_salary_min: p.desired_salary_min || '', desired_salary_max: p.desired_salary_max || '', salary_negotiable: p.salary_negotiable !== false, contract_types: p.contract_types || ['indefinido'], education_level: p.education_level || 'universitario', education_area: p.education_area || '', institution: p.institution || '', years_experience: p.years_experience || 0, current_position: p.current_position || '', current_company: p.current_company || '', experience_sectors: p.experience_sectors || [], technical_skills: p.technical_skills || [], soft_skills: p.soft_skills || [], languages: p.languages || [], bio: p.bio || '', linkedin_url: p.linkedin_url || '', profile_completeness: p.profile_completeness || 0 }); }).catch(console.error).finally(() => setLoading(false)); }, []);

  const saveProfile = async () => { setSaving(true); setSaveError(''); try { const d = await api.put('/profile', profile); if (d.profile) setProfile(prev => ({ ...prev, profile_completeness: d.profile.profile_completeness || prev.profile_completeness })); setSaved(true); setTimeout(() => setSaved(false), 3000); } catch (e) { setSaveError(e.message || 'Error al guardar.'); } finally { setSaving(false); } };
  const toggleModality = m => setProfile(p => { const cur = p.work_modality || []; return { ...p, work_modality: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] }; });
  const addSkill = () => { if (!newSkill.name.trim()) return; setProfile(p => ({ ...p, technical_skills: [...(p.technical_skills || []), { ...newSkill }] })); setNewSkill({ name: '', level: 3 }); };
  const removeSkill = i => setProfile(p => ({ ...p, technical_skills: p.technical_skills.filter((_, idx) => idx !== i) }));

  const inp = { width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box', color: '#111827', background: 'white' };
  const lbl = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, fontFamily: 'Inter,sans-serif' };
  const sec = { background: 'white', borderRadius: 16, padding: 24, marginBottom: 16, border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}><p style={{ color: '#9ca3af', fontFamily: 'Inter,sans-serif' }}>Cargando perfil...</p></div>;

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Mi Perfil</h1>
        <div style={{ ...sec, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 22, flexShrink: 0 }}>{user.full_name?.charAt(0) || 'U'}</div>
            <div style={{ flex: 1 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>{user.full_name}</h2><p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280', fontFamily: 'Inter,sans-serif' }}>{user.email}</p></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 26, fontWeight: 700, color: '#16a34a', fontFamily: 'Inter,sans-serif' }}>{profile.profile_completeness}%</div><div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'Inter,sans-serif' }}>Completitud</div><div style={{ width: 80, height: 5, background: '#bbf7d0', borderRadius: 999, marginTop: 5, overflow: 'hidden' }}><div style={{ height: '100%', width: `${profile.profile_completeness}%`, background: '#16a34a', borderRadius: 999 }} /></div></div>
          </div>
        </div>
        <div style={sec}>
          <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Ubicacion y disponibilidad</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={lbl}>Ciudad</label><input style={inp} value={profile.city} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))} placeholder="Bogota" /></div>
            <div><label style={lbl}>Departamento</label><input style={inp} value={profile.department} onChange={e => setProfile(p => ({ ...p, department: e.target.value }))} placeholder="Cundinamarca" /></div>
          </div>
          <div style={{ marginTop: 14 }}><label style={lbl}>Modalidad de trabajo</label><div style={{ display: 'flex', gap: 8 }}>{['presencial', 'remoto', 'hibrido'].map(m => <button key={m} onClick={() => toggleModality(m)} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Inter,sans-serif', border: 'none', background: profile.work_modality?.includes(m) ? '#16a34a' : '#f3f4f6', color: profile.work_modality?.includes(m) ? 'white' : '#6b7280', fontWeight: 500, textTransform: 'capitalize' }}>{m}</button>)}</div></div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" id="relocate" checked={profile.available_to_relocate} onChange={e => setProfile(p => ({ ...p, available_to_relocate: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16a34a' }} /><label htmlFor="relocate" style={{ ...lbl, margin: 0, cursor: 'pointer' }}>Disponible para traslado</label></div>
        </div>
        <div style={sec}>
          <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Expectativas laborales</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><label style={lbl}>Salario minimo (COP)</label><input type="number" style={inp} value={profile.desired_salary_min} onChange={e => setProfile(p => ({ ...p, desired_salary_min: parseInt(e.target.value) || '' }))} placeholder="4500000" /></div>
            <div><label style={lbl}>Salario maximo (COP)</label><input type="number" style={inp} value={profile.desired_salary_max} onChange={e => setProfile(p => ({ ...p, desired_salary_max: parseInt(e.target.value) || '' }))} placeholder="7000000" /></div>
            <div><label style={lbl}>Nivel educativo</label><select style={{ ...inp, cursor: 'pointer' }} value={profile.education_level} onChange={e => setProfile(p => ({ ...p, education_level: e.target.value }))}>{['bachillerato', 'tecnico', 'tecnologo', 'universitario', 'especializacion', 'maestria', 'doctorado'].map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            <div><label style={lbl}>Anos de experiencia</label><input type="number" style={inp} value={profile.years_experience} onChange={e => setProfile(p => ({ ...p, years_experience: parseInt(e.target.value) || 0 }))} min="0" max="40" /></div>
          </div>
        </div>
        <div style={sec}>
          <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Habilidades tecnicas</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, minHeight: 36 }}>
            {(profile.technical_skills || []).map((skill, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '5px 12px' }}>
                <span style={{ color: '#16a34a', fontSize: 13, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{skill.name}</span>
                <div style={{ display: 'flex', gap: 2 }}>{[1, 2, 3, 4, 5].map(n => <div key={n} style={{ width: 4, height: 4, borderRadius: '50%', background: n <= skill.level ? '#16a34a' : '#d1fae5' }} />)}</div>
                <button onClick={() => removeSkill(i)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>x</button>
              </div>
            ))}
            {(profile.technical_skills || []).length === 0 && <span style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>Agrega tus habilidades...</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Ej: React, Python, SQL..." value={newSkill.name} onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addSkill()} style={{ ...inp, flex: 1 }} />
            <select value={newSkill.level} onChange={e => setNewSkill(p => ({ ...p, level: parseInt(e.target.value) }))} style={{ ...inp, width: 'auto', minWidth: 110, cursor: 'pointer' }}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{['Basico', 'Elemental', 'Intermedio', 'Avanzado', 'Experto'][n - 1]}</option>)}</select>
            <button onClick={addSkill} style={{ padding: '10px 18px', background: '#16a34a', border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>+</button>
          </div>
        </div>
        <div style={sec}>
          <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: 'Inter,sans-serif' }}>Perfil profesional</h3>
          <label style={lbl}>Resumen</label>
          <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} rows={4} placeholder="Describe tu experiencia y lo que buscas profesionalmente..." style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
        </div>
        {saveError && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#dc2626', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>Error: {saveError}</div>}
        <button onClick={saveProfile} disabled={saving} style={{ width: '100%', padding: 14, background: saved ? '#15803d' : '#16a34a', border: 'none', borderRadius: 12, color: 'white', fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
          {saving ? 'Guardando...' : saved ? 'Perfil guardado correctamente' : 'Guardar perfil'}
        </button>
      </div>
    </div>
  );
};

const MessagesPage = ({ user }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const d = await api.get('/messages/conversations');
      setConversations(d.conversations || []);
    } catch (e) { console.error(e); }
    finally { setLoadingConvs(false); }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (convId) => {
    if (!convId) return;
    try {
      const d = await api.get(`/messages/${convId}`);
      setMessages(d.messages || []);
      // Mark as read
      api.patch(`/messages/${convId}/read`).catch(() => {});
    } catch (e) { console.error(e); }
    finally { setLoadingMsgs(false); }
  };

  useEffect(() => { fetchConversations(); }, []);

  // Poll conversations every 4s
  useEffect(() => {
    const iv = setInterval(fetchConversations, 4000);
    return () => clearInterval(iv);
  }, []);

  // Poll messages every 3s when a conversation is active
  useEffect(() => {
    if (!activeConv) return;
    setLoadingMsgs(true);
    fetchMessages(activeConv.id);
    const iv = setInterval(() => fetchMessages(activeConv.id), 3000);
    return () => clearInterval(iv);
  }, [activeConv?.id]);

  // Auto-scroll messages
  useEffect(() => {
    const el = document.getElementById('msg-scroll-container');
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Search users with debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const d = await api.get(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(d.users || []);
      } catch (e) { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Send message
  const handleSend = async () => {
    if (!msgInput.trim() || sending) return;
    setSending(true);
    try {
      const body = activeConv
        ? { conversation_id: activeConv.id, content: msgInput.trim() }
        : { recipient_id: activeConv?.other_user_id, content: msgInput.trim() };
      const d = await api.post('/messages', body);
      setMessages(prev => [...prev, d.message]);
      setMsgInput('');
      fetchConversations();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  // Start conversation with a searched user
  const startConversation = async (targetUser) => {
    // Check if conversation already exists
    const existing = conversations.find(c => c.other_user_id === targetUser.id);
    if (existing) {
      setActiveConv(existing);
      setShowSearch(false);
      setSearchQuery('');
      return;
    }
    // Create placeholder and open
    setActiveConv({
      id: null,
      other_user_id: targetUser.id,
      other_user_name: targetUser.full_name,
      other_user_email: targetUser.email,
      other_user_role: targetUser.role,
      other_user_city: targetUser.city,
      other_user_position: targetUser.current_position,
      unread_count: 0,
      last_message_text: null,
    });
    setMessages([]);
    setShowSearch(false);
    setSearchQuery('');
  };

  // Send first message to new conversation
  const handleSendNew = async () => {
    if (!msgInput.trim() || sending) return;
    setSending(true);
    try {
      const d = await api.post('/messages', { recipient_id: activeConv.other_user_id, content: msgInput.trim() });
      setMessages([d.message]);
      setMsgInput('');
      // Update activeConv with the real conversation_id
      setActiveConv(prev => ({ ...prev, id: d.conversation_id }));
      fetchConversations();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#16a34a', '#f97316'];
  const avatarColor = (name) => colors[(name || '').charCodeAt(0) % colors.length] || '#6b7280';

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString('es-CO', { weekday: 'short' });
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  };

  const f = 'Inter,sans-serif';

  return (
    <div style={{ flex: 1, display: 'flex', height: '100vh', overflow: 'hidden', background: '#f9fafb' }}>
      {/* ===== Conversation List Panel ===== */}
      <div style={{ width: 340, borderRight: '1px solid #e5e7eb', background: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827', fontFamily: f }}>Mensajes</h2>
            <button
              onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); setSearchResults([]); }}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: showSearch ? '#dcfce7' : '#f3f4f6', color: showSearch ? '#16a34a' : '#6b7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                transition: 'all 0.15s'
              }}
              title="Buscar personas"
            >
              {showSearch ? '✕' : '✎'}
            </button>
          </div>

          {/* Search panel */}
          {showSearch && (
            <div style={{ position: 'relative' }}>
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar personas por nombre o email..."
                style={{
                  width: '100%', padding: '10px 14px 10px 36px', border: '1px solid #e5e7eb', borderRadius: 10,
                  fontSize: 13, fontFamily: f, outline: 'none', boxSizing: 'border-box', background: '#f9fafb',
                  color: '#111827'
                }}
              />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
            </div>
          )}
        </div>

        {/* Search Results */}
        {showSearch && (
          <div style={{ flex: 1, overflowY: 'auto', borderBottom: '1px solid #f3f4f6' }}>
            {searching && (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontFamily: f, fontSize: 13 }}>Buscando...</div>
            )}
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontFamily: f, fontSize: 13 }}>No se encontraron personas</div>
            )}
            {searchResults.map(u => (
              <button
                key={u.id}
                onClick={() => startConversation(u)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                  border: 'none', borderBottom: '1px solid #f9fafb', background: 'white', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.1s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: avatarColor(u.full_name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0, fontFamily: f
                }}>
                  {u.full_name?.charAt(0) || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontFamily: f, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: f, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.current_position ? `${u.current_position}` : u.email}
                    {u.city ? ` · ${u.city}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, fontFamily: f, flexShrink: 0, background: '#f0fdf4', padding: '4px 10px', borderRadius: 999 }}>Mensaje</span>
              </button>
            ))}
          </div>
        )}

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontFamily: f, fontSize: 13 }}>Cargando conversaciones...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
              <p style={{ color: '#9ca3af', fontFamily: f, fontSize: 13, margin: 0 }}>No tienes conversaciones aún</p>
              <p style={{ color: '#d1d5db', fontFamily: f, fontSize: 12, margin: '6px 0 0' }}>Usa el botón ✎ para buscar personas</p>
            </div>
          ) : (
            conversations.map(c => {
              const isActive = activeConv?.id === c.id || activeConv?.other_user_id === c.other_user_id;
              const unread = parseInt(c.unread_count) || 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveConv(c)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                    border: 'none', borderBottom: '1px solid #f9fafb', cursor: 'pointer', textAlign: 'left',
                    background: isActive ? '#f0fdf4' : 'white',
                    borderLeft: isActive ? '3px solid #16a34a' : '3px solid transparent',
                    transition: 'all 0.12s'
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#fafafa'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'white'; }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%', background: avatarColor(c.other_user_name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 16, fontFamily: f
                    }}>
                      {c.other_user_name?.charAt(0) || '?'}
                    </div>
                    {unread > 0 && (
                      <div style={{
                        position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
                        background: '#16a34a', color: 'white', fontSize: 10, fontWeight: 700, fontFamily: f,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white'
                      }}>{unread > 9 ? '9+' : unread}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 600, color: '#111827', fontFamily: f, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.other_user_name}</span>
                      <span style={{ fontSize: 10, color: unread > 0 ? '#16a34a' : '#9ca3af', fontFamily: f, flexShrink: 0, marginLeft: 8, fontWeight: unread > 0 ? 600 : 400 }}>{formatTime(c.last_message_at)}</span>
                    </div>
                    <div style={{
                      fontSize: 12, color: unread > 0 ? '#374151' : '#9ca3af', fontFamily: f,
                      fontWeight: unread > 0 ? 500 : 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {c.last_message_text || 'Conversación iniciada'}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ===== Chat Panel ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
        {!activeConv ? (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, background: '#f0fdf4',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20
            }}>
              <span style={{ fontSize: 36 }}>💬</span>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: f }}>Selecciona una conversación</h3>
            <p style={{ margin: '0 0 20px', color: '#9ca3af', fontSize: 13, fontFamily: f, textAlign: 'center', maxWidth: 300 }}>
              Elige una conversación de la lista o busca personas para enviar un nuevo mensaje
            </p>
            <button
              onClick={() => setShowSearch(true)}
              style={{
                padding: '10px 24px', background: '#16a34a', border: 'none', borderRadius: 10,
                color: 'white', fontSize: 13, fontWeight: 600, fontFamily: f, cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(22,163,74,0.25)'
              }}
            >
              Buscar personas
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{
              padding: '14px 24px', borderBottom: '1px solid #e5e7eb', background: 'white',
              display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: avatarColor(activeConv.other_user_name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0, fontFamily: f
              }}>
                {activeConv.other_user_name?.charAt(0) || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontFamily: f }}>{activeConv.other_user_name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: f }}>
                  {activeConv.other_user_position || activeConv.other_user_role === 'recruiter' ? 'Reclutador' : 'Candidato'}
                  {activeConv.other_user_city ? ` · ${activeConv.other_user_city}` : ''}
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div id="msg-scroll-container" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {loadingMsgs ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontFamily: f, fontSize: 13 }}>Cargando mensajes...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                  <p style={{ color: '#9ca3af', fontFamily: f, fontSize: 13, margin: 0 }}>Inicia la conversación con {activeConv.other_user_name}</p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMine = m.sender_id === user.id;
                  const showDate = i === 0 || new Date(m.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString();
                  return (
                    <div key={m.id || i}>
                      {showDate && (
                        <div style={{ textAlign: 'center', margin: '12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                          <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: f, flexShrink: 0 }}>
                            {new Date(m.created_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                        <div style={{
                          maxWidth: '70%', padding: '10px 16px', borderRadius: 18,
                          borderBottomRightRadius: isMine ? 4 : 18,
                          borderBottomLeftRadius: isMine ? 18 : 4,
                          background: isMine ? '#16a34a' : 'white',
                          color: isMine ? 'white' : '#111827',
                          boxShadow: isMine ? '0 1px 4px rgba(22,163,74,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
                          border: isMine ? 'none' : '1px solid #f0f0f0'
                        }}>
                          <p style={{ margin: 0, fontSize: 13, fontFamily: f, lineHeight: 1.5, wordBreak: 'break-word' }}>{m.content}</p>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                            <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.7)' : '#9ca3af', fontFamily: f }}>
                              {new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                              {isMine && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message input */}
            <div style={{ padding: '12px 24px 16px', borderTop: '1px solid #e5e7eb', background: 'white', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <textarea
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      activeConv.id ? handleSend() : handleSendNew();
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  style={{
                    flex: 1, padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: 12,
                    fontSize: 14, fontFamily: f, outline: 'none', resize: 'none', color: '#111827',
                    background: '#f9fafb', lineHeight: 1.5, maxHeight: 100, boxSizing: 'border-box'
                  }}
                />
                <button
                  onClick={activeConv.id ? handleSend : handleSendNew}
                  disabled={!msgInput.trim() || sending}
                  style={{
                    width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: msgInput.trim() && !sending ? 'pointer' : 'default',
                    background: msgInput.trim() ? '#16a34a' : '#e5e7eb',
                    color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.15s',
                    boxShadow: msgInput.trim() ? '0 2px 8px rgba(22,163,74,0.3)' : 'none'
                  }}
                >
                  {sending ? '⏳' : '➤'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const AuthPage = ({ mode, onLogin, onSwitch }) => {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', document_number: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isLogin = mode === 'login';
  const handleSubmit = async e => { e.preventDefault(); setLoading(true); setError(''); try { const d = await api.post(isLogin ? '/auth/login' : '/auth/register', form); api.setToken(d.token); onLogin(d.user); } catch (err) { if (isLogin && (form.email === 'demo@empleabilidad.co' || form.password === 'demo123')) { api.token = 'demo-token'; onLogin({ id: 'demo', email: 'demo@empleabilidad.co', full_name: 'Usuario Demo', role: 'candidate' }); } else { setError(err.message); } } finally { setLoading(false); } };
  const inp = { width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box', color: '#111827' };
  const lbl = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, fontFamily: 'Inter,sans-serif' };
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={linkworkMark} alt="M de LinkWork" style={{ width: 48, height: 48, margin: '0 auto 16px', display: 'block' }} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>LinkWork</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14, fontFamily: 'Inter,sans-serif' }}>Tu carrera. Tu ritmo. Tu match.</p>
        </div>
        <div style={{ background: 'white', borderRadius: 20, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f0f0f0' }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: 'Inter,sans-serif' }}>{isLogin ? 'Iniciar sesion' : 'Crear cuenta'}</h2>
          {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13, fontFamily: 'Inter,sans-serif' }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            {!isLogin && <div style={{ marginBottom: 14 }}><label style={lbl}>Nombre completo</label><input style={inp} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Juan Perez" required /></div>}
            <div style={{ marginBottom: 14 }}><label style={lbl}>Correo electronico</label><input type="email" style={inp} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={isLogin ? 'demo@empleabilidad.co' : 'tu@email.com'} required /></div>
            <div style={{ marginBottom: isLogin ? 20 : 14 }}><label style={lbl}>Contrasena</label><input type="password" style={inp} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={isLogin ? 'demo123' : 'Minimo 8 caracteres'} required /></div>
            {!isLogin && <><div style={{ marginBottom: 14 }}><label style={lbl}>Cedula</label><input style={inp} value={form.document_number} onChange={e => setForm(p => ({ ...p, document_number: e.target.value }))} placeholder="1234567890" /></div><div style={{ marginBottom: 20 }}><label style={lbl}>Telefono</label><input style={inp} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="3001234567" /></div></>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: loading ? '#e5e7eb' : '#16a34a', border: 'none', borderRadius: 10, color: 'white', fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif', boxShadow: loading ? 'none' : '0 4px 14px rgba(22,163,74,0.3)' }}>
              {loading ? 'Cargando...' : isLogin ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, margin: '20px 0 0', fontFamily: 'Inter,sans-serif' }}>
            {isLogin ? 'No tienes cuenta? ' : 'Ya tienes cuenta? '}
            <button onClick={onSwitch} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>{isLogin ? 'Registrate' : 'Inicia sesion'}</button>
          </p>
          {isLogin && <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}><p style={{ margin: 0, color: '#16a34a', fontSize: 11, fontFamily: 'Inter,sans-serif' }}>Demo: demo@empleabilidad.co / demo123</p></div>}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [activePage, setActivePage] = useState('matches');
  const [loading, setLoading] = useState(true);
  const [matchCount, setMatchCount] = useState(0);
  const [matchRefreshKey, setMatchRefreshKey] = useState(0);

  const refreshMatchCount = () => {
    api.get('/matches/today').then(r => setMatchCount(r.matches?.length || 0)).catch(() => { });
  };

  useEffect(() => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'; document.head.appendChild(link);
    const token = localStorage.getItem('token');
    if (token) { api.req('GET', '/auth/me').then(d => { setUser(d.user); refreshMatchCount(); }).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false)); }
    else { setLoading(false); }
  }, []);

  const handleLogin = u => { setUser(u); refreshMatchCount(); };
  const handleLogout = () => { api.setToken(null); setUser(null); };

  const handleApplied = () => {
    setMatchCount(c => c + 1);
    setMatchRefreshKey(k => k + 1);
  };

  // Refresh matches when navigating to the matches page
  const handleSetActivePage = (page) => {
    setActivePage(page);
    if (page === 'matches') {
      setMatchRefreshKey(k => k + 1);
      refreshMatchCount();
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ textAlign: 'center' }}><img src={linkworkMark} alt="M de LinkWork" style={{ width: 40, height: 40, margin: '0 auto 12px', display: 'block' }} /><p style={{ color: '#9ca3af', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>Cargando...</p></div></div>;

  if (!user) return <AuthPage mode={authMode} onLogin={handleLogin} onSwitch={() => setAuthMode(m => m === 'login' ? 'register' : 'login')} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <Sidebar user={user} activePage={activePage} setActivePage={handleSetActivePage} onLogout={handleLogout} matchCount={matchCount} />
      <div style={{ marginLeft: 220, flex: 1, display: 'flex' }}>
        {activePage === 'matches' && <MatchesPage user={user} refreshKey={matchRefreshKey} />}
        {activePage === 'discover' && <DiscoverPage user={user} onApplied={handleApplied} />}
        {activePage === 'profile' && <ProfilePage user={user} />}
        {activePage === 'messages' && <MessagesPage user={user} />}
      </div>
    </div>
  );
}
