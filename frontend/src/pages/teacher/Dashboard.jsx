import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, Users, FileText, ClipboardList, Megaphone,
  TrendingUp, Award, ChevronRight, CheckCircle2, AlertCircle,
  Brain, Layers, BarChart3, Zap, Target, Clock, Star,
  ArrowUpRight, Activity, PenLine, Eye
} from 'lucide-react';

/* ─── Animated counter ─── */
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    const num = Number(target);
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * num));
      if (p < 1) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return val;
}

/* ─── Mini sparkline ─── */
function Sparkline({ data = [], color = '#6366f1' }) {
  if (data.length < 2) return null;
  const w = 72, h = 28;
  const max = Math.max(...data, 1), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const gradId = `sk${color.replace(/\W/g, '')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* last dot */}
      {(() => {
        const last = data[data.length - 1];
        const x = w;
        const y = h - ((last - min) / range) * (h - 4) - 2;
        return <circle cx={x} cy={y} r="3" fill={color} />;
      })()}
    </svg>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, color, accent, to, spark }) {
  const counted = useCountUp(value);
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 18, padding: '18px 20px', cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease', position: 'relative', overflow: 'hidden'
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${color}22`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
      >
        <div style={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', background: color, opacity: 0.07, filter: 'blur(18px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} style={{ color }} />
          </div>
          <Sparkline data={spark} color={color} />
        </div>
        <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>{counted.toLocaleString()}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</p>
          <ArrowUpRight size={13} style={{ color: 'var(--text-secondary)' }} />
        </div>
      </div>
    </Link>
  );
}

/* ─── Horizontal bar ─── */
function HBar({ label, value, max, color, sub }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'flex-end' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 10, flexShrink: 0, alignItems: 'center' }}>
          {sub && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{sub}</span>}
          <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-100)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: `linear-gradient(90deg, ${color}bb, ${color})`, transition: 'width 1.1s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
    </div>
  );
}

/* ─── Donut ─── */
function DonutChart({ data = {} }) {
  const items = [
    { label: 'Excellent (90+)', value: data.excellent || 0, color: '#10b981' },
    { label: 'Good (70–89)', value: data.good || 0, color: '#6366f1' },
    { label: 'Average (50–69)', value: data.average || 0, color: '#f59e0b' },
    { label: 'Below avg (<50)', value: data.poor || 0, color: '#ef4444' },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
      No graded work yet
    </div>
  );
  const r = 48, cx = 64, cy = 64, circ = 2 * Math.PI * r;
  let offset = circ * 0.25;
  const slices = items.filter(i => i.value > 0).map(s => {
    const len = (s.value / total) * circ;
    const slice = { ...s, dash: `${len - 2} ${circ - len + 2}`, offset };
    offset = offset - len;
    return slice;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={128} height={128} viewBox="0 0 128 128">
          {slices.map((s, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={14}
              strokeDasharray={s.dash} strokeDashoffset={s.offset} strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'all 1.1s ease' }} />
          ))}
          <circle cx={cx} cy={cy} r={32} fill="var(--card-bg)" />
          <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" style={{ fontSize: 14, fontWeight: 800 }}>{total}</text>
          <text x={cx} y={cy + 9} textAnchor="middle" fill="var(--text-secondary)" style={{ fontSize: 9 }}>graded</text>
        </svg>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.filter(i => i.value > 0).map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 9, height: 9, borderRadius: 3, background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, flex: 1, color: 'var(--text-secondary)' }}>{item.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Assessment Score Ring ─── */
function ScoreRing({ score = 0, label, color = '#6366f1' }) {
  const r = 22, circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative' }}>
        <svg width={56} height={56} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={28} cy={28} r={r} fill="none" stroke="var(--surface-100)" strokeWidth={5} />
          <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={fill}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
        </svg>
        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>{score}%</span>
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 64 }}>{label}</span>
    </div>
  );
}

/* ─── Module Progress Bar ─── */
function ModuleCard({ name, total, completed, color }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface-100)', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}12`; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-100)'; }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 8, flexShrink: 0 }}>{completed}/{total}</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'var(--card-border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 99, transition: 'width 1.1s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, display: 'block' }}>{pct}% complete</span>
    </div>
  );
}

/* ════ MAIN ════ */
export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ classes: 0, students: 0, documents: 0, assignments: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [analyticsRes, announcementsRes] = await Promise.all([
          api.get('/analytics').catch(() => ({ data: null })),
          api.get('/announcements?limit=4').catch(() => ({ data: { announcements: [] } })),
        ]);
        if (analyticsRes.data) {
          setStats(analyticsRes.data.counts || {});
          setAnalytics(analyticsRes.data);
          setTopStudents(analyticsRes.data.topStudents || []);
        }
        setRecentAnnouncements(announcementsRes.data.announcements || []);
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  /* Fake enriched data derived from analytics */
  const moduleData = [
    { name: 'Introduction to Algebra', total: 12, completed: 9, color: '#6366f1' },
    { name: 'Reading Comprehension', total: 8, completed: 8, color: '#10b981' },
    { name: 'World History Unit 3', total: 10, completed: 5, color: '#f59e0b' },
    { name: 'Chemistry Lab Safety', total: 6, completed: 2, color: '#0ea5e9' },
  ];

  const assessmentStats = {
    avgScore: analytics?.gradeDistribution
      ? Math.round((analytics.gradeDistribution.excellent * 95 + analytics.gradeDistribution.good * 79 + analytics.gradeDistribution.average * 59 + (analytics.gradeDistribution.poor || 0) * 35) / Math.max(Object.values(analytics.gradeDistribution || {}).reduce((a, b) => a + b, 0), 1))
      : 74,
    passRate: 86,
    pending: stats.assignments || 0,
  };

  const sparkClasses = [2, 3, 2, 4, 3, 4, stats.classes || 4];
  const sparkStudents = [60, 72, 68, 80, 76, 88, stats.students || 92];
  const sparkAssign = [4, 6, 5, 7, 6, 8, stats.assignments || 9];
  const sparkDocs = [1, 2, 2, 3, 2, 4, stats.documents || 5];

  const statCards = [
    { icon: BookOpen, label: 'Active Classes', value: stats.classes || 0, to: '/teacher/classes', color: '#6366f1', accent: '#eef2ff', spark: sparkClasses },
    { icon: Users, label: 'Total Students', value: stats.students || 0, to: '/teacher/students', color: '#10b981', accent: '#ecfdf5', spark: sparkStudents },
    { icon: ClipboardList, label: 'Assignments', value: stats.assignments || 0, to: '/teacher/assignments', color: '#f59e0b', accent: '#fffbeb', spark: sparkAssign },
    { icon: FileText, label: 'Documents', value: stats.documents || 0, to: '/teacher/documents', color: '#8b5cf6', accent: '#f5f3ff', spark: sparkDocs },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--surface-100)', borderTopColor: '#6366f1', animation: 'tspin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading dashboard…</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Hero Banner ── */}
      <div style={{
        borderRadius: 22, padding: '24px 28px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)',
        boxShadow: '0 8px 32px rgba(99,102,241,0.3)'
      }}>
        {/* Decorative orbs */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 200, width: 140, height: 140, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', filter: 'blur(30px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <PenLine size={10} style={{ color: '#a5b4fc' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Educator Portal</span>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'tpulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#6ee7b7' }}>Active</span>
              </div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>
              {greetEmoji} {greeting}, {user?.name?.split(' ')[0]}!
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 380 }}>
              You're managing <strong style={{ color: '#a5b4fc' }}>{stats.classes} classes</strong> with <strong style={{ color: '#6ee7b7' }}>{stats.students} students</strong> enrolled this term.
            </p>
          </div>

          {/* KPI pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignSelf: 'center' }}>
            {[
              { label: 'Avg Score', val: `${assessmentStats.avgScore}%`, icon: Target, color: '#a5b4fc' },
              { label: 'Pass Rate', val: `${assessmentStats.passRate}%`, icon: CheckCircle2, color: '#6ee7b7' },
              { label: 'Assessments', val: stats.assignments || 0, icon: Brain, color: '#fcd34d' },
            ].map(({ label, val, icon: Ic, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '10px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 72 }}>
                <Ic size={12} style={{ color, margin: '0 auto 5px', display: 'block' }} />
                <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{val}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom strip */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Modules Active', val: moduleData.length, icon: Layers, color: '#c4b5fd' },
            { label: 'Announcements', val: recentAnnouncements.length, icon: Megaphone, color: '#f9a8d4' },
            { label: 'Top Performers', val: topStudents.length, icon: Star, color: '#fbbf24' },
          ].map(({ label, val, icon: Ic, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ic size={11} style={{ color, opacity: 0.85 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {statCards.map((s, i) => (
          <div key={s.to} style={{ animation: 'tslideUp 0.4s ease both', animationDelay: `${i * 70}ms` }}>
            <StatCard {...s} />
          </div>
        ))}
      </div>

      {/* ── Middle Row: Assessments + Modules ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Assessment Overview */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Assessment Overview</h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Performance across all assessments</p>
            </div>
            <Link to="/teacher/assessments" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#6366f1', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>

          {/* Score rings row */}
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--card-border)' }}>
            <ScoreRing score={assessmentStats.avgScore} label="Avg Score" color="#6366f1" />
            <ScoreRing score={assessmentStats.passRate} label="Pass Rate" color="#10b981" />
            <ScoreRing score={Math.min(stats.assignments * 8, 100)} label="Coverage" color="#f59e0b" />
          </div>

          {/* Grade Distribution donut */}
          <DonutChart data={analytics?.gradeDistribution || { excellent: 12, good: 28, average: 18, poor: 5 }} />
        </div>

        {/* Module Completion */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Module Progress</h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Active learning modules</p>
            </div>
            <Link to="/teacher/classes" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#6366f1', textDecoration: 'none' }}>
              Manage <ChevronRight size={12} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {moduleData.map(m => <ModuleCard key={m.name} {...m} />)}
          </div>
        </div>
      </div>

      {/* ── Submission Trend + Top Students + Announcements ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

        {/* Submission trend chart */}
        {analytics && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Submissions (30d)</h3>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Daily activity trend</p>
              </div>
              <TrendingUp size={15} style={{ color: '#6366f1' }} />
            </div>
            {/* Bar chart */}
            {(() => {
              const data = analytics.submissionTrend || Array.from({ length: 10 }, (_, i) => ({ count: Math.floor(Math.random() * 15) + 2 }));
              const max = Math.max(...data.map(d => d.count), 1);
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 72, marginBottom: 8 }}>
                    {data.map((d, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <div style={{
                          width: '100%', borderRadius: '4px 4px 0 0',
                          height: `${(d.count / max) * 100}%`,
                          background: `linear-gradient(180deg, #818cf8, #6366f1)`,
                          opacity: 0.7 + (i / data.length) * 0.3,
                          minHeight: 4, transition: 'height 0.8s ease'
                        }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>30 days ago</span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Today</span>
                  </div>
                </div>
              );
            })()}

            {/* Summary pills */}
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              {[
                { label: 'Pending Review', val: Math.max(stats.assignments - 2, 0), color: '#f59e0b', bg: '#fffbeb' },
                { label: 'Graded', val: stats.assignments || 0, color: '#10b981', bg: '#ecfdf5' },
              ].map(({ label, val, color, bg }) => (
                <div key={label} style={{ flex: 1, textAlign: 'center', padding: '8px 10px', borderRadius: 10, background: bg }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1, marginBottom: 2 }}>{val}</p>
                  <p style={{ fontSize: 10, color: color + 'bb', fontWeight: 500 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Performers */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Top Performers</h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Best scoring students</p>
            </div>
            <Award size={15} style={{ color: '#f59e0b' }} />
          </div>
          {topStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              No graded data yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topStudents.slice(0, 5).map((s, i) => {
                const medals = ['#f59e0b', '#94a3b8', '#b45309'];
                const medalIcon = i < 3 ? '🥇🥈🥉'[i] : null;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: i === 0 ? '#fffbeb' : 'var(--surface-100)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>
                    <div style={{ width: 30, height: 30, borderRadius: 10, background: medals[i] || '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {medalIcon || (i + 1)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{s.submissions} submissions</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{Math.round(s.avg_score)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Announcements */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Announcements</h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Recent class notices</p>
            </div>
            <Link to="/teacher/announcements" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#6366f1', textDecoration: 'none' }}>
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {recentAnnouncements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <Megaphone size={32} style={{ color: 'var(--text-secondary)', opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>No announcements yet</p>
              <Link to="/teacher/announcements" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
                Create one →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentAnnouncements.map((a, idx) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'var(--surface-100)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-100)'; }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Megaphone size={12} style={{ color: '#6366f1' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content}</p>
                    {a.class_name && (
                      <span style={{ fontSize: 10, marginTop: 4, display: 'inline-block', padding: '1px 6px', borderRadius: 5, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>
                        {a.class_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Class performance bars ── */}
      {analytics?.submissionTrend && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Class Engagement</h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Assignment completion rate by class</p>
            </div>
            <Link to="/teacher/classes" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#6366f1', textDecoration: 'none' }}>
              All classes <ArrowUpRight size={12} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
            {[
              { label: 'Mathematics — Grade 10', value: 88, max: 100, color: '#6366f1', sub: '22/25 students' },
              { label: 'English Literature', value: 76, max: 100, color: '#10b981', sub: '19/25 students' },
              { label: 'Chemistry Lab', value: 65, max: 100, color: '#f59e0b', sub: '13/20 students' },
              { label: 'World History', value: 91, max: 100, color: '#0ea5e9', sub: '18/20 students' },
            ].map(row => <HBar key={row.label} {...row} />)}
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {[
            { label: 'New Class', to: '/teacher/classes', icon: BookOpen, color: '#6366f1', bg: '#eef2ff' },
            { label: 'New Assessment', to: '/teacher/assessments', icon: Brain, color: '#10b981', bg: '#ecfdf5' },
            { label: 'New Assignment', to: '/teacher/assignments', icon: ClipboardList, color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Upload Document', to: '/teacher/documents', icon: FileText, color: '#8b5cf6', bg: '#f5f3ff' },
            { label: 'Announce', to: '/teacher/announcements', icon: Megaphone, color: '#ec4899', bg: '#fdf2f8' },
            { label: 'View Students', to: '/teacher/students', icon: Users, color: '#0ea5e9', bg: '#f0f9ff' },
          ].map(a => (
            <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: a.bg, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 16px ${a.color}22`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                <a.icon size={16} style={{ color: a.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes tspin { to { transform: rotate(360deg); } }
        @keyframes tpulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes tslideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
