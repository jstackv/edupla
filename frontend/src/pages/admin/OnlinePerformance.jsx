import { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Laptop2, ChevronLeft, Users, GraduationCap, BookOpen, ClipboardCheck,
  CheckCircle2, XCircle, Clock, ArrowRight, Search, TrendingUp, Mail,
} from 'lucide-react';

/* ─────────── Helpers ─────────── */
function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function pctColor(pct) {
  if (pct == null) return '#9ca3af';
  if (pct >= 70) return '#059669';
  if (pct >= 50) return '#b45309';
  return '#dc2626';
}

/* ─────────── Small building blocks ─────────── */
function Crumb({ onHome, homeLabel, trail }) {
  return (
    <div className="aop-crumb">
      <button type="button" className="aop-crumb-btn" onClick={onHome}>
        <ChevronLeft size={14} /> {homeLabel}
      </button>
      {trail.map((t, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="aop-crumb-sep">/</span>
          {t.onClick ? (
            <button type="button" className="aop-crumb-btn" onClick={t.onClick}>{t.label}</button>
          ) : (
            <span className="aop-crumb-current">{t.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function SkeletonGrid({ count = 4, height = 150 }) {
  return (
    <div className="aop-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aop-skel" style={{ height }} />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="aop-empty">
      <div className="aop-empty-icon"><Icon size={24} /></div>
      <p style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14.5 }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{subtitle}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function AdminOnlinePerformance() {
  const [step, setStep] = useState('classes'); // classes | teachers | assessments | results
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');

  const [selectedClass, setSelectedClass] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(false);

  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);

  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    api.get('/assessment/admin/online/classes')
      .then(r => setClasses(r.data.classes || []))
      .catch(() => toast.error('Failed to load classes'))
      .finally(() => setLoading(false));
  }, []);

  function openClass(cls) {
    setSelectedClass(cls);
    setStep('teachers');
    setTeachersLoading(true);
    api.get(`/assessment/admin/online/classes/${cls.id}/teachers`)
      .then(r => setTeachers(r.data.teachers || []))
      .catch(() => toast.error('Failed to load teachers'))
      .finally(() => setTeachersLoading(false));
  }

  function openTeacher(teacher) {
    setSelectedTeacher(teacher);
    setStep('assessments');
    setAssessmentsLoading(true);
    const teacherParam = teacher.id || 'unassigned';
    api.get(`/assessment/admin/online/classes/${selectedClass.id}`, { params: { teacher_id: teacherParam } })
      .then(r => setAssessments(r.data.assessments || []))
      .catch(() => toast.error('Failed to load assessments'))
      .finally(() => setAssessmentsLoading(false));
  }

  function openAssessment(a) {
    setSelectedAssessment(a);
    setStep('results');
    setResultsLoading(true);
    api.get(`/assessment/admin/online/assessments/${a.id}`)
      .then(r => setResults(r.data))
      .catch(() => toast.error('Failed to load performance'))
      .finally(() => setResultsLoading(false));
  }

  function goHome() {
    setStep('classes'); setSelectedClass(null); setTeachers([]);
    setSelectedTeacher(null); setAssessments([]); setSelectedAssessment(null); setResults(null);
  }
  function backToTeachers() {
    setStep('teachers'); setSelectedTeacher(null); setAssessments([]); setSelectedAssessment(null); setResults(null);
  }
  function backToAssessments() {
    setStep('assessments'); setSelectedAssessment(null); setResults(null);
  }

  const filteredClasses = classes.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  function backToClassTeachers() {
    setStep('teachers'); setSelectedTeacher(null); setAssessments([]); setSelectedAssessment(null); setResults(null);
  }

  const crumbTrail = [];
  if (selectedClass) {
    crumbTrail.push({ label: selectedClass.name, onClick: step !== 'teachers' ? backToClassTeachers : null });
  }
  if (selectedTeacher) {
    crumbTrail.push({ label: selectedTeacher.name, onClick: step === 'results' ? backToAssessments : null });
  }
  if (selectedAssessment) {
    crumbTrail.push({ label: selectedAssessment.title, onClick: null });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Hero header ── */}
      <div className="aop-hero">
        <div className="aop-hero-orb a" />
        <div className="aop-hero-orb b" />
        <div className="aop-hero-orb c" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
          <div className="aop-hero-icon"><Laptop2 size={22} color="#fff" /></div>
          <div className="aop-hero-title">
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Online Assessment Performance</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              See how students performed in the quizzes they've taken online.
            </p>
          </div>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      {step !== 'classes' && (
        <Crumb onHome={goHome} homeLabel="Classes" trail={crumbTrail} />
      )}

      {/* ═══ STEP 1: Choose a class ═══ */}
      {step === 'classes' && (
        <>
          <div className="aop-search">
            <Search size={15} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search class…" />
          </div>

          {loading ? (
            <SkeletonGrid count={5} />
          ) : filteredClasses.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No classes yet" subtitle="Create a class to see online assessment performance here." />
          ) : (
            <div className="aop-grid">
              {filteredClasses.map((c, i) => (
                <button key={c.id} className="aop-class-card" style={{ '--i': i }} onClick={() => openClass(c)}>
                  <div className="aop-class-banner">
                    <div className="aop-class-shine" />
                    <div className="aop-class-badge"><BookOpen size={12} /> Class</div>
                    <div className="aop-class-name">{c.name}</div>
                    {(c.level || c.trade) && (
                      <div className="aop-class-sub">{[c.level, c.trade].filter(Boolean).join(' • ')}</div>
                    )}
                  </div>
                  <div className="aop-class-foot">
                    <span className="aop-class-foot-item"><Users size={13} /> {c.student_count} students</span>
                    <span className="aop-class-foot-item accent"><ClipboardCheck size={13} /> {c.quiz_assessment_count} online</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ STEP 2: Choose a teacher ═══ */}
      {step === 'teachers' && (
        teachersLoading ? (
          <SkeletonGrid count={4} height={150} />
        ) : teachers.length === 0 ? (
          <EmptyState icon={Users} title="No teacher has shared a quiz yet" subtitle="Once a teacher shares an online assessment to this class, they'll appear here." />
        ) : (
          <div className="aop-grid">
            {teachers.map((t, i) => (
              <button key={t.id || 'unassigned'} className="aop-teacher-card" style={{ '--i': i }} onClick={() => openTeacher(t)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="aop-teacher-avatar">{initials(t.name)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="aop-teacher-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>
                    {t.email && (
                      <p className="aop-teacher-email" style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Mail size={10} /> {t.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="aop-teacher-stats">
                  <div className="aop-teacher-stat">
                    <div className="aop-teacher-stat-num">{t.assessment_count}</div>
                    <div className="aop-teacher-stat-label">Quizzes</div>
                  </div>
                  <div className="aop-teacher-stat">
                    <div className="aop-teacher-stat-num">{t.attempted_total}</div>
                    <div className="aop-teacher-stat-label">Attempts</div>
                  </div>
                  <div className="aop-teacher-stat">
                    <div className="aop-teacher-stat-num" style={{ color: pctColor(t.average_percentage) }}>
                      {t.average_percentage != null ? `${t.average_percentage}%` : '—'}
                    </div>
                    <div className="aop-teacher-stat-label">Avg score</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ═══ STEP 3: Assessments for the chosen teacher ═══ */}
      {step === 'assessments' && (
        assessmentsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="aop-skel" style={{ height: 74 }} />)}
          </div>
        ) : assessments.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No online assessments yet" subtitle="This teacher hasn't shared an online quiz to this class so far." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assessments.map((a, i) => (
              <button key={a.id} className="aop-assess-row" style={{ '--i': i }} onClick={() => openAssessment(a)}>
                <div style={{ minWidth: 180 }}>
                  <p className="aop-assess-title">{a.title}</p>
                  <p className="aop-assess-sub">{a.module_name} • {a.term} {a.academic_year}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <div className="aop-assess-metric">
                    <div className="aop-assess-metric-num" style={{ color: 'var(--text-primary)' }}>{a.attempted_count}/{a.total_students}</div>
                    <div className="aop-assess-metric-label">Attempted</div>
                  </div>
                  <div className="aop-assess-metric">
                    <div className="aop-assess-metric-num" style={{ color: pctColor(a.average_percentage) }}>{a.average_percentage != null ? `${a.average_percentage}%` : '—'}</div>
                    <div className="aop-assess-metric-label">Avg score</div>
                  </div>
                  <div className="aop-assess-metric">
                    <div className="aop-assess-metric-num" style={{ color: '#059669' }}>{a.passed_count}</div>
                    <div className="aop-assess-metric-label">Passed</div>
                  </div>
                  <div className="aop-assess-arrow"><ArrowRight size={15} /></div>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ═══ STEP 4: Per-student results ═══ */}
      {step === 'results' && (
        resultsLoading ? (
          <div className="aop-skel" style={{ height: 340 }} />
        ) : !results ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="aop-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              {[
                { label: 'Students', value: results.rows.length, icon: Users, color: '#c2410c' },
                { label: 'Attempted', value: results.rows.filter(r => r.status !== 'not_attempted').length, icon: ClipboardCheck, color: '#0ea5e9' },
                { label: 'Passed (C)', value: results.rows.filter(r => r.decision === 'C').length, icon: CheckCircle2, color: '#10b981' },
                { label: 'Not Competent', value: results.rows.filter(r => r.decision === 'NYC').length, icon: XCircle, color: '#ef4444' },
              ].map(({ label, value, icon: Icon, color }, i) => (
                <div key={label} className="aop-stat-chip" style={{ '--i': i }}>
                  <div className="aop-stat-chip-icon" style={{ background: color + '18' }}>
                    <Icon size={17} style={{ color }} />
                  </div>
                  <div>
                    <div className="aop-stat-chip-num">{value}</div>
                    <div className="aop-stat-chip-label">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="aop-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="aop-table">
                <thead>
                  <tr>
                    {['Student', 'Attempts', 'Best Score', '%', 'Marks /MW', 'Decision', 'Status'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map(r => (
                    <tr key={r.student_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div className="aop-row-avatar">{initials(r.student_name)}</div>
                          <div>
                            <p style={{ fontWeight: 700 }}>{r.student_name}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.student_email}</p>
                          </div>
                        </div>
                      </td>
                      <td>{r.attempts_used}</td>
                      <td>{r.best_score != null ? `${r.best_score}/${r.max_marks}` : '—'}</td>
                      <td style={{ fontWeight: 800, color: pctColor(r.percentage) }}>{r.percentage != null ? `${r.percentage}%` : '—'}</td>
                      <td>{r.marks_on_mw != null ? `${r.marks_on_mw}/${r.module_weight}` : '—'}</td>
                      <td>
                        {r.decision ? (
                          <span className="aop-pill" style={{ background: r.decision === 'C' ? '#05966918' : '#dc262618', color: r.decision === 'C' ? '#059669' : '#dc2626' }}>
                            {r.decision}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {r.status === 'not_attempted' && <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> Not attempted</span>}
                        {r.status === 'submitted' && <span style={{ fontSize: 11.5, color: '#b45309', fontWeight: 700 }}>Submitted</span>}
                        {r.status === 'needs_grading' && <span style={{ fontSize: 11.5, color: '#b45309', fontWeight: 700 }}>Needs grading</span>}
                        {r.status === 'graded' && <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><TrendingUp size={12} /> Graded</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
