import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import {
  ClipboardCheck, Clock, RotateCcw, CalendarClock, AlertTriangle,
  CheckCircle2, PlayCircle, Loader2, Inbox, Award, Hourglass,
  Sparkles, ListChecks, BookOpen, TimerReset,
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
  if (!a.can_start) return { key: 'locked', label: 'No attempts left', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' };
  return { key: 'new', label: 'Not started', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' };
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

/* Small animated SVG ring showing best-score percentage — a much more
   "at a glance" read than a bare number, and doubles as the card's visual
   anchor once an assessment has been graded. */
function ScoreRing({ pct, size = 46 }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), 80); return () => clearTimeout(t); }, []);
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(pct);
  return (
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
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: bg, color }}>
      <TimerReset className="w-3 h-3" /> {label}
    </span>
  );
}

function AssessmentCard({ a, i, onOpen }) {
  const s = statusInfo(a);
  const pct = a.max_marks ? Math.round(((a.best_score ?? 0) / a.max_marks) * 100) : 0;
  const ctaDisabled = a.expired || (!a.can_start && !a.in_progress_attempt_id);

  return (
    <div
      style={{ '--i': i, borderColor: `color-mix(in srgb, ${s.color} 22%, var(--card-border))` }}
      className="card assessment-card p-4 flex flex-col gap-3 relative"
    >
      {/* Ambient status-tinted glow in the corner, same trick used on the dashboard's stat cards */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-24 h-24 rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${s.color}22 0%, transparent 70%)` }}
      />

      <div className="flex items-start justify-between gap-2 relative">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>By {a.teacher_name}</p>
        </div>
        {a.best_score != null ? <ScoreRing pct={pct} /> : <StatusPill a={a} />}
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
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap text-xs relative">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
          <Hourglass className="w-3 h-3" /> {a.duration_minutes} min
        </span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
          <RotateCcw className="w-3 h-3" /> {a.attempts_left}/{a.max_attempts} left
        </span>
        <ExpiryChip expiresAt={a.expires_at} expired={a.expired} />
      </div>

      <button
        onClick={() => onOpen(a)}
        disabled={ctaDisabled}
        className="btn-primary assessment-cta text-sm mt-1 flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
      >
        {a.in_progress_attempt_id
          ? <><PlayCircle className="w-4 h-4" /> Resume</>
          : a.can_start
            ? <><PlayCircle className="w-4 h-4" /> View &amp; Start</>
            : <><CheckCircle2 className="w-4 h-4" /> {a.expired ? 'Expired' : 'No attempts left'}</>}
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
          </div>

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
              disabled={starting || (data.expired || (data.attempts_left <= 0 && !data.in_progress_attempt_id))}
              className="btn-primary assessment-cta flex items-center gap-2"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {data.in_progress_attempt_id ? 'Resume Assessment' : 'Start Assessment'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* Tiny overview strip above the module lists — a "new UI feature" pass at
   giving the student a glance-and-go summary before scanning every card. */
function OverviewStrip({ assessments }) {
  const total = assessments.length;
  const graded = assessments.filter(a => a.best_score != null).length;
  const inProgress = assessments.filter(a => a.in_progress_attempt_id).length;
  const toStart = assessments.filter(a => a.can_start && !a.in_progress_attempt_id && a.best_score == null).length;

  if (total === 0) return null;

  const items = [
    { label: 'Assigned', value: total, color: '#6366f1', icon: ClipboardCheck },
    { label: 'Graded', value: graded, color: '#10b981', icon: Award },
    { label: 'In progress', value: inProgress, color: '#f59e0b', icon: Hourglass },
    { label: 'To start', value: toStart, color: '#3b82f6', icon: Sparkles },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7 assessment-stagger">
      {items.map((it, i) => (
        <div key={it.label} style={{ '--i': i }} className="card assessment-card p-3.5 flex items-center gap-3 relative overflow-hidden">
          <div className="pointer-events-none absolute top-0 right-0 w-16 h-16" style={{ background: `radial-gradient(circle at top right, ${it.color}20 0%, transparent 70%)` }} />
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
  );
}

export default function StudentAssessments() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState([]);
  const [instructionsFor, setInstructionsFor] = useState(null);
  const [starting, setStarting] = useState(false);

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

  // Group by module for a tidier list
  const grouped = useMemo(() => assessments.reduce((acc, a) => {
    const key = a.module_name || 'Other';
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {}), [assessments]);

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
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 relative" style={{ background: 'rgba(99,102,241,0.1)' }}>
            <Inbox className="w-8 h-8 assessment-icon-float" style={{ color: '#6366f1' }} />
          </div>
          <p className="font-semibold mb-1 relative" style={{ color: 'var(--text-primary)' }}>Nothing here yet</p>
          <p className="text-sm relative" style={{ color: 'var(--text-secondary)' }}>No assessments have been shared with your class yet — check back once your teacher publishes one.</p>
        </div>
      ) : (
        <>
          <OverviewStrip assessments={assessments} />
          {Object.entries(grouped).map(([module, list]) => (
            <div key={module} className="mb-7">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{module}</h2>
                <span className="badge text-xs" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>{list.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 assessment-stagger">
                {list.map((a, i) => (
                  <AssessmentCard key={a.id} a={a} i={i} onOpen={setInstructionsFor} />
                ))}
              </div>
            </div>
          ))}
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