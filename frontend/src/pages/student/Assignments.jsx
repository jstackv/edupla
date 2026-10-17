import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import FileViewer from '../../components/common/FileViewer';
import {
  Search, ClipboardList, Upload, Eye,
  Clock, CheckCircle2, AlertTriangle, Award, X, CloudUpload, FileText, RefreshCw,
  BookOpen, ChevronRight, ArrowLeft, Inbox, Home, User, Users, Lock, Paperclip,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

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
   Task workspace — one task, full width: instructions on one side, the
   submission space on the other (file drop-zone, notes, status, grade).
══════════════════════════════════════════════════════════════════════ */
function TaskWorkspace({ task, onBack, onChanged, onPreview }) {
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState(task.submission_notes || '');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(false);   // re-opening the form after a submission
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef(null);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  // Keep the form in step when the task is refreshed after a submit.
  useEffect(() => { setNotes(task.submission_notes || ''); setFile(null); setEditing(false); }, [task.id, task.submission_id, task.submitted_at]);

  const isSubmitted = !!task.submission_id;
  const isGraded = task.score !== null && task.score !== undefined;
  const left = timeLeft(task.deadline, now);
  const overdue = left.overdue;
  const canSubmit = !overdue && !isGraded;           // first submit, or resubmit until graded/deadline
  const showForm = canSubmit && (!isSubmitted || editing);
  const max = task.max_score || 100;
  const pct = isGraded ? Math.round((task.score / max) * 100) : null;

  const pickFile = (f) => { if (f) setFile(f); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !notes.trim() && !task.has_submission_file) return toast.error('Attach a file or write a note first');
    setSaving(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      fd.append('notes', notes);
      await api.post(`/assignments/${task.id}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(isSubmitted ? 'Resubmitted successfully!' : 'Submitted successfully!');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    }
    setSaving(false);
  };

  const steps = [
    { label: 'Assigned', done: true },
    { label: 'Submitted', done: isSubmitted },
    { label: 'Graded', done: isGraded },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted font-medium mb-0.5">
            <BookOpen className="w-3 h-3" /> <span>{task.class_name}</span>
            <ChevronRight className="w-3 h-3" /> <span>{task.course_code || task.course_name}</span>
          </div>
          <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="card">
        <div className="flex items-center">
          {steps.map((st, i) => (
            <div key={st.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${st.done ? 'bg-emerald-500 text-white' : ''}`}
                  style={st.done ? undefined : { background: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                  {st.done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-xs font-semibold" style={{ color: st.done ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{st.label}</span>
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-0.5 mx-3 rounded" style={{ background: steps[i + 1].done ? '#10b981' : 'var(--card-border)' }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* ── Task details ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <KindBadge taskType={task.task_type} mode={task.mode} />
              {task.teacher_name && <span className="text-xs text-muted">by {task.teacher_name}</span>}
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: overdue ? '#dc2626' : left.urgent ? '#ea580c' : 'var(--text-primary)' }}>
              <Clock className="w-4 h-4" />
              <span className="font-semibold">{left.text}</span>
            </div>
            <p className="text-xs text-muted -mt-1">
              Due {new Date(task.deadline).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}Max score {max}
            </p>
            <div>
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Instructions</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {task.description || 'No written instructions — see the attached file, if any.'}
              </p>
            </div>
            {task.filename && (
              <button
                onClick={() => onPreview({ ...task, type: 'assignment', original_name: task.original_name || task.filename })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                style={{ background: 'var(--card-border)', border: '1px solid var(--input-border)' }}>
                <Paperclip className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.original_name || 'Attached file'}</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-primary-600"><Eye className="w-3.5 h-3.5" /> Open</span>
              </button>
            )}
          </div>

          {/* Group + teammates (discussion tasks) */}
          {task.mode === 'discussion' && task.group && (
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{task.group.name}</p>
                <span className="text-xs text-muted">· {task.group.members.length} members</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {task.group.members.map(m => (
                  <span key={m.id} className="badge text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{m.name}</span>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">Work through it together — each member then submits their own copy.</p>
            </div>
          )}
        </div>

        {/* ── Submission space ── */}
        <div className="lg:col-span-3 space-y-4">
          {isGraded && (
            <div className="card flex items-center gap-4" style={{ border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.06)' }}>
              <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                style={{ background: pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444', color: '#fff' }}>
                <span className="text-xl font-bold leading-none">{task.score}</span>
                <span className="text-[10px] opacity-80">/ {max}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Graded — {pct}%</p>
                {task.feedback
                  ? <p className="text-sm italic mt-0.5" style={{ color: 'var(--text-secondary)' }}>“{task.feedback}”</p>
                  : <p className="text-xs text-muted mt-0.5">No written feedback.</p>}
              </div>
            </div>
          )}

          {/* What you've already handed in */}
          {isSubmitted && !showForm && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Your submission
                </p>
                <span className="text-xs text-muted">{new Date(task.submitted_at).toLocaleString()}</span>
              </div>
              {task.has_submission_file ? (
                <button
                  onClick={() => onPreview({ type: 'submission', id: task.submission_id, submission_id: task.submission_id, file_url: task.submission_file_url, original_name: task.submission_file_name, title: `${task.title} — my submission` })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                  style={{ background: 'var(--card-border)', border: '1px solid var(--input-border)' }}>
                  <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.submission_file_name || 'Submitted file'}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary-600"><Eye className="w-3.5 h-3.5" /> View</span>
                </button>
              ) : <p className="text-xs text-muted">No file attached.</p>}
              {task.submission_notes && (
                <div className="p-3 rounded-xl text-sm whitespace-pre-wrap" style={{ background: 'var(--card-border)', color: 'var(--text-secondary)' }}>{task.submission_notes}</div>
              )}
              {canSubmit ? (
                <button onClick={() => setEditing(true)} className="btn-secondary text-sm"><RefreshCw className="w-4 h-4" /> Edit / resubmit</button>
              ) : (
                <p className="text-xs text-muted flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {isGraded ? 'This task has been graded, so it can no longer be changed.' : 'The deadline has passed, so it can no longer be changed.'}</p>
              )}
            </div>
          )}

          {/* Locked: deadline passed and nothing handed in */}
          {!isSubmitted && overdue && (
            <div className="card flex items-start gap-3" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Submissions are closed</p>
                <p className="text-xs text-muted mt-0.5">The deadline has passed and nothing was submitted. Speak to your teacher if you need more time.</p>
              </div>
            </div>
          )}

          {/* Submission form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="card space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Upload className="w-4 h-4 text-primary-500" /> {isSubmitted ? 'Resubmit your work' : 'Submit your work'}
                </p>
                {isSubmitted && <button type="button" onClick={() => { setEditing(false); setFile(null); setNotes(task.submission_notes || ''); }} className="text-xs text-muted hover:text-primary-600">Cancel</button>}
              </div>
              {isSubmitted && (
                <p className="text-xs flex items-start gap-1.5 p-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--text-secondary)' }}>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  Your previous submission will be replaced. Leave the file empty to keep the one you already uploaded.
                </p>
              )}

              {/* Drop-zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); }}
                onClick={() => inputRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                className="rounded-2xl text-center cursor-pointer transition-all"
                style={{
                  padding: file ? '18px' : '36px 18px',
                  border: `2px dashed ${dragOver ? '#c2410c' : 'var(--input-border)'}`,
                  background: dragOver ? 'rgba(194,65,12,0.06)' : 'transparent',
                }}>
                <input ref={inputRef} type="file" className="hidden" onChange={e => pickFile(e.target.files[0])} />
                {file ? (
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                      <p className="text-xs text-muted">{formatSize(file.size)} · click to replace</p>
                    </div>
                    <button type="button" onClick={ev => { ev.stopPropagation(); setFile(null); }} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500" title="Remove file">
                      <X className="w-4 h-4 text-muted" />
                    </button>
                  </div>
                ) : (
                  <>
                    <CloudUpload className="w-10 h-10 mx-auto mb-2 text-primary-500 opacity-70" />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Drag & drop your file here</p>
                    <p className="text-xs text-muted mt-0.5">or <span className="text-primary-600 font-semibold">browse your device</span> · up to 100 MB</p>
                  </>
                )}
              </div>

              <div>
                <label className="label">Notes for your teacher <span className="text-muted font-normal">(optional)</span></label>
                <textarea value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)}
                  className="input-field resize-y" rows={5} placeholder="Write your answer, or add comments about the file you attached…" />
                <p className="text-[11px] text-muted text-right mt-1">{notes.length}/2000</p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                <p className="text-xs text-muted flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {left.text}</p>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isSubmitted ? 'Resubmit' : 'Submit work'}
                </button>
              </div>
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

  return (
    <div ref={cardRef} className="card hover:shadow-soft transition-all cursor-pointer" onClick={() => onOpen(a)}
      style={highlighted ? { boxShadow: '0 0 0 2px #c2410c, 0 8px 24px rgba(194, 65, 12,0.25)', transition: 'box-shadow 0.4s ease' } : undefined}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isGraded ? 'bg-emerald-100 dark:bg-emerald-900/30' :
          isSubmitted ? 'bg-blue-100 dark:bg-blue-900/30' :
          overdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
        }`}>
          {isGraded ? <Award className="w-5 h-5 text-emerald-600" />
            : isSubmitted ? <CheckCircle2 className="w-5 h-5 text-blue-600" />
            : overdue ? <AlertTriangle className="w-5 h-5 text-red-600" />
            : <Clock className="w-5 h-5 text-amber-600" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <KindBadge taskType={a.task_type} mode={a.mode} />
                <DeadlineBadge deadline={a.deadline} />
                {isGraded && (
                  <span className={`badge text-xs ${a.score >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : a.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    Score: {a.score}/{a.max_score || 100}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {a.filename && (
                <button onClick={() => onPreview({ ...a, type: 'assignment', original_name: a.original_name || a.filename })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--card-border)', color: 'var(--text-primary)', border: '1px solid var(--input-border)' }}
                  title="Preview attached file">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              )}
              <button onClick={() => onOpen(a)} className={isSubmitted || overdue ? 'btn-secondary py-1.5 text-xs' : 'btn-primary py-1.5 text-xs'}>
                {isSubmitted ? 'View' : overdue ? 'Open' : <><Upload className="w-3.5 h-3.5" /> Open & submit</>}
              </button>
            </div>
          </div>

          {a.description && <p className="text-xs text-muted mt-2 line-clamp-2">{a.description}</p>}

          {a.mode === 'discussion' && a.group && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <Users className="w-3 h-3 text-violet-600" />
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">{a.group.name}</span>
              <span className="text-xs text-muted">· {a.group.members.map(m => m.name).join(', ')}</span>
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 pt-3 flex-wrap" style={{ borderTop: '1px solid var(--card-border)' }}>
            <span className="text-xs text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" /> Due {new Date(a.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-xs text-muted flex items-center gap-1"><Award className="w-3 h-3" /> Max: {a.max_score || 100}</span>
            <span className="text-xs font-medium ml-auto" style={{ color: isGraded ? '#059669' : isSubmitted ? '#2563eb' : overdue ? '#dc2626' : '#d97706' }}>
              {isGraded ? 'Graded' : isSubmitted ? 'Submitted' : overdue ? 'Not submitted' : 'To do'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
