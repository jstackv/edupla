import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import {
  ClipboardCheck, Clock, RotateCcw, CalendarClock, AlertTriangle,
  CheckCircle2, PlayCircle, Loader2, Inbox, Award, Hourglass,
  Sparkles, ListChecks, BookOpen, TimerReset, Search, X,
  LayoutGrid, Rows3, ArrowUpDown, Flame, Trophy, Target,
  ChevronRight, Zap, Rocket,
} from 'lucide-react';

function fmtDate(d) {
  if (!d) return 'No expiry';
  return new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysUntil(d) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

/* Same score-color language used on the student Dashboard, so a "good"
   score reads the same shade of green everywhere in the app. */
function scoreColor(pct) {
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#6366f1';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function statusInfo(a) {
  if (a.expired && a.best_score == null) return { key: 'expired', label: 'Expired', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' };
  if (a.in_progress_attempt_id) return { key: 'progress', label: 'In progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' };
  if (a.best_score != null) return { key: 'graded', label: 'Graded', color: '#10b981', bg: 'rgba(16,185,129,0.14)' };
  if (a.has_pending_grading) return { key: 'pending', label: 'Awaiting grading', color: '#6366f1', bg: 'rgba(99,102,241,0.14)' };
  if (a.not_yet_available) return { key: 'scheduled', label: 'Starts soon', color: '#8b5cf6', bg: 'rgba(139,92,246,0.14)' };
  if (!a.can_start) return { key: 'locked', label: 'No attempts left', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' };
  return { key: 'new', label: 'Not started', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' };
}

/* Bucket used by the filter chips — collapses the many fine-grained
   statuses above into the four groups a student actually thinks in. */
function bucketOf(a) {
  const s = statusInfo(a);
  if (s.key === 'expired') return 'expired';
  if (s.key === 'progress' || s.key === 'pending') return 'progress';
  if (s.key === 'graded') return 'graded';
  return 'todo';
}

/* Deterministic accent color per module name, so the same module always
   reads the same hue across the page (card rail, chips, group heading). */
const MODULE_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#f43f5e', '#14b8a6'];
function moduleColor(name) {
  const s = name || 'Other';
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return MODULE_PALETTE[hash % MODULE_PALETTE.length];
}

/* ── Animated counter — same easing/curve used on the admin Dashboard ── */
function useCountUp(target, trigger, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) { setVal(0); return; }
    const num = Number(target) || 0;
    let start = null;
    let raf;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * num));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, trigger]); // eslint-disable-line
  return val;
}

/* Ticking countdown — only mounted once (in the spotlight banner), so a
   1s interval here is cheap. */
function useCountdown(target) {
  const [remaining, setRemaining] = useState(() => (target ? new Date(target) - Date.now() : null));
  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(new Date(target) - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

function formatRemaining(ms) {
  if (ms == null) return '';
  if (ms <= 0) return "Time's up";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

/* Subtle mouse-tracked 3D tilt, applied via direct DOM writes (no React
   state) so it stays smooth. No-ops for users who prefer reduced motion. */
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;
function useTilt() {
  const onMove = useCallback((e) => {
    if (prefersReducedMotion) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rotY = (x - 0.5) * 7;
    const rotX = (0.5 - y) * 7;
    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
  }, []);
  const onLeave = useCallback((e) => { e.currentTarget.style.transform = ''; }, []);
  return { onMouseMove: onMove, onMouseLeave: onLeave };
}

function StatusPill({ a }) {
  const s = statusInfo(a);
  const pulsing = s.key === 'progress' || s.key === 'pending';
  return (
    <span
      className={`badge text-xs flex items-center gap-1.5 flex-shrink-0 ${pulsing ? 'assessment-badge-live' : ''}`}
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

/* Small animated SVG ring showing best-score percentage, with a brief
   sparkle burst for strong results (>=80%) once the ring finishes filling. */
function ScoreRing({ pct, size = 46, celebrate = false }) {
  const [filled, setFilled] = useState(false);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 80);
    let t2;
    if (celebrate) t2 = setTimeout(() => setBurst(true), 900);
    return () => { clearTimeout(t); if (t2) clearTimeout(t2); };
  }, [celebrate]);
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(pct);
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      {burst && !prefersReducedMotion && (
        <span className="sa-sparkle-burst" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="sa-sparkle" style={{ '--sa-a': `${i * 60}deg`, '--sa-c': color }} />
          ))}
        </span>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={filled ? c - (pct / 100) * c : c}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
        <text x="50%" y="51%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.3} fontWeight="700" fill={color} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(pct)}
        </text>
      </svg>
    </span>
  );
}

/* A quick "N days left" chip in the same red→amber→green urgency language
   used elsewhere in the app, so a tight deadline actually looks tight. */
function ExpiryChip({ expiresAt, expired }) {
  if (!expiresAt) return null;
  const diff = daysUntil(expiresAt);
  if (expired || diff < 0) return null;
  const { color, bg, label } = diff === 0
    ? { color: '#f97316', bg: 'rgba(249,115,22,0.14)', label: 'Due today' }
    : diff <= 2
      ? { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', label: `${diff}d left` }
      : { color: 'var(--text-secondary)', bg: 'var(--surface-100)', label: `${diff}d left` };
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${diff <= 0 ? 'assessment-timer-urgent' : ''}`} style={{ background: bg, color }}>
      <TimerReset className="w-3 h-3" /> {label}
    </span>
  );
}

/* Tells the student when a shared-but-not-open-yet assessment will start.
   Shown instead of (never alongside) the expiry chip, since "starts in"
   matters more than "due in" until the start time actually arrives. */
function StartsChip({ availableFrom }) {
  if (!availableFrom) return null;
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: 'rgba(139,92,246,0.14)', color: '#8b5cf6' }}>
      <CalendarClock className="w-3 h-3" /> Starts {fmtDate(availableFrom)}
    </span>
  );
}

function AssessmentCard({ a, i, onOpen, layout = 'grid' }) {
  const s = statusInfo(a);
  const pct = a.max_marks ? Math.round(((a.best_score ?? 0) / a.max_marks) * 100) : 0;
  const ctaDisabled = a.expired || (!a.can_start && !a.in_progress_attempt_id);
  const tilt = useTilt();
  const mColor = moduleColor(a.module_name);

  const cta = a.in_progress_attempt_id
    ? <><PlayCircle className="w-4 h-4" /> Resume</>
    : a.not_yet_available
      ? <><CalendarClock className="w-4 h-4" /> View details</>
      : a.can_start
        ? <><PlayCircle className="w-4 h-4" /> View &amp; Start</>
        : <><CheckCircle2 className="w-4 h-4" /> {a.expired ? 'Expired' : 'No attempts left'}</>;

  if (layout === 'list') {
    return (
      <div
        {...tilt}
        style={{ '--i': i, borderColor: `color-mix(in srgb, ${s.color} 20%, var(--card-border))`, '--sa-accent': mColor }}
        className="card assessment-card sa-row p-3.5 flex items-center gap-4 relative"
      >
        <span className="sa-row-rail" style={{ background: mColor }} />
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative" style={{ background: `${mColor}1f` }}>
          <BookOpen className="w-5 h-5" style={{ color: mColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold leading-snug truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
            <StatusPill a={a} />
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
            {a.module_name} · By {a.teacher_name} · {a.duration_minutes} min · {a.attempts_left}/{a.max_attempts} left
          </p>
        </div>
        {a.best_score != null && <ScoreRing pct={pct} size={40} celebrate={pct >= 80} />}
        {a.not_yet_available && !a.expired
          ? <StartsChip availableFrom={a.available_from} />
          : <ExpiryChip expiresAt={a.expires_at} expired={a.expired} />}
        <button
          onClick={() => onOpen(a)}
          disabled={ctaDisabled && !a.not_yet_available}
          className="btn-primary assessment-cta text-sm flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed flex-shrink-0"
        >
          {cta}
        </button>
      </div>
    );
  }

  return (
    <div
      {...tilt}
      style={{ '--i': i, borderColor: `color-mix(in srgb, ${s.color} 22%, var(--card-border))`, '--sa-accent': mColor }}
      className="card assessment-card sa-tilt p-4 flex flex-col gap-3 relative"
    >
      {/* Module-colored top rail */}
      <span className="sa-card-rail" style={{ background: `linear-gradient(90deg, ${mColor}, ${mColor}00)` }} />
      {/* Ambient status-tinted glow in the corner, same trick used on the dashboard's stat cards */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-24 h-24 rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${s.color}22 0%, transparent 70%)` }}
      />

      <div className="flex items-start justify-between gap-2 relative">
        <div className="min-w-0">
          <span className="sa-module-tag" style={{ '--sa-accent': mColor }}>{a.module_name}</span>
          <h3 className="font-semibold leading-snug mt-1" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>By {a.teacher_name}</p>
        </div>
        {a.best_score != null ? <ScoreRing pct={pct} celebrate={pct >= 80} /> : <StatusPill a={a} />}
      </div>

      {a.best_score != null && (
        <div className="flex items-center gap-2 -mt-1 relative flex-wrap">
          <StatusPill a={a} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a.best_score} / {a.max_marks} pts</span>
          {a.decision && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: a.decision === 'C' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                color: a.decision === 'C' ? '#10b981' : '#ef4444',
              }}
            >
              {a.decision}
            </span>
          )}
          {pct >= 80 && (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#10b981' }}>
              <Trophy className="w-3 h-3" /> Great score
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap text-xs relative">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
          <Hourglass className="w-3 h-3" /> {a.duration_minutes} min
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
          <RotateCcw className="w-3 h-3" /> {a.attempts_left}/{a.max_attempts} left
        </span>
        {a.not_yet_available && !a.expired
          ? <StartsChip availableFrom={a.available_from} />
          : <ExpiryChip expiresAt={a.expires_at} expired={a.expired} />}
      </div>

      <button
        onClick={() => onOpen(a)}
        disabled={ctaDisabled && !a.not_yet_available}
        className="btn-primary assessment-cta text-sm mt-1 flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
      >
        {cta}
      </button>
    </div>
  );
}

function CardSkeleton({ i }) {
  return (
    <div style={{ '--i': i }} className="card p-4 flex flex-col gap-3 assessment-stagger">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="skeleton h-4 w-3/4 mb-2" />
          <div className="skeleton h-3 w-1/3" />
        </div>
        <div className="skeleton w-11 h-11 rounded-full" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
      <div className="skeleton h-9 w-full rounded-xl mt-1" />
    </div>
  );
}

function InstructionsModal({ assessment, onClose, onStart, starting }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/assessment/student/assessments/${assessment.id}/instructions`);
        if (alive) setData(data);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load assessment details');
        onClose();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [assessment.id]); // eslint-disable-line

  return (
    <Modal isOpen={true} onClose={onClose} title={assessment.title}>
      {loading || !data ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <BookOpen className="w-3.5 h-3.5" /> {data.module_name} · {data.teacher_name}
          </p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="card assessment-card p-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <Clock className="w-4 h-4" style={{ color: '#6366f1' }} />
              </div>
              <div style={{ color: 'var(--text-primary)' }} className="font-semibold">{data.duration_minutes} min</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Time limit</div>
            </div>
            <div className="card assessment-card p-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <RotateCcw className="w-4 h-4" style={{ color: '#f59e0b' }} />
              </div>
              <div style={{ color: 'var(--text-primary)' }} className="font-semibold">{data.attempts_left} of {data.max_attempts}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Attempts left</div>
            </div>
            <div className="card assessment-card p-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <ListChecks className="w-4 h-4" style={{ color: '#10b981' }} />
              </div>
              <div style={{ color: 'var(--text-primary)' }} className="font-semibold">{data.question_count} questions</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total {data.total_marks} pts</div>
            </div>
            <div className="card assessment-card p-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <CalendarClock className="w-4 h-4" style={{ color: '#ef4444' }} />
              </div>
              <div style={{ color: 'var(--text-primary)' }} className="font-semibold text-xs">{fmtDate(data.expires_at)}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Available until</div>
            </div>
            {data.available_from && (
              <div className="card assessment-card p-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: 'rgba(139,92,246,0.12)' }}>
                  <CalendarClock className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                </div>
                <div style={{ color: 'var(--text-primary)' }} className="font-semibold text-xs">{fmtDate(data.available_from)}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Opens for starting</div>
              </div>
            )}
          </div>

          {data.not_yet_available && (
            <div className="p-3 rounded-xl text-sm flex items-start gap-2" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <CalendarClock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#8b5cf6' }} />
              <p style={{ color: 'var(--text-secondary)' }}>
                This assessment isn't open yet. You'll be able to start it on <strong style={{ color: 'var(--text-primary)' }}>{fmtDate(data.available_from)}</strong> — once your {data.duration_minutes} minute window opens, it starts from that moment.
              </p>
            </div>
          )}

          {data.instructions && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--text-secondary)' }}>
              {data.instructions}
            </div>
          )}

          <div className="p-3 rounded-xl text-sm flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p style={{ color: 'var(--text-secondary)' }}>
              This opens in full screen. Leaving the exam screen or switching to another window/tab submits it automatically, and it also submits automatically when the timer runs out. Make sure you're ready before you start.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={() => onStart(data.in_progress_attempt_id)}
              disabled={starting || (data.expired || data.not_yet_available || (data.attempts_left <= 0 && !data.in_progress_attempt_id))}
              className="btn-primary assessment-cta flex items-center gap-2"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {data.in_progress_attempt_id ? 'Resume Assessment' : data.not_yet_available ? 'Not open yet' : 'Start Assessment'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* Overall completion ring — big-picture "how much of this am I done with"
   read, separate from the per-assessment score rings below it. */
function CompletionRing({ pct, size = 84 }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), 150); return () => clearTimeout(t); }, []);
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <defs>
        <linearGradient id="sa-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#sa-ring-grad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={filled ? c - (pct / 100) * c : c}
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.24} fontWeight="800" fill="var(--text-primary)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(pct)}%
      </text>
      <text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.115} fontWeight="600" fill="var(--text-secondary)">
        done
      </text>
    </svg>
  );
}

/* Command-center header strip: overall progress ring + key counters with
   count-up animation. A "new UI feature" pass at giving the student a
   glance-and-go summary before scanning every card. */
function CommandCenter({ assessments, loaded }) {
  const total = assessments.length;
  const graded = assessments.filter(a => a.best_score != null).length;
  const inProgress = assessments.filter(a => a.in_progress_attempt_id).length;
  const toStart = assessments.filter(a => a.can_start && !a.in_progress_attempt_id && a.best_score == null).length;
  const gradedList = assessments.filter(a => a.best_score != null && a.max_marks);
  const avgPct = gradedList.length
    ? Math.round(gradedList.reduce((sum, a) => sum + (a.best_score / a.max_marks) * 100, 0) / gradedList.length)
    : null;
  const completionPct = total ? Math.round((graded / total) * 100) : 0;

  const cTotal = useCountUp(total, loaded);
  const cGraded = useCountUp(graded, loaded);
  const cProgress = useCountUp(inProgress, loaded);
  const cToStart = useCountUp(toStart, loaded);
  const cAvg = useCountUp(avgPct ?? 0, loaded);

  if (total === 0) return null;

  const items = [
    { label: 'Assigned', value: cTotal, color: '#6366f1', icon: ClipboardCheck },
    { label: 'Graded', value: cGraded, color: '#10b981', icon: Award },
    { label: 'In progress', value: cProgress, color: '#f59e0b', icon: Hourglass },
    { label: 'To start', value: cToStart, color: '#3b82f6', icon: Sparkles },
  ];

  return (
    <div className="card sa-command-center p-5 mb-6 relative overflow-hidden">
      <div className="sa-command-glow" aria-hidden="true" />
      <div className="flex flex-col sm:flex-row items-center gap-6 relative">
        <div className="flex items-center gap-4 flex-shrink-0">
          <CompletionRing pct={completionPct} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Your progress</p>
            <p className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {graded} of {total} completed
            </p>
            {avgPct != null && (
              <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: scoreColor(avgPct) }}>
                <Target className="w-3 h-3" /> {cAvg}% average score
              </p>
            )}
          </div>
        </div>

        <div className="hidden sm:block w-px self-stretch" style={{ background: 'var(--card-border)' }} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
          {items.map((it, i) => (
            <div key={it.label} style={{ '--i': i }} className="sa-mini-stat assessment-stagger flex items-center gap-2.5 p-2.5 rounded-xl" >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${it.color}1f` }}>
                <it.icon className="w-4.5 h-4.5" style={{ color: it.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{it.value}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{it.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* "Up next" spotlight — surfaces the single most pressing assessment (an
   in-progress attempt, or the soonest-expiring startable one) with a live
   ticking countdown, so the student never has to hunt for what matters
   most right now. */
function SpotlightBanner({ item, onOpen }) {
  const { a, reason } = item;
  const target = reason === 'progress' ? null : a.expires_at;
  const remaining = useCountdown(target);
  const mColor = moduleColor(a.module_name);

  return (
    <button onClick={() => onOpen(a)} className="sa-spotlight w-full text-left mb-6 relative overflow-hidden">
      <span className="sa-spotlight-border" aria-hidden="true" />
      <div className="sa-spotlight-inner p-4 sm:p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 relative" style={{ background: `linear-gradient(135deg, ${mColor}, ${mColor}99)` }}>
          {reason === 'progress' ? <Zap className="w-5.5 h-5.5 text-white" /> : <Flame className="w-5.5 h-5.5 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: mColor }}>
            {reason === 'progress' ? <><Hourglass className="w-3 h-3" /> Continue where you left off</> : <><Flame className="w-3 h-3" /> Due soon — don't miss it</>}
          </p>
          <p className="font-display font-bold truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {a.module_name} · {a.duration_minutes} min
            {remaining != null && <> · <span className="font-semibold" style={{ color: remaining <= 3600000 ? '#ef4444' : mColor }}>{formatRemaining(remaining)} left</span></>}
          </p>
        </div>
        <span className="btn-primary assessment-cta text-sm flex items-center gap-2 flex-shrink-0">
          {reason === 'progress' ? <><PlayCircle className="w-4 h-4" /> Resume</> : <><Rocket className="w-4 h-4" /> View &amp; Start</>}
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </button>
  );
}

const FILTERS = [
  { key: 'all', label: 'All', icon: ListChecks },
  { key: 'todo', label: 'To do', icon: Sparkles },
  { key: 'progress', label: 'In progress', icon: Hourglass },
  { key: 'graded', label: 'Graded', icon: Award },
  { key: 'expired', label: 'Expired', icon: TimerReset },
];

const SORTS = [
  { key: 'default', label: 'Recommended (by module)' },
  { key: 'deadline', label: 'Deadline — soonest first' },
  { key: 'az', label: 'Title — A to Z' },
];

function Toolbar({ query, setQuery, filter, setFilter, sort, setSort, view, setView, counts }) {
  return (
    <div className="card p-3 mb-6 flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assessments, modules, teachers…"
          className="w-full pl-9 pr-8 py-2 rounded-xl text-sm outline-none transition-colors"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-black/10">
            <X className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`sa-filter-chip ${filter === f.key ? 'sa-filter-chip-active' : ''}`}
          >
            <f.icon className="w-3.5 h-3.5" />
            {f.label}
            <span className="sa-filter-count">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="pl-7 pr-3 py-2 rounded-xl text-xs font-medium outline-none appearance-none cursor-pointer"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="sa-view-toggle">
          <button onClick={() => setView('grid')} className={view === 'grid' ? 'active' : ''} title="Grid view"><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => setView('list')} className={view === 'list' ? 'active' : ''} title="List view"><Rows3 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

export default function StudentAssessments() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState([]);
  const [instructionsFor, setInstructionsFor] = useState(null);
  const [starting, setStarting] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('default');
  const [view, setView] = useState('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/assessment/student/assessments');
      setAssessments(data.assessments);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    setStarting(true);
    try {
      navigate(`/student/assessments/${instructionsFor.id}/attempt`);
    } finally {
      setStarting(false);
    }
  };

  const spotlight = useMemo(() => {
    const inProg = assessments.find(a => a.in_progress_attempt_id);
    if (inProg) return { a: inProg, reason: 'progress' };
    const candidates = assessments
      .filter(a => a.can_start && !a.expired && !a.not_yet_available && a.expires_at)
      .sort((x, y) => new Date(x.expires_at) - new Date(y.expires_at));
    const urgent = candidates[0];
    if (urgent) {
      const d = daysUntil(urgent.expires_at);
      if (d != null && d <= 3) return { a: urgent, reason: 'urgent' };
    }
    return null;
  }, [assessments]);

  const counts = useMemo(() => {
    const c = { all: assessments.length, todo: 0, progress: 0, graded: 0, expired: 0 };
    assessments.forEach(a => { c[bucketOf(a)] = (c[bucketOf(a)] || 0) + 1; });
    return c;
  }, [assessments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assessments.filter(a => {
      if (filter !== 'all' && bucketOf(a) !== filter) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q)
        || (a.module_name || '').toLowerCase().includes(q)
        || (a.teacher_name || '').toLowerCase().includes(q);
    });
  }, [assessments, filter, query]);

  const sorted = useMemo(() => {
    if (sort === 'deadline') {
      return [...filtered].sort((a, b) => {
        const ea = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
        const eb = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
        return ea - eb;
      });
    }
    if (sort === 'az') return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [filtered, sort]);

  // Group by module for the tidier "Recommended" view
  const grouped = useMemo(() => {
    if (sort !== 'default') return null;
    return sorted.reduce((acc, a) => {
      const key = a.module_name || 'Other';
      (acc[key] = acc[key] || []).push(a);
      return acc;
    }, {});
  }, [sorted, sort]);

  const gridCls = view === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3 assessment-stagger' : 'flex flex-col gap-2.5 assessment-stagger';

  const renderList = (list) => (
    <div className={gridCls}>
      {list.map((a, i) => <AssessmentCard key={a.id} a={a} i={i} onOpen={setInstructionsFor} layout={view} />)}
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6 relative">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 60%)' }} />
          <ClipboardCheck className="w-5 h-5 text-white assessment-icon-float relative" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Assessments</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Online assessments shared by your teachers</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} i={i} />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="card p-12 text-center relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.08), transparent 60%)' }} />
          <div className="sa-empty-orbit" aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 relative" style={{ background: 'rgba(99,102,241,0.1)' }}>
            <Inbox className="w-8 h-8 assessment-icon-float" style={{ color: '#6366f1' }} />
          </div>
          <p className="font-semibold mb-1 relative" style={{ color: 'var(--text-primary)' }}>Nothing here yet</p>
          <p className="text-sm relative" style={{ color: 'var(--text-secondary)' }}>No assessments have been shared with your class yet — check back once your teacher publishes one.</p>
        </div>
      ) : (
        <>
          <CommandCenter assessments={assessments} loaded={!loading} />
          {spotlight && <SpotlightBanner item={spotlight} onOpen={setInstructionsFor} />}
          <Toolbar
            query={query} setQuery={setQuery}
            filter={filter} setFilter={setFilter}
            sort={sort} setSort={setSort}
            view={view} setView={setView}
            counts={counts}
          />

          {sorted.length === 0 ? (
            <div className="card p-10 text-center">
              <Search className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No matches</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Try a different search term or clear the filter.</p>
            </div>
          ) : grouped ? (
            Object.entries(grouped).map(([module, list]) => (
              <div key={module} className="mb-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: moduleColor(module) }} />
                  <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{module}</h2>
                  <span className="badge text-xs" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>{list.length}</span>
                </div>
                {renderList(list)}
              </div>
            ))
          ) : (
            <div className="mb-7">{renderList(sorted)}</div>
          )}
        </>
      )}

      {instructionsFor && (
        <InstructionsModal
          assessment={instructionsFor}
          onClose={() => setInstructionsFor(null)}
          onStart={handleStart}
          starting={starting}
        />
      )}
    </div>
  );
}