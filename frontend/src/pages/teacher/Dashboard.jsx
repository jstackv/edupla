import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, Users, FileText, ClipboardList, Megaphone,
  TrendingUp, Award, ChevronRight, BarChart2, Layers,
  BookMarked, ArrowUpRight, Flame, Target, Zap,
  GraduationCap, Bell, CheckCircle2,
  UserCheck, MessageSquare, Timer, Radar as RadarIcon, Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';

/* Names are stored "SURNAME Givenname" — greet by the name people go by. */
const displayFirstName = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1];
};

/* ─── Animated counter ─── */
function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const end = Number(value) || 0;
    prev.current = end;
    if (start === end) return;
    const steps = 40;
    const step = (end - start) / steps;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplay(Math.round(start + step * i));
      if (i >= steps) { clearInterval(t); setDisplay(end); }
    }, duration / steps);
    return () => clearInterval(t);
  }, [value, duration]);
  return display;
}

/* ─── Live ticking clock (hero flourish) ─── */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>
      {hh}:{mm}<span style={{ opacity: 0.5, animation: 'clockBlink 1s step-start infinite' }}>:{ss}</span>
    </span>
  );
}

/* ─── Pulse ring (hero badge) ─── */
function PulseRing({ color }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, position: 'relative', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', inset: -3, borderRadius: '50%',
        border: `2px solid ${color}`, opacity: 0.4,
        animation: 'pulseRing 1.8s ease-out infinite',
      }} />
    </span>
  );
}

/* ─── Arc progress ring, now with hover breakdown tooltip ─── */
function ArcProgress({ value, max, size = 88, stroke = 9, color = '#818cf8' }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, (value || 0) / Math.max(max || 1, 1));
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(99,102,241,0.1)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${pct * circ} ${circ}`}
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.34,1.56,.64,1)' }} />
    </svg>
  );
}

/* ─── Donut ring ─── */
function DonutRing({ segments, size = 96, stroke = 11 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, i) => s + i.value, 0) || 1;
  let offset = 0;
  const slices = segments.map(s => {
    const len = (s.value / total) * circ;
    const sl = { ...s, dash: `${Math.max(0, len - 2)} ${circ - Math.max(0, len - 2)}`, offset: circ - offset };
    offset += len;
    return sl;
  });
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(99,102,241,0.08)" strokeWidth={stroke} />
      {slices.filter(s => s.value > 0).map((s, i) => (
        <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
          stroke={s.color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={s.dash} strokeDashoffset={s.offset}
          style={{ transition: `stroke-dashoffset 1.4s cubic-bezier(.34,1.56,.64,1) ${i * 120}ms` }} />
      ))}
    </svg>
  );
}

/* ─── Stat card, with cursor-tilt + gradient-border hover ─── */
function StatCard({ icon: Icon, label, value, color, bg, to, sub }) {
  const ref = useRef(null);
  const [hov, setHov] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -6, y: px * 6 });
  }, []);

  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div
        ref={ref}
        className="card"
        style={{
          transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${hov ? -3 : 0}px)`,
          boxShadow: hov ? `0 14px 30px rgba(0,0,0,0.1), 0 0 0 1px ${color}30` : '0 1px 3px rgba(0,0,0,0.04)',
          transition: hov ? 'transform 0.08s linear, box-shadow 0.2s ease' : 'transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease',
          cursor: 'pointer', position: 'relative', overflow: 'hidden', willChange: 'transform',
        }}
        onMouseEnter={() => setHov(true)}
        onMouseMove={onMove}
        onMouseLeave={() => { setHov(false); setTilt({ x: 0, y: 0 }); }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 60, height: 60,
          background: `radial-gradient(circle at top right, ${color}${hov ? '28' : '18'} 0%, transparent 70%)`,
          pointerEvents: 'none', transition: 'background 0.25s ease',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: hov ? 'scale(1.12) rotate(-6deg)' : 'scale(1) rotate(0deg)',
            transition: 'transform 0.3s cubic-bezier(.34,1.56,.64,1)',
          }}>
            <Icon size={16} style={{ color }} />
          </div>
          <ArrowUpRight size={13} style={{ color: hov ? color : 'var(--text-secondary)', transition: 'color 0.2s, transform 0.25s ease', transform: hov ? 'translate(2px,-2px)' : 'translate(0,0)', marginTop: 2 }} />
        </div>
        <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 3, fontVariantNumeric: 'tabular-nums' }}>
          <AnimatedNumber value={value} />
        </p>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, opacity: 0.6 }}>{sub}</p>}
      </div>
    </Link>
  );
}

/* ─── Status badge ─── */
function StatusBadge({ status }) {
  const map = {
    draft:     { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Draft' },
    submitted: { bg: 'rgba(245,158,11,0.12)', color: '#d97706', label: 'Submitted' },
    approved:  { bg: 'rgba(16,185,129,0.12)', color: '#059669', label: 'Approved' },
    rejected:  { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626', label: 'Rejected' },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0, letterSpacing: '0.04em' }}>
      {s.label}
    </span>
  );
}

/* ─── Section header ─── */
function SectionHeader({ title, to, linkLabel = 'All' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>{title}</h3>
      {to && (
        <Link to={to} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: '#818cf8', textDecoration: 'none', opacity: 0.85 }}>
          {linkLabel} <ChevronRight size={11} />
        </Link>
      )}
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ icon: Icon, msg, action, actionTo }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
      <Icon size={26} style={{ margin: '0 auto 8px', opacity: 0.2, display: 'block' }} />
      <p>{msg}</p>
      {action && <Link to={actionTo} style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', fontWeight: 600, marginTop: 5, display: 'inline-block' }}>{action} →</Link>}
    </div>
  );
}

/* ─── Custom recharts tooltip, themed to match the app ─── */
function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 10,
      padding: '8px 12px', boxShadow: '0 10px 26px rgba(0,0,0,0.14)', fontSize: 11,
    }}>
      <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.stroke || p.fill, fontWeight: 600 }}>{p.name}: {p.value}{unit}</p>
      ))}
    </div>
  );
}

const ACCENT = ['#818cf8','#34d399','#fbbf24','#f87171','#a78bfa','#22d3ee'];

/* ══ MAIN ══ */
export default function TeacherDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics]           = useState(null);
  const [announcements, setAnnouncements]   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [gradeTab, setGradeTab]             = useState('assignments');
  const [visible, setVisible]               = useState(false);

  /* hero pointer-driven spotlight + parallax, mirrors/extends the student hero */
  const heroRef = useRef(null);
  const [heroPos, setHeroPos] = useState({ x: 50, y: 40 });
  const [heroHov, setHeroHov] = useState(false);
  const onHeroMove = useCallback((e) => {
    const el = heroRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHeroPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dayName  = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr  = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const firstName = displayFirstName(user?.name);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, annRes] = await Promise.all([
        api.get('/analytics').catch(() => ({ data: null })),
        api.get('/announcements?limit=3').catch(() => ({ data: { announcements: [] } })),
      ]);
      if (aRes.data) setAnalytics(aRes.data);
      setAnnouncements(annRes.data?.announcements || []);
      setLoading(false);
      setTimeout(() => setVisible(true), 50);
    })();
  }, []);

  const c = analytics?.counts || {};
  const as = analytics?.assessmentStats || {};

  const gradeData = gradeTab === 'assignments'
    ? analytics?.gradeDistribution || {}
    : analytics?.assessmentGradeDistribution || {};

  const gradeSections = [
    { label: 'Excellent ≥75%', value: gradeData.excellent || 0, color: '#34d399' },
    { label: 'Good ≥60%',      value: gradeData.good || 0,      color: '#818cf8' },
    { label: 'Average ≥40%',   value: gradeData.average || 0,   color: '#fbbf24' },
    { label: 'Below 40%',      value: gradeData.poor || 0,      color: '#f87171' },
  ];
  const gradeTotal = gradeSections.reduce((s, i) => s + i.value, 0);

  const pendingCount = as.pending || 0;
  const approvedCount = as.approved || 0;
  const rejectedCount = as.rejected || 0;
  const totalAssess = c.assessments || 0;
  const approvalRate = totalAssess ? Math.round((approvedCount / totalAssess) * 100) : 0;

  /* ── Submission trend → smooth area chart data ── */
  const trendData = useMemo(() => (analytics?.submissionTrend || []).map((d, i) => ({
    label: d.date ? new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Day ${i + 1}`,
    Submissions: d.count || 0,
  })), [analytics]);
  const trendTotal = trendData.reduce((s, d) => s + d.Submissions, 0);

  /* ── Assignments vs Assessments grade radar — a comparison the student
     dashboard doesn't have, since only teachers see both distributions. ── */
  const radarData = useMemo(() => {
    const gA = analytics?.gradeDistribution || {};
    const gQ = analytics?.assessmentGradeDistribution || {};
    const totalA = (gA.excellent || 0) + (gA.good || 0) + (gA.average || 0) + (gA.poor || 0);
    const totalQ = (gQ.excellent || 0) + (gQ.good || 0) + (gQ.average || 0) + (gQ.poor || 0);
    return {
      hasData: totalA > 0 || totalQ > 0,
      points: [
        { metric: 'Excellent', Assignments: totalA ? Math.round((gA.excellent || 0) / totalA * 100) : 0, Assessments: totalQ ? Math.round((gQ.excellent || 0) / totalQ * 100) : 0 },
        { metric: 'Good',      Assignments: totalA ? Math.round((gA.good || 0) / totalA * 100) : 0,      Assessments: totalQ ? Math.round((gQ.good || 0) / totalQ * 100) : 0 },
        { metric: 'Average',   Assignments: totalA ? Math.round((gA.average || 0) / totalA * 100) : 0,   Assessments: totalQ ? Math.round((gQ.average || 0) / totalQ * 100) : 0 },
        { metric: 'Below 40%', Assignments: totalA ? Math.round((gA.poor || 0) / totalA * 100) : 0,      Assessments: totalQ ? Math.round((gQ.poor || 0) / totalQ * 100) : 0 },
      ],
    };
  }, [analytics]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: 16 }}>
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(129,140,248,0.15)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#818cf8', animation: 'spin 0.9s linear infinite' }} />
        <GraduationCap size={18} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#818cf8' }} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Preparing your dashboard…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* cardStyle only adds animation — background/border/radius come from className="card" */
  const cardStyle = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.5s ease, transform 0.5s ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Hero ── */}
      <div
        ref={heroRef}
        onMouseMove={onHeroMove}
        onMouseEnter={() => setHeroHov(true)}
        onMouseLeave={() => setHeroHov(false)}
        style={{
          borderRadius: 22, padding: '22px 26px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #2d2a6e 40%, #4338ca 75%, #6366f1 100%)',
          backgroundSize: '160% 160%', animation: 'heroGradientDrift 18s ease-in-out infinite',
          position: 'relative', overflow: 'hidden',
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 0.45s ease, transform 0.45s ease, box-shadow 0.35s ease',
          boxShadow: heroHov ? '0 22px 60px rgba(99,102,241,0.38)' : '0 16px 48px rgba(99,102,241,0.28)',
        }}>
        {/* pointer spotlight */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(460px circle at ${heroPos.x}% ${heroPos.y}%, rgba(255,255,255,0.09), transparent 60%)`,
          opacity: heroHov ? 1 : 0, transition: 'opacity 0.35s ease',
        }} />
        {/* decorative circles, gently parallaxed */}
        {[['-40px','-40px',200,0.05,0.1],[null,'-20px',140,0.04,-0.07],['20px',null,100,0.06,0.05]].map(([t, r, s, o, pf], i) => (
          <div key={i} style={{
            position: 'absolute', top: t || 'auto', right: r || 'auto', bottom: i === 2 ? '-20px' : 'auto', left: i === 2 ? '30%' : 'auto',
            width: s, height: s, borderRadius: '50%', background: `rgba(255,255,255,${o})`, pointerEvents: 'none',
            transform: `translate(${(heroPos.x - 50) * pf}px, ${(heroPos.y - 50) * pf}px)`, transition: 'transform 0.3s ease-out',
          }} />
        ))}
        {/* shimmer line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', position: 'relative', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <PulseRing color="#34d399" />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{dayName}, {dateStr}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>·</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}><LiveClock /></span>
            </div>
            <h2 className="teacher-hero-greeting" style={{
              fontSize: 22, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em',
              backgroundImage: 'linear-gradient(100deg, #ffffff 30%, #c7d2fe 45%, #ffffff 60%)',
              backgroundSize: '220% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              animation: 'heroTextShine 5.5s ease-in-out infinite',
            }}>
              {greeting}, {firstName} <span style={{ display: 'inline-block', animation: 'heroWave 2.2s ease-in-out infinite', transformOrigin: '70% 70%' }}>👋</span>
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
              {c.classes || 0} classes &nbsp;·&nbsp; {c.students || 0} students &nbsp;·&nbsp; {c.modules || 0} modules
            </p>
          </div>

          {/* hero stat pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {[
              { label: 'Assessments',    val: totalAssess,    color: '#a5b4fc', icon: ClipboardList },
              { label: 'Pending Review', val: pendingCount,   color: '#fcd34d', icon: Flame },
              { label: 'Approved',       val: approvedCount,  color: '#6ee7b7', icon: CheckCircle2 },
            ].map(({ label, val, color, icon: Icon }) => (
              <div key={label} className="hero-pill-t" style={{
                padding: '10px 16px', borderRadius: 14, textAlign: 'center',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
              }}>
                <Icon size={13} style={{ color, marginBottom: 4, display: 'block', margin: '0 auto 4px' }} />
                <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  <AnimatedNumber value={val} />
                </p>
                <p style={{ fontSize: 10, color, marginTop: 3, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* approval progress bar */}
        {totalAssess > 0 && (
          <div style={{ marginTop: 18, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Approval progress</span>
              <span style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 700 }}>{approvalRate}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'linear-gradient(90deg, #6ee7b7, #34d399)',
                width: `${approvalRate}%`,
                transition: 'width 1.2s cubic-bezier(.34,1.56,.64,1)',
                boxShadow: approvalRate > 0 ? '0 0 10px rgba(110,231,183,0.5)' : 'none',
              }} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes heroGradientDrift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes heroTextShine { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes heroWave { 0%,100% { transform: rotate(0deg); } 15% { transform: rotate(16deg); } 30% { transform: rotate(-8deg); } 45% { transform: rotate(14deg); } 60% { transform: rotate(0deg); } }
        @keyframes clockBlink { 50% { opacity: 0.15; } }
        .hero-pill-t { transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), background 0.22s ease; }
        .hero-pill-t:hover { transform: translateY(-2px); background: rgba(255,255,255,0.13) !important; }
        @media (prefers-reduced-motion: reduce) {
          .teacher-hero-greeting, [style*="heroGradientDrift"], [style*="heroTextShine"], [style*="heroWave"] { animation: none !important; }
        }
      `}</style>

      {/* ── Stat Cards (decluttered: Announcements / Assignments / Discussion Groups
          moved out — they're still one click away via Quick Actions and their own
          sections below, so the grid stays scannable) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.5s ease 0.08s, transform 0.5s ease 0.08s',
      }}>
        <StatCard icon={BookOpen}      label="Active Classes"      value={c.classes || 0}       color="#818cf8" bg="rgba(129,140,248,0.1)" to="/teacher/classes" />
        <StatCard icon={Users}         label="Total Students"      value={c.students || 0}      color="#34d399" bg="rgba(52,211,153,0.1)"  to="/teacher/students" />
        <StatCard icon={Layers}        label="Modules"             value={c.modules || 0}       color="#a78bfa" bg="rgba(167,139,250,0.1)" to="/teacher/assessments-grade" sub="assigned courses" />
        <StatCard icon={ClipboardList} label="Assessments"         value={c.assessments || 0}   color="#fbbf24" bg="rgba(251,191,36,0.1)"  to="/teacher/assessments-grade" />
        <StatCard icon={BookMarked}    label="Documents"           value={c.documents || 0}     color="#f472b6" bg="rgba(244,114,182,0.1)" to="/teacher/documents" />
        <StatCard icon={UserCheck}     label="Attendance Sessions" value={c.attendanceSessions || 0} color="#14b8a6" bg="rgba(20,184,166,0.1)" to="/teacher/attendance" />
        <StatCard icon={Timer}         label="Online Quizzes"      value={c.onlineAssessments || 0} color="#8b5cf6" bg="rgba(139,92,246,0.1)" to="/teacher/assessments" sub="shared with students" />
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>

        {/* Submission Trend — now a real animated area chart */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.12s' }}>
          <SectionHeader title="Assignment Submissions" />
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -10, marginBottom: 6, opacity: 0.7 }}>Last 30 days · daily activity</p>
          {trendData.length === 0 ? (
            <EmptyState icon={TrendingUp} msg="No submissions yet" />
          ) : (
            <>
              <div style={{ width: '100%', height: 150 }}>
                <ResponsiveContainer>
                  <AreaChart data={trendData} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="teacherTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={22} />
                    <Tooltip content={<ChartTooltip unit=" subs" />} />
                    <Area type="monotone" dataKey="Submissions" stroke="#818cf8" strokeWidth={2.5}
                      fill="url(#teacherTrendFill)" dot={false}
                      activeDot={{ r: 5, fill: '#818cf8', stroke: '#fff', strokeWidth: 2 }} animationDuration={1100} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7 }}>{trendTotal} total</span>
                <TrendingUp size={14} style={{ color: '#818cf8', opacity: 0.7 }} />
              </div>
            </>
          )}
        </div>

        {/* Grade Distribution */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.16s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Grade Distribution</h3>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(129,140,248,0.08)', borderRadius: 8, padding: 2 }}>
              {['assignments','assessments'].map(tab => (
                <button key={tab} onClick={() => setGradeTab(tab)} style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: gradeTab === tab ? '#818cf8' : 'transparent',
                  color: gradeTab === tab ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease', textTransform: 'capitalize',
                }}>{tab}</button>
              ))}
            </div>
          </div>
          {gradeTotal === 0
            ? <EmptyState icon={BarChart2} msg="No graded work yet" />
            : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <DonutRing segments={gradeSections} size={96} stroke={11} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{gradeTotal}</p>
                    <p style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 1 }}>graded</p>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {gradeSections.filter(s => s.value > 0).map((s, i) => (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {s.value} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({Math.round((s.value / gradeTotal) * 100)}%)</span>
                        </span>
                      </div>
                      <div style={{ height: 3, borderRadius: 3, background: 'rgba(129,140,248,0.1)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3, background: s.color,
                          width: `${(s.value / gradeTotal) * 100}%`,
                          transition: `width 1s cubic-bezier(.34,1.56,.64,1) ${i * 100}ms`,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* NEW — Assignments vs Assessments radar comparison */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <RadarIcon size={14} style={{ color: '#22d3ee' }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Assignments vs Assessments</h3>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, opacity: 0.7 }}>Grade-band shape, side by side</p>
          {!radarData.hasData ? (
            <EmptyState icon={RadarIcon} msg="Grade both to compare" />
          ) : (
            <div style={{ width: '100%', height: 190 }}>
              <ResponsiveContainer>
                <RadarChart data={radarData.points} outerRadius="70%">
                  <PolarGrid stroke="var(--card-border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: 'var(--text-secondary)' }} tickCount={3} />
                  <Radar name="Assignments" dataKey="Assignments" stroke="#818cf8" fill="#818cf8" fillOpacity={0.28} strokeWidth={2} animationDuration={1000} />
                  <Radar name="Assessments" dataKey="Assessments" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.22} strokeWidth={2} animationDuration={1000} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip unit="%" />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Performance overview row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>

        {/* Approval rate ring, now with hover breakdown */}
        <ApprovalRateCard
          style={{ ...cardStyle, transitionDelay: '0.24s' }}
          approvalRate={approvalRate} approvedCount={approvedCount} totalAssess={totalAssess}
          pendingCount={pendingCount} rejectedCount={rejectedCount}
        />

        {/* Pending alerts */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.28s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={13} style={{ color: '#fbbf24' }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Needs Attention</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { label: 'Pending Review', val: pendingCount, color: '#fbbf24' },
              { label: 'Ungraded Work', val: (c.assignments || 0), color: '#f87171' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 10, background: `${item.color}0f`, transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = `${item.color}1c`}
                onMouseLeave={e => e.currentTarget.style.background = `${item.color}0f`}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top metric */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.32s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(129,140,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={13} style={{ color: '#818cf8' }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Class Snapshot</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { label: 'Avg students/class', val: c.classes ? Math.round((c.students || 0) / c.classes) : 0 },
              { label: 'Modules per class',  val: c.classes ? Math.round((c.modules || 0) / c.classes) : 0 },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 10, background: 'rgba(129,140,248,0.06)', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(129,140,248,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(129,140,248,0.06)'}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#818cf8', fontVariantNumeric: 'tabular-nums' }}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Assessments + My Modules ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>

        {/* Recent Assessments */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.36s' }}>
          <SectionHeader title="Recent Assessments" to="/teacher/assessments-grade" />
          {!analytics?.recentAssessments?.length
            ? <EmptyState icon={ClipboardList} msg="No assessments yet" action="Start here" actionTo="/teacher/assessments-grade" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {analytics.recentAssessments.map((a, i) => (
                  <div key={a.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 12,
                    background: 'rgba(129,140,248,0.04)', border: '1px solid rgba(129,140,248,0.08)',
                    transition: 'background 0.18s, transform 0.18s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.08)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.04)'; e.currentTarget.style.transform = ''; }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${ACCENT[i % ACCENT.length]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: ACCENT[i % ACCENT.length], letterSpacing: '0.04em' }}>{(a.type || '?').substring(0, 3).toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.course_name || a.type}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.8 }}>{a.class_name} · {a.term} {a.academic_year}</p>
                    </div>
                    <StatusBadge status={a.status || 'draft'} />
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* My Modules */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.4s' }}>
          <SectionHeader title="My Modules" to="/teacher/assessments-grade" />
          {!analytics?.moduleSummary?.length
            ? <EmptyState icon={Layers} msg="No modules assigned yet" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {analytics.moduleSummary.map((m, i) => (
                  <div key={m.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 12,
                    transition: 'background 0.15s, transform 0.15s', cursor: 'default',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.05)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.transform = ''; }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${ACCENT[i % ACCENT.length]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <BookMarked size={13} style={{ color: ACCENT[i % ACCENT.length] }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.75 }}>{m.category}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: 'rgba(129,140,248,0.1)', color: '#818cf8', fontWeight: 700 }}>{m.classCount} cls</span>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, background: 'rgba(52,211,153,0.1)', color: '#34d399', fontWeight: 700 }}>{m.studentCount} stu</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* ── Top Students + Announcements ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>

        {/* Top Performers */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.44s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Top Performers</h3>
            <Award size={14} style={{ color: '#fbbf24' }} />
          </div>
          {!analytics?.topStudents?.length
            ? <EmptyState icon={Award} msg="No graded submissions yet" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {analytics.topStudents.map((s, i) => {
                  const medalColors = [
                    'linear-gradient(135deg,#fbbf24,#f59e0b)',
                    'linear-gradient(135deg,#94a3b8,#64748b)',
                    'linear-gradient(135deg,#b45309,#92400e)',
                    'linear-gradient(135deg,#818cf8,#6366f1)',
                    'linear-gradient(135deg,#34d399,#10b981)',
                  ];
                  const scoreColor = s.avg_score >= 75 ? '#34d399' : s.avg_score >= 60 ? '#818cf8' : '#fbbf24';
                  return (
                    <div key={i} className="top-performer-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px', borderRadius: 10, transition: 'background 0.18s, transform 0.18s' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0, background: medalColors[i] }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <div style={{ flex: 1, height: 3, borderRadius: 3, background: 'rgba(129,140,248,0.1)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.round(s.avg_score)}%`, borderRadius: 3, background: scoreColor, transition: `width 1s cubic-bezier(.34,1.56,.64,1) ${i * 80}ms` }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{Math.round(s.avg_score)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* Announcements */}
        <div className="card" style={{ ...cardStyle, transitionDelay: '0.48s' }}>
          <SectionHeader title="Recent Announcements" to="/teacher/announcements" linkLabel="View all" />
          {announcements.length === 0
            ? <EmptyState icon={Megaphone} msg="No announcements yet" action="Create one" actionTo="/teacher/announcements" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {announcements.map((a, i) => (
                  <div key={a.id || a._id} style={{ display: 'flex', gap: 10, padding: '9px 11px', borderRadius: 12, background: `${ACCENT[i % ACCENT.length]}07`, border: `1px solid ${ACCENT[i % ACCENT.length]}15`, transition: 'background 0.18s' }}
                    onMouseEnter={e => e.currentTarget.style.background = `${ACCENT[i % ACCENT.length]}12`}
                    onMouseLeave={e => e.currentTarget.style.background = `${ACCENT[i % ACCENT.length]}07`}>
                    <div style={{ width: 5, borderRadius: 3, background: ACCENT[i % ACCENT.length], flexShrink: 0, opacity: 0.7 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{a.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8 }}>{a.content}</p>
                      {a.class_name && (
                        <span style={{ fontSize: 9, marginTop: 5, display: 'inline-block', padding: '2px 8px', borderRadius: 5, background: 'rgba(129,140,248,0.1)', color: '#818cf8', fontWeight: 700, letterSpacing: '0.04em' }}>
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

      {/* ── Quick Actions ── */}
      <div className="card" style={{ ...cardStyle, transitionDelay: '0.52s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Zap size={14} style={{ color: '#fbbf24' }} />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Quick Actions</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 9 }}>
          {[
            { label: 'New Assignment', to: '/teacher/assignments',       icon: ClipboardList, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
            { label: 'Grade Work',     to: '/teacher/assessments-grade', icon: BarChart2,     color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
            { label: 'Take Attendance', to: '/teacher/attendance',       icon: UserCheck,     color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
            { label: 'Online Quiz',    to: '/teacher/assessments',       icon: Timer,         color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
            { label: 'Documents',      to: '/teacher/documents',         icon: FileText,      color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
            { label: 'Announce',       to: '/teacher/announcements',     icon: Megaphone,     color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
            { label: 'My Classes',     to: '/teacher/classes',           icon: BookOpen,      color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
            { label: 'Groups & DMs',   to: '/teacher/groups',            icon: MessageSquare, color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
          ].map((a) => (
            <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px',
                borderRadius: 13, background: a.bg, border: `1px solid ${a.color}20`,
                transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease',
                cursor: 'pointer',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 16px ${a.color}22`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                <a.icon size={14} style={{ color: a.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{a.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseRing {
          0%   { transform: scale(1); opacity: 0.4; }
          70%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .top-performer-row:hover { background: rgba(129,140,248,0.06); transform: translateX(2px); }
      `}</style>
    </div>
  );
}

/* ─── Approval rate card, split out so it can carry its own hover state ─── */
function ApprovalRateCard({ style, approvalRate, approvedCount, totalAssess, pendingCount, rejectedCount }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="card" style={{ ...style, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'default' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, alignSelf: 'flex-start' }}>Approval Rate</p>
      <div style={{ position: 'relative' }}>
        <ArcProgress value={approvedCount} max={totalAssess} size={80} stroke={8} color="#34d399" />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{approvalRate}%</p>
        </div>
      </div>
      <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{approvedCount} of {totalAssess} approved</p>

      {/* hover breakdown */}
      <div style={{
        position: 'absolute', bottom: 10, left: '50%', transform: `translateX(-50%) translateY(${hov ? 0 : 6}px)`,
        opacity: hov ? 1 : 0, pointerEvents: 'none', transition: 'opacity 0.2s ease, transform 0.2s ease',
        display: 'flex', gap: 6, background: 'var(--card-border)', borderRadius: 10, padding: '5px 9px',
      }}>
        <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700 }}>{pendingCount} pending</span>
        <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>·</span>
        <span style={{ fontSize: 9, color: '#f87171', fontWeight: 700 }}>{rejectedCount} rejected</span>
      </div>
    </div>
  );
}