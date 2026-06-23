import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  BookMarked, ClipboardList, FileText, Megaphone,
  Clock, CheckCircle2, AlertTriangle, ChevronRight,
  Award, Calendar, Flame, Sparkles, GraduationCap, Mail,
  TrendingUp, Star, Zap, BookOpen, Target, ArrowUpRight,
  BarChart3, Trophy, Bell, ChevronDown,
} from 'lucide-react';

/* ── Helpers ── */
const LEVEL_CLASSES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
];
const getCategoryClass = (val) => LEVEL_CLASSES[(val?.charCodeAt(0) || 0) % LEVEL_CLASSES.length];
const initials = (name) => name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';

/* ── Animated counter ── */
function AnimatedNumber({ value, suffix = '', duration = 900 }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const end = Number(value) || 0;
    const start = prev.current;
    prev.current = end;
    if (start === end) return;
    const steps = 36;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplay(Math.round(start + (end - start) * (i / steps)));
      if (i >= steps) { clearInterval(t); setDisplay(end); }
    }, duration / steps);
    return () => clearInterval(t);
  }, [value, duration]);
  return <>{display}{suffix}</>;
}

/* ── Completion ring ── */
function ProgressRing({ percent, size = 96, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </svg>
  );
}

/* ── Mini score bar ── */
function ScoreBar({ percent, color = '#34d399' }) {
  return (
    <div style={{ height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        height: '100%', borderRadius: 4, background: color,
        width: `${percent}%`,
        transition: 'width 1.1s cubic-bezier(0.34,1.56,0.64,1)',
      }} />
    </div>
  );
}

/* ── Streak flame badge ── */
function StreakBadge({ count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
      <Flame className="w-3.5 h-3.5" style={{ color: '#fcd34d' }} />
      {count}-day streak
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, color, iconBg, to, sublabel, animateNum, suffix = '' }) {
  const [hov, setHov] = useState(false);
  return (
    <Link to={to} className="stat-card group" style={{ textDecoration: 'none', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 64, height: 64,
        background: `radial-gradient(circle at top right, ${color}18 0%, transparent 70%)`,
        pointerEvents: 'none', transition: 'opacity 0.2s',
        opacity: hov ? 1 : 0.4,
      }} />
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-primary-500 transition-colors" />
      </div>
      <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {animateNum ? <AnimatedNumber value={value} suffix={suffix} /> : <>{value}{suffix}</>}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {sublabel && <p className="text-xs text-muted/70 flex-shrink-0 badge">{sublabel}</p>}
      </div>
    </Link>
  );
}

/* ── Urgency meta ── */
function urgencyMeta(diff, overdue) {
  if (overdue) return { badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: AlertTriangle, iconColor: 'text-red-500', iconBg: 'bg-red-100 dark:bg-red-900/30', label: 'Overdue', bar: '#ef4444' };
  if (diff === 0) return { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', icon: AlertTriangle, iconColor: 'text-orange-500', iconBg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Due today', bar: '#f97316' };
  if (diff <= 2) return { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: Clock, iconColor: 'text-amber-500', iconBg: 'bg-amber-100 dark:bg-amber-900/30', label: `${diff}d left`, bar: '#f59e0b' };
  return { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: Clock, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', label: `${diff}d left`, bar: '#10b981' };
}

/* ── Score color ── */
function scoreColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#6366f1';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

/* ══ MAIN ══ */
export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ringFilled, setRingFilled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [expandModules, setExpandModules] = useState(false);
  const [expandClasses, setExpandClasses] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [classesRes, assignmentsRes, announcementsRes, docsRes, coursesRes] = await Promise.all([
          api.get('/classes/my').catch(() => ({ data: { classes: [] } })),
          api.get('/assignments?limit=20').catch(() => ({ data: { assignments: [], total: 0 } })),
          api.get('/announcements?limit=5').catch(() => ({ data: { announcements: [] } })),
          api.get('/documents?limit=6').catch(() => ({ data: { documents: [] } })),
          api.get('/assessment/student/courses').catch(() => ({ data: { courses: [] } })),
        ]);
        setData({
          classes: classesRes.data.classes || [],
          assignments: assignmentsRes.data.assignments || [],
          totalAssignments: assignmentsRes.data.total || 0,
          announcements: announcementsRes.data.announcements || [],
          documents: docsRes.data.documents || [],
          courses: coursesRes.data.courses || [],
        });
      } catch {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => { setRingFilled(true); setVisible(true); }, 80);
    }
  }, [loading]);

  const pending = data?.assignments?.filter(a => !a.submission_id) || [];
  const submitted = data?.assignments?.filter(a => a.submission_id) || [];
  const graded = data?.assignments?.filter(a => a.score !== null && a.score !== undefined && a.max_score) || [];

  const completionPercent = useMemo(() => {
    const total = data?.totalAssignments || 0;
    if (!total) return 0;
    return Math.round((submitted.length / total) * 100);
  }, [data, submitted.length]);

  const averageScore = useMemo(() => {
    if (!graded.length) return null;
    return Math.round(graded.reduce((s, a) => s + (a.score / a.max_score) * 100, 0) / graded.length);
  }, [graded]);

  /* Consecutive submitted days — streak calculation */
  const streak = useMemo(() => {
    if (!submitted.length) return 0;
    const days = new Set(submitted.map(a => new Date(a.submitted_at || a.updated_at || Date.now()).toDateString()));
    let count = 0;
    const d = new Date();
    while (days.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }, [submitted]);

  /* Score band for grade rating label */
  const gradeLabel = averageScore === null ? null
    : averageScore >= 80 ? { label: 'Excellent', color: '#10b981' }
    : averageScore >= 60 ? { label: 'Good', color: '#6366f1' }
    : averageScore >= 40 ? { label: 'Average', color: '#f59e0b' }
    : { label: 'Needs work', color: '#ef4444' };

  const teachers = useMemo(() => {
    const map = new Map();
    (data?.classes || []).forEach(c => {
      if (!c.teacher_name) return;
      const key = c.teacher_id?._id || c.teacher_id || c.teacher_name;
      if (!map.has(key)) map.set(key, { name: c.teacher_name, email: c.teacher_id?.email, role: 'Class teacher', subjects: new Set([c.name]) });
      else map.get(key).subjects.add(c.name);
    });
    (data?.courses || []).forEach(course => {
      const t = course.teacher_id;
      if (!t?.name) return;
      const key = t._id || t.name;
      if (!map.has(key)) map.set(key, { name: t.name, email: t.email, role: 'Module teacher', subjects: new Set([course.name]) });
      else map.get(key).subjects.add(course.name);
    });
    return Array.from(map.values()).map(t => ({ ...t, subjects: Array.from(t.subjects) }));
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(16,185,129,0.15)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#10b981', animation: 'spin 0.9s linear infinite' }} />
        <GraduationCap style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#10b981', width: 18, height: 18 }} />
      </div>
      <p className="text-sm text-muted font-medium">Loading your dashboard…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const visStyle = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(10px)',
    transition: `opacity 0.45s ease ${delay}s, transform 0.45s ease ${delay}s`,
  });

  const MODULES_LIMIT = 6;
  const CLASSES_LIMIT = 6;
  const shownModules = expandModules ? (data?.courses || []) : (data?.courses || []).slice(0, MODULES_LIMIT);
  const shownClasses = expandClasses ? (data?.classes || []) : (data?.classes || []).slice(0, CLASSES_LIMIT);

  return (
    <div className="space-y-5">

      {/* ── Hero ── */}
      <div style={{
        ...visStyle(0),
        borderRadius: 22,
        background: 'linear-gradient(135deg, #065f46 0%, #059669 45%, #0d9488 100%)',
        padding: '24px 26px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(5,150,105,0.3)',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 120, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          {/* Left: greeting */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              {todayLabel}
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>
              {greeting}, {user?.name?.split(' ')[0]} 👋
            </h2>

            {/* Status pill */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {pending.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 30, padding: '6px 14px', backdropFilter: 'blur(8px)' }}>
                  <Sparkles style={{ width: 14, height: 14, color: '#fcd34d' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>All caught up — great work!</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 30, padding: '6px 14px', backdropFilter: 'blur(8px)' }}>
                  <Flame style={{ width: 14, height: 14, color: '#fcd34d' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                    {pending.length} assignment{pending.length !== 1 ? 's' : ''} need your attention
                  </span>
                </div>
              )}
              {streak > 1 && <StreakBadge count={streak} />}
            </div>

            {/* Hero micro-stats */}
            <div style={{ display: 'flex', gap: 20, marginTop: 18, flexWrap: 'wrap' }}>
              {[
                { label: 'Classes', val: data?.classes?.length || 0 },
                { label: 'Modules', val: data?.courses?.length || 0 },
                { label: 'Submitted', val: submitted.length },
              ].map(({ label, val }) => (
                <div key={label}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: 500 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: completion ring */}
          <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ProgressRing percent={ringFilled ? completionPercent : 0} size={96} stroke={9} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {completionPercent}%
              </span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: '0.06em' }}>DONE</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 20, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Assignment completion
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
              {submitted.length} / {data?.totalAssignments || 0}
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 5, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 5,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.7), rgba(255,255,255,0.95))',
              width: `${completionPercent}%`,
              transition: 'width 1.3s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={visStyle(0.07)}>
        <StatCard icon={ClipboardList} label="Pending work" value={pending.length} to="/student/assignments"
          color="text-amber-600" iconBg="bg-amber-100 dark:bg-amber-900/30"
          sublabel={pending.length ? 'needs attention' : 'all clear ✓'} animateNum />
        <StatCard icon={CheckCircle2} label="Submitted" value={submitted.length} to="/student/assignments"
          color="text-emerald-600" iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          sublabel={`of ${data?.totalAssignments || 0} total`} animateNum />
        <StatCard icon={Award} label="Avg score" value={averageScore !== null ? averageScore : '—'} suffix={averageScore !== null ? '%' : ''}
          to="/student/assignments" color="text-violet-600" iconBg="bg-violet-100 dark:bg-violet-900/30"
          sublabel={gradeLabel?.label} animateNum={averageScore !== null} />
        <StatCard icon={BookOpen} label="Documents" value={data?.documents?.length || 0} to="/student/documents"
          color="text-cyan-600" iconBg="bg-cyan-100 dark:bg-cyan-900/30"
          sublabel="available" animateNum />
      </div>

      {/* ── Performance + Pending row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={visStyle(0.12)}>

        {/* Performance card (2 cols) */}
        <div className="card lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              <BarChart3 style={{ display: 'inline', width: 14, height: 14, marginRight: 6, color: '#6366f1', verticalAlign: 'middle' }} />
              Performance
            </h3>
            {gradeLabel && (
              <span className="badge text-xs" style={{ background: `${gradeLabel.color}18`, color: gradeLabel.color, fontWeight: 700 }}>
                {gradeLabel.label}
              </span>
            )}
          </div>

          {/* Score ring */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative', width: 100, height: 100 }}>
              <svg width={100} height={100} viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={50} cy={50} r={40} fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth={9} />
                <circle cx={50} cy={50} r={40} fill="none"
                  stroke={averageScore !== null ? scoreColor(averageScore) : '#e5e7eb'}
                  strokeWidth={9} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 - (averageScore || 0) / 100 * 2 * Math.PI * 40}
                  style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(0.34,1.56,0.64,1) 0.2s' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {averageScore !== null ? `${averageScore}%` : '—'}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 600, letterSpacing: '0.06em' }}>AVG SCORE</span>
              </div>
            </div>
          </div>

          {/* Score breakdown bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Submitted', val: submitted.length, total: data?.totalAssignments || 1, color: '#10b981' },
              { label: 'Graded',    val: graded.length,    total: Math.max(submitted.length, 1), color: '#6366f1' },
              { label: 'Pending',   val: pending.length,   total: Math.max(data?.totalAssignments || 1, 1), color: '#f59e0b' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{row.val}</span>
                </div>
                <ScoreBar percent={Math.round((row.val / row.total) * 100)} color={row.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Pending Assignments (3 cols) */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Pending assignments
              {pending.length > 0 && (
                <span className="ml-2 badge text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {pending.length}
                </span>
              )}
            </h3>
            <Link to="/student/assignments" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nothing pending</p>
              <p className="text-xs text-muted mt-1">New assignments from your teachers will appear here</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pending.slice(0, 5).map((a, i) => {
                const diff = Math.ceil((new Date(a.deadline) - new Date()) / 86400000);
                const overdue = diff < 0;
                const meta = urgencyMeta(diff, overdue);
                const Icon = meta.icon;
                return (
                  <Link key={a.id} to={`/student/assignments/${a.id}`}
                    className="flex items-center gap-3 p-2.5 -mx-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors group"
                    style={{ animation: `fadeSlide 0.35s ease ${i * 0.06}s both`, textDecoration: 'none' }}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
                      <Icon className={`w-4 h-4 ${meta.iconColor}`} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                      <p className="text-xs text-muted">{a.class_name}{a.module_name ? ` · ${a.module_name}` : ''}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span className={`badge text-xs flex-shrink-0 ${meta.badge}`}>{meta.label}</span>
                      {a.max_score && <span className="text-xs text-muted">{a.max_score} pts</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Graded work with scores ── */}
      {graded.length > 0 && (
        <div className="card" style={visStyle(0.17)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Trophy style={{ width: 15, height: 15, color: '#f59e0b' }} />
              Recent grades
            </h3>
            <Link to="/student/assignments" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              All results <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {graded.slice(0, 4).map((a, i) => {
              const pct = Math.round((a.score / a.max_score) * 100);
              const c = scoreColor(pct);
              return (
                <div key={a.id} style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--card-border)', animation: `fadeSlide 0.35s ease ${i * 0.06}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)', flex: 1 }}>{a.title}</p>
                    <span style={{ fontSize: 16, fontWeight: 800, color: c, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                  </div>
                  <ScoreBar percent={pct} color={c} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span className="text-xs text-muted">{a.class_name}</span>
                    <span className="text-xs text-muted">{a.score} / {a.max_score} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Announcements ── */}
      <div className="card" style={visStyle(0.2)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Bell style={{ width: 14, height: 14, color: '#8b5cf6' }} />
            Announcements
          </h3>
          <Link to="/student/announcements" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {(data?.announcements || []).length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No announcements yet</p>
            <p className="text-xs text-muted mt-1">Your teachers haven't posted anything</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.announcements).map((a, i) => (
              <div key={a.id} style={{
                display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 14,
                background: 'var(--card-border)',
                borderLeft: '3px solid #8b5cf6',
                animation: `fadeSlide 0.35s ease ${i * 0.06}s both`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{a.title}</p>
                  <p className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span className="text-xs text-muted">{a.teacher_name}</span>
                    {a.class_name && (
                      <span className="badge text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{a.class_name}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My Modules ── */}
      <div className="card" style={visStyle(0.24)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <GraduationCap style={{ width: 15, height: 15, color: '#06b6d4' }} />
            My modules
          </h3>
          {(data?.courses?.length || 0) > 0 && (
            <span className="text-xs text-muted">{data.courses.length} module{data.courses.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {(data?.courses || []).length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-cyan-500" />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No modules yet</p>
            <p className="text-xs text-muted mt-1">Modules will appear once your class is assigned a curriculum</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shownModules.map((course, i) => (
                <div key={course.id} style={{
                  padding: '14px', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10,
                  background: 'var(--card-border)',
                  animation: `fadeSlide 0.35s ease ${i * 0.04}s both`,
                  transition: 'transform 0.18s ease',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)', flex: 1 }}>{course.name}</p>
                    {course.code && <span className="text-xs text-muted flex-shrink-0 badge">{course.code}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`badge text-xs ${getCategoryClass(course.category)}`}>{course.category || 'Module'}</span>
                    <span className="text-xs text-muted">{course.total_marks || 100} marks</span>
                  </div>
                  {course.teacher_id?.name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--card-border)' }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#fff',
                      }}>{initials(course.teacher_id.name)}</div>
                      <span className="text-xs text-muted truncate">{course.teacher_id.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {(data?.courses?.length || 0) > MODULES_LIMIT && (
              <button onClick={() => setExpandModules(v => !v)} className="w-full mt-3 text-xs text-primary-600 flex items-center justify-center gap-1 py-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                {expandModules ? 'Show less' : `Show ${data.courses.length - MODULES_LIMIT} more`}
                <ChevronDown style={{ width: 13, height: 13, transform: expandModules ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Teachers + Classes row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={visStyle(0.28)}>

        {/* My Teachers */}
        {teachers.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>My teachers</h3>
              <span className="text-xs text-muted">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {teachers.map((t, i) => (
                <div key={t.email || t.name} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 14,
                  background: 'var(--card-border)', animation: `fadeSlide 0.35s ease ${i * 0.05}s both`,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#fff',
                  }}>{initials(t.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                    <p className="text-xs text-muted">{t.role}</p>
                    <p className="text-xs text-muted truncate mt-0.5" style={{ opacity: 0.75 }}>{t.subjects.join(', ')}</p>
                    {t.email && (
                      <a href={`mailto:${t.email}`} className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1.5">
                        <Mail style={{ width: 11, height: 11 }} />
                        <span className="truncate">{t.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Classes */}
        {(data?.classes || []).length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>My classes</h3>
              <Link to="/student/classes" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shownClasses.map((c, i) => (
                <Link key={c.id} to="/student/classes" style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12,
                    background: 'var(--card-border)', transition: 'transform 0.15s',
                    animation: `fadeSlide 0.35s ease ${i * 0.05}s both`,
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateX(3px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = ''}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #059669, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <BookMarked style={{ width: 16, height: 16, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                      <p className="text-xs text-muted truncate">{c.teacher_name}</p>
                    </div>
                    <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }} />
                  </div>
                </Link>
              ))}
            </div>
            {(data?.classes?.length || 0) > CLASSES_LIMIT && (
              <button onClick={() => setExpandClasses(v => !v)} className="w-full mt-2 text-xs text-primary-600 flex items-center justify-center gap-1 py-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
                {expandClasses ? 'Show less' : `+${data.classes.length - CLASSES_LIMIT} more`}
                <ChevronDown style={{ width: 13, height: 13, transform: expandClasses ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Recent Documents ── */}
      {(data?.documents || []).length > 0 && (
        <div className="card" style={visStyle(0.32)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <FileText style={{ width: 14, height: 14, color: '#ec4899' }} />
              Study materials
            </h3>
            <Link to="/student/documents" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data.documents).slice(0, 6).map((doc, i) => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                background: 'var(--card-border)', animation: `fadeSlide 0.35s ease ${i * 0.04}s both`,
                transition: 'transform 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = ''}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(236,72,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText style={{ width: 15, height: 15, color: '#ec4899' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title || doc.name}</p>
                  <p className="text-xs text-muted">{doc.class_name || 'Resource'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}