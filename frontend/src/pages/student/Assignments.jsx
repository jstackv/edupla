import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import FileViewer from '../../components/common/FileViewer';
import { FilePicker, FileRows, MAX_TASK_FILES } from '../../components/common/TaskFiles';
import { useAuth } from '../../context/AuthContext';
import {
  Search, ClipboardList, Upload, Eye,
  Clock, CheckCircle2, AlertTriangle, Award, X, CloudUpload, FileText, RefreshCw,
  BookOpen, ChevronRight, ArrowLeft, Inbox, Home, User, Users, Lock,
  Sparkles, Trophy, Send, Timer, CalendarClock, Star, FileUp, PenLine, Paperclip, History, PartyPopper,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */
function timeLeft(deadline, now = Date.now()) {
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return { overdue: true, text: 'Deadline passed' };
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return { overdue: false, urgent: d <= 1, text: `${d}d ${h}h left` };
  if (h > 0) return { overdue: false, urgent: true, text: `${h}h ${m}m left` };
  return { overdue: false, urgent: true, text: `${m}m left` };
}

function DeadlineBadge({ deadline }) {
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  if (diff < 0) return <span className="badge bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-xs">Overdue</span>;
  if (diff <= 2) return <span className="badge bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 text-xs">Due in {diff}d</span>;
  return <span className="badge bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs">{diff}d left</span>;
}

const kindTitle = (taskType, mode) =>
  taskType === 'homework' ? 'Homework' : mode === 'discussion' ? 'Group Discussion' : 'Individual Assignment';

function KindBadge({ taskType, mode }) {
  const tone = taskType === 'homework'
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
    : mode === 'discussion'
      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return <span className={`badge text-xs ${tone}`}>{kindTitle(taskType, mode)}</span>;
}

const MODULE_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30',  text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30',     text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30',     text: 'text-cyan-700 dark:text-cyan-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
];
function moduleColor(idx) { return MODULE_COLORS[idx % MODULE_COLORS.length]; }

function ChoiceCard({ icon: Icon, title, desc, color, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-4 px-5 py-5 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className={`w-14 h-14 rounded-2xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-7 h-7 ${color.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-xs text-muted mt-1">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Visual identity per kind of task — every kind gets its own colour,
   icon and tone so a student can tell them apart at a glance.
══════════════════════════════════════════════════════════════════════ */
const KIND_THEME = {
  individual: {
    icon: User, label: 'Individual Assignment', tag: 'Your own work',
    hero: 'linear-gradient(135deg, #1c0a02 0%, #7c2d12 52%, #ea580c 100%)',
    accent: '#ea580c', accent2: '#f59e0b', soft: 'rgba(234,88,12,0.10)', ring: 'rgba(234,88,12,0.35)',
  },
  homework: {
    icon: Home, label: 'Homework', tag: 'Work at home',
    hero: 'linear-gradient(135deg, #04121f 0%, #0c4a6e 52%, #0ea5e9 100%)',
    accent: '#0284c7', accent2: '#22d3ee', soft: 'rgba(14,165,233,0.10)', ring: 'rgba(14,165,233,0.35)',
  },
  discussion: {
    icon: Users, label: 'Group Discussion', tag: 'Team up',
    hero: 'linear-gradient(135deg, #12061f 0%, #4c1d95 52%, #a855f7 100%)',
    accent: '#7c3aed', accent2: '#d946ef', soft: 'rgba(124,58,237,0.10)', ring: 'rgba(124,58,237,0.35)',
  },
};
const kindThemeOf = (taskType, mode) =>
  taskType === 'homework' ? KIND_THEME.homework : mode === 'discussion' ? KIND_THEME.discussion : KIND_THEME.individual;

const AVATAR_TONES = ['#ea580c', '#0284c7', '#7c3aed', '#059669', '#db2777', '#ca8a04', '#0891b2', '#dc2626'];
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

function Avatar({ name, idx = 0, size = 34, ring }) {
  return (
    <span title={name} className="inline-flex items-center justify-center rounded-full font-bold text-white flex-shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.36, background: AVATAR_TONES[idx % AVATAR_TONES.length], boxShadow: ring ? `0 0 0 2px var(--card-bg), 0 0 0 4px ${ring}` : '0 0 0 2px var(--card-bg)' }}>
      {initials(name)}
    </span>
  );
}

/* Circular progress. `children` sits in the middle. */
function Ring({ value = 0, size = 96, stroke = 8, from = '#ea580c', to = '#f59e0b', track = 'rgba(255,255,255,0.14)', id = 'ring', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function Panel({ icon: Icon, title, right, tone, children, className = '' }) {
  return (
    <section className={`rounded-3xl overflow-hidden ${className}`} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <header className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tone.soft }}>
          <Icon className="w-4 h-4" style={{ color: tone.accent }} />
        </span>
        <h3 className="font-display font-bold text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {right}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Task workspace — hero banner, live countdown ring, animated progress,
   instructions + team on one side, a proper submission studio on the other.
══════════════════════════════════════════════════════════════════════ */
function TaskWorkspace({ task, onBack, onChanged, onPreview }) {
  const { user } = useAuth();
  const myId = String(user?.id || '');
  const [files, setFiles] = useState([]);             // files picked in this session
  const [removedIds, setRemovedIds] = useState([]);   // already-submitted files the student is dropping
  const [notes, setNotes] = useState(task.submission_notes || '');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editing, setEditing] = useState(false);   // re-opening the form after a submission
  const [justDone, setJustDone] = useState(false); // celebratory receipt right after handing in
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  // Keep the form in step when the task is refreshed after a submit.
  useEffect(() => { setNotes(task.submission_notes || ''); setFiles([]); setRemovedIds([]); setEditing(false); setProgress(0); }, [task.id, task.submission_id, task.submitted_at]);
  useEffect(() => { if (!justDone) return; const t = setTimeout(() => setJustDone(false), 6000); return () => clearTimeout(t); }, [justDone]);

  const tone = kindThemeOf(task.task_type, task.mode);
  const KindIcon = tone.icon;
  const isDiscussion = task.mode === 'discussion';

  const isSubmitted = !!task.submission_id;
  const isGraded = task.score !== null && task.score !== undefined;
  const left = timeLeft(task.deadline, now);
  const overdue = left.overdue;
  const canSubmit = !overdue && !isGraded;           // first submit, or resubmit until graded/deadline
  const showForm = canSubmit && (!isSubmitted || editing);
  const max = task.max_score || 100;
  const pct = isGraded ? Math.round((task.score / max) * 100) : null;
  const gradeColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const gradeWord = pct >= 85 ? 'Outstanding' : pct >= 70 ? 'Great work' : pct >= 50 ? 'Good effort' : 'Keep going';

  // How much of the time window has already gone by (created → deadline).
  const start = new Date(task.created_at || task.deadline).getTime() - (task.created_at ? 0 : 86400000);
  const end = new Date(task.deadline).getTime();
  const elapsed = end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 1;
  const remaining = overdue ? 0 : 1 - elapsed;

  const existingFiles = task.submission_files || [];
  const keptCount = existingFiles.filter(f => !removedIds.includes(f.id)).length;
  const totalCount = keptCount + files.length;
  const taskFiles = task.attachments || [];
  const toggleExisting = (id) => setRemovedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const resetForm = () => { setEditing(false); setFiles([]); setRemovedIds([]); setNotes(task.submission_notes || ''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalCount === 0 && !notes.trim()) return toast.error('Attach at least one file or write a note first');
    setSaving(true); setProgress(0);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      if (removedIds.length) fd.append('removeFileIds', JSON.stringify(removedIds));
      fd.append('notes', notes);
      await api.post(`/assignments/${task.id}/submit`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        onUploadProgress: ev => { if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100)); },
      });
      toast.success(isSubmitted ? 'Resubmitted successfully!' : 'Submitted successfully!');
      setJustDone(true);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    }
    setSaving(false);
  };

  const steps = [
    { label: 'Assigned', sub: 'Received', done: true },
    { label: 'Submitted', sub: isSubmitted ? new Date(task.submitted_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Your turn', done: isSubmitted },
    { label: 'Graded', sub: isGraded ? `${task.score}/${max}` : 'Pending', done: isGraded },
  ];
  const activeStep = steps.findIndex(s => !s.done);

  const members = task.group?.members || [];
  const dueText = new Date(task.deadline).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5 tw-root">
      <style>{`
        @keyframes tw-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        @keyframes tw-pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes tw-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes tw-pulse { 0%,100% { box-shadow: 0 0 0 0 var(--tw-ring) } 50% { box-shadow: 0 0 0 9px transparent } }
        @keyframes tw-shine { from { background-position: -200% 0 } to { background-position: 200% 0 } }
        @keyframes tw-burst { 0% { transform: scale(.7); opacity: .7 } 100% { transform: scale(1.9); opacity: 0 } }
        .tw-root > * { animation: tw-rise .5s cubic-bezier(.2,.8,.2,1) both }
        .tw-root > *:nth-child(2) { animation-delay: .06s } .tw-root > *:nth-child(3) { animation-delay: .12s }
        .tw-shimmer { background-size: 200% 100%; animation: tw-shine 2.4s linear infinite }
        @media (prefers-reduced-motion: reduce) { .tw-root > *, .tw-shimmer { animation: none } }
      `}</style>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl text-white" style={{ background: tone.hero, boxShadow: `0 20px 50px -20px ${tone.accent}` }}>
        <div aria-hidden className="absolute -right-16 -top-20 w-72 h-72 rounded-full blur-3xl opacity-40" style={{ background: tone.accent2 }} />
        <div aria-hidden className="absolute -left-10 -bottom-24 w-64 h-64 rounded-full blur-3xl opacity-25" style={{ background: tone.accent }} />
        <KindIcon aria-hidden className="absolute right-6 bottom-2 w-44 h-44 opacity-[0.07]" style={{ animation: 'tw-float 7s ease-in-out infinite' }} />

        <div className="relative p-5 sm:p-7">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/25 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(6px)' }} aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/70 min-w-0">
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{task.class_name}</span>
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
              <span className="truncate font-bold text-white/90">{task.course_code || task.course_name}</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)' }}>
                  <KindIcon className="w-3.5 h-3.5" /> {tone.label}
                </span>
                <span className="text-xs font-medium text-white/70">{tone.tag}</span>
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl leading-tight break-words">{task.title}</h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-white/80">
                {task.teacher_name && <span className="flex items-center gap-1.5"><Avatar name={task.teacher_name} size={22} idx={2} /> {task.teacher_name}</span>}
                <span className="flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> {dueText}</span>
                {task.deadline_extended && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(6px)' }}
                    title={`Originally due ${new Date(task.original_deadline).toLocaleString()}`}>
                    <History className="w-3 h-3" /> Extended
                  </span>
                )}
                <span className="flex items-center gap-1.5"><Star className="w-4 h-4" /> {max} points</span>
              </div>
            </div>

            {/* Countdown / state ring */}
            <div className="flex items-center gap-4 md:flex-col md:gap-2 flex-shrink-0">
              {isGraded ? (
                <Ring value={pct / 100} size={112} stroke={9} from={gradeColor} to="#ffffff" id="hero-grade">
                  <span className="text-2xl font-extrabold leading-none">{task.score}</span>
                  <span className="text-[10px] text-white/70 mt-0.5">of {max}</span>
                </Ring>
              ) : isSubmitted ? (
                <div className="w-[112px] h-[112px] rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.22)', border: '2px solid rgba(52,211,153,0.6)' }}>
                  <CheckCircle2 className="w-12 h-12 text-emerald-300" style={{ animation: 'tw-pop .6s both' }} />
                </div>
              ) : (
                <Ring value={remaining} size={112} stroke={9} from={overdue ? '#f87171' : left.urgent ? '#fb923c' : '#ffffff'} to={overdue ? '#ef4444' : tone.accent2} id="hero-time">
                  {overdue ? <AlertTriangle className="w-7 h-7 text-red-300" /> : (
                    <>
                      <Timer className="w-4 h-4 text-white/70 mb-0.5" />
                      <span className="text-[13px] font-extrabold leading-tight px-2">{left.text.replace(' left', '')}</span>
                      <span className="text-[10px] text-white/60">remaining</span>
                    </>
                  )}
                </Ring>
              )}
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: isGraded ? 'rgba(16,185,129,0.25)' : isSubmitted ? 'rgba(59,130,246,0.25)' : overdue ? 'rgba(239,68,68,0.28)' : 'rgba(255,255,255,0.16)' }}>
                {isGraded ? 'Graded' : isSubmitted ? 'Submitted' : overdue ? 'Closed' : 'To do'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress ── */}
      <div className="rounded-3xl px-5 py-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-start">
          {steps.map((st, i) => {
            const active = i === activeStep;
            return (
              <div key={st.label} className="flex items-start flex-1 last:flex-none">
                <div className="flex flex-col items-center text-center w-20 sm:w-24">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white transition-all"
                    style={st.done
                      ? { background: 'linear-gradient(135deg,#10b981,#34d399)', boxShadow: '0 6px 16px rgba(16,185,129,0.4)' }
                      : active
                        ? { background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`, '--tw-ring': tone.ring, animation: 'tw-pulse 2s infinite' }
                        : { background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                    {st.done ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                  </div>
                  <span className="text-xs font-bold mt-2" style={{ color: st.done || active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{st.label}</span>
                  <span className="text-[11px] text-muted">{st.sub}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-1 mt-[18px] mx-1 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: steps[i + 1].done ? '100%' : st.done ? '50%' : '0%', background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* ── Left: brief + team ── */}
        <div className="lg:col-span-2 space-y-5">
          <Panel icon={ClipboardList} title="The brief" tone={tone}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
              {task.description || 'No written instructions — see the attached file, if any.'}
            </p>
            {taskFiles.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> {taskFiles.length === 1 ? 'Attached resource' : `${taskFiles.length} attached resources`}
                </p>
                <FileRows tone={tone} files={taskFiles} dense
                  onView={f => onPreview({ ...f, id: task.id, file_id: f.id, type: 'assignment', title: task.title, class_name: task.class_name })} />
              </div>
            )}

            {task.deadline_extended && (
              <div className="mt-4 flex items-start gap-2.5 p-3 rounded-2xl text-xs" style={{ background: tone.soft, border: `1px solid ${tone.ring}`, color: 'var(--text-secondary)' }}>
                <History className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: tone.accent }} />
                <span>
                  <strong style={{ color: 'var(--text-primary)' }}>Your teacher extended this deadline.</strong>{' '}
                  It was first due <span className="line-through">{new Date(task.original_deadline).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>.
                </span>
              </div>
            )}
          </Panel>

          {isDiscussion && task.group && (
            <Panel icon={Users} title={task.group.name} tone={tone}
              right={<span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: tone.soft, color: tone.accent }}>{members.length} members</span>}>
              <div className="space-y-2">
                {members.map((m, i) => {
                  const me = String(m.id) === myId;
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl" style={me ? { background: tone.soft } : undefined}>
                      <Avatar name={m.name} idx={i} size={38} ring={me ? tone.accent : undefined} />
                      <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                      {me && <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full text-white" style={{ background: tone.accent }}>You</span>}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-3 flex items-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: tone.accent }} />
                Work through it together — each member then submits their own copy.
              </p>
            </Panel>
          )}

          {task.task_type === 'homework' && (
            <div className="rounded-3xl p-4 flex items-start gap-3" style={{ background: tone.soft, border: `1px solid ${tone.ring}` }}>
              <Home className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: tone.accent }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This is <strong style={{ color: 'var(--text-primary)' }}>homework</strong> — take your time at home, then upload your finished work before the deadline.
              </p>
            </div>
          )}
        </div>

        {/* ── Right: submission studio ── */}
        <div className="lg:col-span-3 space-y-5">
          {isGraded && (
            <div className="relative overflow-hidden rounded-3xl p-5 flex items-center gap-5"
              style={{ background: `linear-gradient(135deg, ${gradeColor}1f, transparent)`, border: `1px solid ${gradeColor}55` }}>
              <Ring value={pct / 100} size={92} stroke={8} from={gradeColor} to={gradeColor} track="var(--card-border)" id="grade-ring">
                <span className="text-xl font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>{pct}%</span>
              </Ring>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest" style={{ color: gradeColor }}>
                  <Trophy className="w-3.5 h-3.5" /> {gradeWord}
                </p>
                <p className="text-lg font-display font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{task.score} <span className="text-sm text-muted font-medium">out of {max}</span></p>
                {task.feedback
                  ? <p className="text-sm italic mt-2 pl-3" style={{ color: 'var(--text-secondary)', borderLeft: `3px solid ${gradeColor}` }}>“{task.feedback}”</p>
                  : <p className="text-xs text-muted mt-1">No written feedback from your teacher.</p>}
              </div>
            </div>
          )}

          {/* Handed in */}
          {isSubmitted && !showForm && (
            <Panel icon={CheckCircle2} title="Your submission" tone={{ ...tone, accent: '#10b981', soft: 'rgba(16,185,129,0.12)' }}
              right={<span className="text-xs text-muted">{new Date(task.submitted_at).toLocaleString()}</span>}>
              <div className="space-y-4">
                {/* Receipt — pops in right after handing in */}
                {justDone && (
                  <div className="relative overflow-hidden rounded-2xl p-4 flex items-center gap-4"
                    style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(16,185,129,0.04))', border: '1px solid rgba(16,185,129,0.4)', animation: 'tw-rise .5s cubic-bezier(.2,.8,.2,1) both' }}>
                    <span className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
                      <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: 'rgba(16,185,129,0.35)', animation: 'tw-burst 1.4s ease-out 2' }} />
                      <span className="relative w-14 h-14 rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#10b981,#34d399)', animation: 'tw-pop .6s both', boxShadow: '0 10px 24px -6px rgba(16,185,129,0.6)' }}>
                        <PartyPopper className="w-6 h-6" />
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="font-display font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>Handed in!</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {(task.submission_files || []).length > 0
                          ? `${task.submission_files.length} file${task.submission_files.length !== 1 ? 's' : ''} delivered to ${task.teacher_name || 'your teacher'}.`
                          : `Your answer was delivered to ${task.teacher_name || 'your teacher'}.`}
                        {canSubmit && ' You can still make changes until the deadline.'}
                      </p>
                    </div>
                  </div>
                )}

                {(task.submission_files || []).length > 0 ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" /> {task.submission_files.length} file{task.submission_files.length !== 1 ? 's' : ''} delivered
                    </p>
                    <FileRows tone={tone} files={task.submission_files}
                      onView={f => onPreview({ ...f, type: 'submission', submission_id: task.submission_id, title: `${task.title} — my submission` })} />
                  </div>
                ) : <p className="text-xs text-muted">No file attached.</p>}
                {task.submission_notes && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1.5">Your notes</p>
                    <div className="p-3.5 rounded-2xl text-sm whitespace-pre-wrap" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>{task.submission_notes}</div>
                  </div>
                )}
                {canSubmit ? (
                  <button onClick={() => setEditing(true)} className="btn-secondary text-sm"><RefreshCw className="w-4 h-4" /> Add files / edit</button>
                ) : (
                  <p className="text-xs text-muted flex items-center gap-1.5 pt-1"><Lock className="w-3.5 h-3.5" /> {isGraded ? 'This task has been graded, so it can no longer be changed.' : 'The deadline has passed, so it can no longer be changed.'}</p>
                )}
              </div>
            </Panel>
          )}

          {/* Locked: deadline passed and nothing handed in */}
          {!isSubmitted && overdue && (
            <div className="rounded-3xl p-5 flex items-start gap-4" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <Lock className="w-5 h-5 text-red-500" />
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Submissions are closed</p>
                <p className="text-xs text-muted mt-1">The deadline has passed and nothing was submitted. Speak to your teacher if you need more time.</p>
              </div>
            </div>
          )}

          {/* Submission studio */}
          {showForm && (
            <form onSubmit={handleSubmit}>
              <Panel icon={FileUp} title={isSubmitted ? 'Update your submission' : 'Submit your work'} tone={tone}
                right={isSubmitted && <button type="button" onClick={resetForm} className="text-xs font-semibold text-muted hover:text-primary-600">Cancel</button>}>
                <div className="space-y-5">
                  {isSubmitted && (
                    <p className="text-xs flex items-start gap-2 p-3 rounded-2xl" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--text-secondary)' }}>
                      <RefreshCw className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      Your files stay as they are — add more below, or remove the ones you want to replace.
                    </p>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        <Paperclip className="w-4 h-4" style={{ color: tone.accent }} /> Your files
                        <span className="text-xs text-muted font-normal">(up to {MAX_TASK_FILES})</span>
                      </p>
                      {totalCount > 0 && (
                        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full" style={{ background: tone.soft, color: tone.accent }}>
                          {totalCount} file{totalCount !== 1 ? 's' : ''} in this submission
                        </span>
                      )}
                    </div>
                    <FilePicker tone={tone} files={files} onChange={setFiles}
                      existing={existingFiles} removedIds={removedIds} onToggleExisting={toggleExisting}
                      disabled={saving} saving={saving} progress={progress}
                      title="Drag & drop your files" hint="several at once — PDF, Word, images, ZIP… up to 100 MB each" />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="flex items-center justify-between text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                      <span className="flex items-center gap-2"><PenLine className="w-4 h-4" style={{ color: tone.accent }} /> {isDiscussion ? 'Your group’s answer & comments' : 'Your answer & notes'} <span className="text-xs text-muted font-normal">(optional)</span></span>
                      <span className="text-[11px] font-medium text-muted">{notes.length}/2000</span>
                    </label>
                    <textarea value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} rows={6}
                      className="w-full rounded-2xl p-4 text-sm leading-relaxed outline-none resize-y transition-shadow"
                      style={{ background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)', minHeight: 130 }}
                      onFocus={e => { e.target.style.borderColor = tone.accent; e.target.style.boxShadow = `0 0 0 4px ${tone.soft}`; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--card-border)'; e.target.style.boxShadow = 'none'; }}
                      placeholder={isDiscussion ? 'Write what your group concluded, or add comments about the files you attached…' : 'Write your answer, or add comments about the files you attached…'} />
                    <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--card-border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(notes.length / 2000) * 100}%`, background: tone.accent }} />
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center justify-between gap-3 flex-wrap p-3 -mx-1 rounded-2xl" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
                    <p className="text-xs font-semibold flex items-center gap-1.5 pl-1" style={{ color: left.urgent ? '#ea580c' : 'var(--text-secondary)' }}>
                      <Clock className="w-3.5 h-3.5" /> {left.text}
                      {task.deadline_extended && <span className="ml-1 text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: tone.soft, color: tone.accent }}>extended</span>}
                    </p>
                    <button type="submit" disabled={saving || (totalCount === 0 && !notes.trim())}
                      className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
                      style={{ background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`, boxShadow: `0 10px 24px -6px ${tone.accent}` }}>
                      {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                      {saving ? 'Sending…'
                        : isSubmitted ? 'Save changes'
                        : isDiscussion ? `Submit for my group${totalCount ? ` · ${totalCount} file${totalCount !== 1 ? 's' : ''}` : ''}`
                        : `Submit work${totalCount ? ` · ${totalCount} file${totalCount !== 1 ? 's' : ''}` : ''}`}
                    </button>
                  </div>
                </div>
              </Panel>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Task card (list row) ────────────────────────────────────────────── */
function TaskCard({ a, onOpen, onPreview, cardRef, highlighted }) {
  const isSubmitted = !!a.submission_id;
  const isGraded = a.score !== null && a.score !== undefined;
  const overdue = new Date(a.deadline) < new Date();
  const tone = kindThemeOf(a.task_type, a.mode);
  const KindIcon = tone.icon;
  const members = a.group?.members || [];
  const status = isGraded
    ? { text: `Graded · ${a.score}/${a.max_score || 100}`, color: '#059669', bg: 'rgba(16,185,129,0.12)' }
    : isSubmitted ? { text: `Submitted${(a.submission_files || []).length > 1 ? ` · ${a.submission_files.length} files` : ''}`, color: '#2563eb', bg: 'rgba(59,130,246,0.12)' }
    : overdue ? { text: 'Not submitted', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' }
    : { text: 'To do', color: '#d97706', bg: 'rgba(245,158,11,0.14)' };

  return (
    <div ref={cardRef} onClick={() => onOpen(a)}
      className="group relative overflow-hidden rounded-3xl cursor-pointer transition-all hover:-translate-y-0.5"
      style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        boxShadow: highlighted ? `0 0 0 2px ${tone.accent}, 0 8px 24px ${tone.ring}` : undefined,
      }}>
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: `linear-gradient(180deg, ${tone.accent}, ${tone.accent2})` }} />
      <div className="p-5 pl-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white transition-transform group-hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`, boxShadow: `0 8px 18px -6px ${tone.accent}` }}>
          <KindIcon className="w-5 h-5" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: tone.accent }}>{tone.label}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: status.bg, color: status.color }}>{status.text}</span>
          </div>
          <h3 className="font-display font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
          {a.description && <p className="text-xs text-muted mt-1 line-clamp-1">{a.description}</p>}

          <div className="flex items-center gap-x-4 gap-y-1 mt-2.5 flex-wrap text-xs text-muted">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Due {new Date(a.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {a.max_score || 100} pts</span>
            {!isSubmitted && !overdue && <DeadlineBadge deadline={a.deadline} />}
            {a.deadline_extended && (
              <span className="flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px]" style={{ background: tone.soft, color: tone.accent }}
                title={`Originally due ${new Date(a.original_deadline).toLocaleString()}`}>
                <History className="w-3 h-3" /> Extended
              </span>
            )}
            {(a.attachments || []).length > 0 && (
              <span className="flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> {a.attachments.length} file{a.attachments.length !== 1 ? 's' : ''}</span>
            )}
            {isDiscussion(a) && a.group && (
              <span className="flex items-center gap-2">
                <span className="flex -space-x-2">{members.slice(0, 4).map((m, i) => <Avatar key={m.id} name={m.name} idx={i} size={22} />)}</span>
                <span className="font-semibold" style={{ color: tone.accent }}>{a.group.name}{members.length > 4 ? ` +${members.length - 4}` : ''}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {(a.attachments || []).length === 1 && (
            <button onClick={() => onPreview({ ...a.attachments[0], id: a.id, file_id: a.attachments[0].id, type: 'assignment', title: a.title, class_name: a.class_name })}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-surface-100"
              style={{ border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }} title="Preview attached file">
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => onOpen(a)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={isSubmitted || overdue
              ? { background: 'var(--surface-100)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }
              : { background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`, color: '#fff', boxShadow: `0 8px 18px -8px ${tone.accent}` }}>
            {isSubmitted ? 'View' : overdue ? 'Open' : <><Send className="w-3.5 h-3.5" /> Open & submit</>}
          </button>
        </div>
      </div>
    </div>
  );
}
const isDiscussion = (a) => a.mode === 'discussion';

/* ══════════════════════════════════════════════════════════════════════
   Page — Module → Kind (Assignment | Homework) → [Individual | Discussion]
   → task list → task workspace.
══════════════════════════════════════════════════════════════════════ */
export default function StudentAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  // 'modules' | 'type' | 'mode' | 'list' | 'task'
  const [view, setView] = useState('modules');
  const [selectedModule, setSelectedModule] = useState(null);
  const [taskType, setTaskType] = useState(null);   // 'assignment' | 'homework'
  const [mode, setMode] = useState(null);           // 'individual' | 'discussion'
  const [activeId, setActiveId] = useState(null);

  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [studentClass, setStudentClass] = useState(null);

  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const [viewingFile, setViewingFile] = useState(null);
  const [flashId, setFlashId] = useState(searchParams.get('highlight') || null);
  const cardRefs = useRef({});

  // Load the student's class + all modules assigned to that class
  useEffect(() => {
    const init = async () => {
      setLoadingModules(true);
      try {
        const clsRes = await api.get('/classes/my');
        const myClasses = clsRes.data.classes || [];
        if (myClasses.length === 0) { setLoadingModules(false); return; }
        const cls = myClasses[0];
        const classId = String(cls.id || cls._id);
        setStudentClass({ id: classId, name: cls.name });

        let fetchedModules = [];
        try {
          const res = await api.get('/assessment/student/courses');
          fetchedModules = res.data.courses || [];
        } catch {
          try {
            const res = await api.get('/assessment/admin/courses');
            const all = res.data.courses || [];
            fetchedModules = all.filter(c =>
              String(c.class_id?._id || c.class_id || '') === classId
            );
          } catch { /* ignore */ }
        }
        setModules(fetchedModules);

        // Came here from a notification — jump straight to the module, and to the task itself.
        const targetCourseId = searchParams.get('courseId');
        const highlight = searchParams.get('highlight');
        if (targetCourseId) {
          const match = fetchedModules.find(m => String(m._id) === targetCourseId);
          if (match) {
            setSelectedModule(match);
            if (highlight) {
              try {
                // The notification only knows the task id; learn its kind from the list.
                const r = await api.get('/assignments', { params: { classId, courseId: match._id, limit: 100 } });
                const hit = (r.data.assignments || []).find(a => String(a.id) === String(highlight));
                if (hit) {
                  setTaskType(hit.task_type || 'assignment');
                  setMode(hit.mode || 'individual');
                  setView('list');
                  return;
                }
              } catch { /* fall through */ }
            }
            setView('type');
          }
        }
      } catch {
        toast.error('Failed to load class info');
      } finally {
        setLoadingModules(false);
      }
    };
    init();
  }, []);

  // Fetch tasks for the selected module + kind
  const fetchAssignments = useCallback(async () => {
    if ((view !== 'list' && view !== 'task') || !selectedModule || !taskType) return;
    setLoading(true);
    try {
      const params = { search, page, limit: 10, taskType, mode: taskType === 'homework' ? 'individual' : mode };
      if (studentClass) params.classId = studentClass.id;
      params.courseId = selectedModule._id;
      if (filter !== 'all') params.status = filter;
      const res = await api.get('/assignments', { params });
      setAssignments(res.data.assignments || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [view, search, page, filter, selectedModule, studentClass, taskType, mode]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  /* ── jump to & highlight the task a notification pointed to ── */
  useEffect(() => {
    if (!flashId || loading || !assignments.length || view !== 'list') return;
    const el = cardRefs.current[flashId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => {
      setFlashId(null);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight'); next.delete('courseId'); next.delete('classId');
      setSearchParams(next, { replace: true });
    }, 3500);
    return () => clearTimeout(t);
  }, [flashId, loading, assignments, view]);

  const resetList = () => { setSearch(''); setFilter('all'); setPage(1); setAssignments([]); };

  const openModule = (mod) => { setSelectedModule(mod); setTaskType(null); setMode(null); resetList(); setView('type'); };
  const pickType = (type) => {
    setTaskType(type); resetList();
    if (type === 'homework') { setMode('individual'); setView('list'); }
    else { setMode(null); setView('mode'); }
  };
  const pickMode = (m) => { setMode(m); resetList(); setView('list'); };

  const goBack = () => {
    setAssignments([]);
    if (view === 'list') setView(taskType === 'homework' ? 'type' : 'mode');
    else if (view === 'mode') setView('type');
    else if (view === 'type') setView('modules');
  };

  // Group modules by TVET category order, same as student Documents.jsx
  const CATEGORY_ORDER = ['Specific modules', 'General modules', 'Complementary modules', 'Elective Non Examinable'];
  const grouped = {};
  CATEGORY_ORDER.forEach(cat => {
    const items = modules.filter(m => (m.category || '') === cat);
    if (items.length) grouped[cat] = items;
  });
  const uncategorised = modules.filter(m => !CATEGORY_ORDER.includes(m.category || ''));
  if (uncategorised.length) grouped['Other Modules'] = uncategorised;
  const hasGroups = Object.keys(grouped).length > 0;

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'graded', label: 'Graded' },
  ];

  /* ── Modules list view ── */
  if (view === 'modules') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Tasks</h2>
          <p className="text-sm text-muted">
            {studentClass ? `${studentClass.name} — select a module to view your tasks` : 'Select a module to view your tasks'}
          </p>
        </div>

        {loadingModules ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : !hasGroups ? (
          <div className="card text-center py-16">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted opacity-30" />
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No modules found</p>
            <p className="text-sm text-muted">
              {studentClass
                ? `No modules have been assigned to ${studentClass.name} yet.`
                : 'You are not enrolled in a class yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, mods]) => (
              <div key={cat}>
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2 px-1">{cat}</p>
                <div className="space-y-2">
                  {mods.map((mod, idx) => {
                    const color = moduleColor(idx);
                    return (
                      <button key={mod._id} onClick={() => openModule(mod)}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:scale-[1.005] active:scale-[0.99]"
                        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                        <div className={`w-12 h-12 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-sm font-bold ${color.text}`}>
                            {(mod.code || mod.name || '').slice(0, 3).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {mod.code && <p className={`text-xs font-bold ${color.text} mb-0.5`}>{mod.code}</p>}
                          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{mod.name}</p>
                          {mod.teacher_id?.name && <p className="text-xs text-muted mt-0.5">{mod.teacher_id.name}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const crumbs = (
    <div className="flex items-center gap-1.5 text-xs text-muted font-medium mb-0.5 flex-wrap">
      <BookOpen className="w-3 h-3" />
      <span>{studentClass?.name}</span>
      <ChevronRight className="w-3 h-3" />
      {selectedModule?.code && <span className="text-primary-600 font-bold">{selectedModule.code}</span>}
      {taskType && <><ChevronRight className="w-3 h-3" /><span>{taskType === 'homework' ? 'Homework' : 'Assignment'}</span></>}
      {taskType === 'assignment' && mode && <><ChevronRight className="w-3 h-3" /><span>{mode === 'discussion' ? 'Discussion' : 'Individual'}</span></>}
    </div>
  );

  /* ── Kind picker: Assignment | Homework ── */
  if (view === 'type') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div className="flex-1 min-w-0">
            {crumbs}
            <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>{selectedModule?.name}</h2>
            <p className="text-sm text-muted">Which tasks do you want to see?</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoiceCard icon={ClipboardList} color={{ bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600' }}
            title="Assignment" desc="Class work — done on your own, or together with your discussion group."
            onClick={() => pickType('assignment')} />
          <ChoiceCard icon={Home} color={{ bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-600' }}
            title="Homework" desc="Individual work to do at home, then submit."
            onClick={() => pickType('homework')} />
        </div>
      </div>
    );
  }

  /* ── Mode picker: Individual | Discussion ── */
  if (view === 'mode') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div className="flex-1 min-w-0">
            {crumbs}
            <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>Assignment</h2>
            <p className="text-sm text-muted">How are you working?</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoiceCard icon={User} color={{ bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600' }}
            title="Individual" desc="Tasks given to the whole class that you do on your own."
            onClick={() => pickMode('individual')} />
          <ChoiceCard icon={Users} color={{ bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600' }}
            title="Discussion" desc="Tasks given to your group — see them with your group members."
            onClick={() => pickMode('discussion')} />
        </div>
      </div>
    );
  }

  /* ── Task workspace ── */
  if (view === 'task') {
    const active = assignments.find(a => String(a.id) === String(activeId));
    if (!active) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      );
    }
    return (
      <>
        <TaskWorkspace task={active} onBack={() => { setView('list'); setActiveId(null); }}
          onChanged={fetchAssignments} onPreview={setViewingFile} />
        {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
      </>
    );
  }

  /* ── Task list view ── */
  const kindWord = taskType === 'homework' ? 'homework' : mode === 'discussion' ? 'group task' : 'assignment';
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={goBack} className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div className="flex-1 min-w-0">
          {crumbs}
          <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>{selectedModule?.name}</h2>
          <p className="text-sm text-muted">{total} {kindWord}{total !== 1 && taskType !== 'homework' ? 's' : ''} available</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit max-w-full overflow-x-auto" style={{ background: 'var(--card-border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setFilter(t.key); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === t.key ? 'bg-white dark:bg-neutral-800 shadow-sm text-primary-600' : 'text-muted hover:text-primary-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input-field pl-10" placeholder="Search tasks…" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="card text-center py-16">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {mode === 'discussion' ? 'No group task for you here' : `No ${kindWord} posted`}
          </p>
          <p className="text-sm text-muted">
            {filter !== 'all'
              ? `Nothing marked "${filter}" for ${selectedModule?.name}.`
              : mode === 'discussion'
                ? <>Tasks given to your group in <strong>{selectedModule?.name}</strong> will show up here.</>
                : <>Your teacher hasn't posted any {kindWord} for <strong>{selectedModule?.name}</strong> yet.</>}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <TaskCard
              key={a.id}
              a={a}
              onPreview={setViewingFile}
              onOpen={(task) => { setActiveId(task.id); setView('task'); }}
              cardRef={el => { cardRefs.current[a.id] = el; }}
              highlighted={flashId === a.id}
            />
          ))}
        </div>
      )}

      {total > 10 && <Pagination page={page} totalPages={Math.ceil(total / 10)} onPageChange={setPage} />}

      {viewingFile && <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>
  );
}