/**
 * TaskFiles.jsx — building blocks for tasks that carry MORE THAN ONE file.
 *
 *  FilePicker          multi-file drop zone + staged file cards. Used by the
 *                      teacher's task form (attachments) and the student's
 *                      submission studio.
 *  FileRows            read-only list of files with View / Download actions.
 *  ExtendDeadlineModal teacher pushes a task's deadline later.
 *
 * Every component takes a `tone` ({ accent, accent2, soft, ring }) so it picks
 * up the colour of whichever kind of task it is shown for.
 */
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import Modal from './Modal';
import {
  CloudUpload, X, Eye, Download, Undo2, Plus, CalendarClock,
  ArrowRight, Bell, BellOff, History, Clock,
} from 'lucide-react';

export const MAX_TASK_FILES = 10;

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().slice(0, 4).toUpperCase() : 'FILE');

const sameFile = (a, b) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/* Square badge showing a file's extension. */
export function FileBadge({ name, tone, size = 44, muted }) {
  return (
    <span className="rounded-xl flex items-center justify-center font-extrabold text-white flex-shrink-0 tracking-wide select-none"
      style={{
        width: size, height: size, fontSize: Math.max(9, size * 0.24),
        background: muted ? 'var(--card-border)' : `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`,
        boxShadow: muted ? 'none' : `0 6px 14px -4px ${tone.ring}`,
        color: muted ? 'var(--text-secondary)' : '#fff',
      }}>
      {extOf(name)}
    </span>
  );
}

const STYLES = `
  @keyframes tf-rise { from { opacity: 0; transform: translateY(10px) scale(.98) } to { opacity: 1; transform: none } }
  @keyframes tf-ring { 0% { transform: scale(.85); opacity: .55 } 100% { transform: scale(1.5); opacity: 0 } }
  @keyframes tf-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
  @keyframes tf-shine { from { background-position: -200% 0 } to { background-position: 200% 0 } }
  .tf-card { animation: tf-rise .38s cubic-bezier(.2,.8,.2,1) both }
  .tf-shimmer { background-size: 200% 100%; animation: tf-shine 2.2s linear infinite }
  @media (prefers-reduced-motion: reduce) { .tf-card, .tf-shimmer { animation: none } }
`;

/**
 * Multi-file drop zone.
 *
 *  files             File[] picked in this session (controlled)
 *  onChange(files)   called with the next File[]
 *  existing          files already saved on the server: [{ id, original_name, size }]
 *  removedIds        ids of `existing` the user marked for removal
 *  onToggleExisting  (id) => void — mark / unmark an existing file for removal
 *  max               cap on kept + new files together
 *  progress / saving upload state, shows a progress bar while true
 */
export function FilePicker({
  tone, files, onChange, existing = [], removedIds = [], onToggleExisting,
  max = MAX_TASK_FILES, disabled, saving, progress = 0,
  title = 'Drag & drop your files', hint = 'PDF, Word, images, ZIP… up to 100 MB each',
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const keptExisting = existing.filter(f => !removedIds.includes(f.id));
  const used = keptExisting.length + files.length;
  const full = used >= max;
  const hasAny = existing.length > 0 || files.length > 0;
  const newBytes = files.reduce((n, f) => n + f.size, 0);

  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const fresh = incoming.filter(f => !files.some(x => sameFile(x, f)));
    if (fresh.length < incoming.length) toast('Skipped files that were already added', { icon: 'ℹ️' });
    const room = max - used;
    if (room <= 0) return toast.error(`You can add at most ${max} files`);
    if (fresh.length > room) toast.error(`Only ${max} files allowed — added the first ${room}`);
    const take = fresh.slice(0, room);
    if (take.length) onChange([...files, ...take]);
  };

  const removeNew = (i) => onChange(files.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <style>{STYLES}</style>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled && !full) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (!disabled) addFiles(e.dataTransfer.files); }}
        onClick={() => !disabled && !saving && !full && inputRef.current?.click()}
        role="button" tabIndex={0} aria-disabled={disabled || full}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !disabled && !full) { e.preventDefault(); inputRef.current?.click(); } }}
        className="relative rounded-3xl text-center overflow-hidden transition-all"
        style={{
          padding: hasAny ? '18px 16px' : '38px 20px',
          cursor: disabled || full ? 'not-allowed' : 'pointer',
          opacity: full && !dragOver ? 0.7 : 1,
          border: `2px dashed ${dragOver ? tone.accent : hasAny ? tone.ring : 'var(--input-border)'}`,
          background: dragOver ? tone.soft : 'transparent',
          transform: dragOver ? 'scale(1.012)' : 'none',
        }}>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

        <div className={hasAny ? 'flex items-center justify-center gap-3' : ''}>
          <span className="relative inline-flex items-center justify-center flex-shrink-0"
            style={{ width: hasAny ? 40 : 68, height: hasAny ? 40 : 68, marginBottom: hasAny ? 0 : 12 }}>
            {dragOver && <span aria-hidden className="absolute inset-0 rounded-3xl" style={{ background: tone.accent, animation: 'tf-ring 1.1s ease-out infinite' }} />}
            <span className="relative w-full h-full rounded-3xl flex items-center justify-center"
              style={{ background: tone.soft, animation: !hasAny && !dragOver ? 'tf-bob 3.2s ease-in-out infinite' : 'none' }}>
              {hasAny ? <Plus className="w-5 h-5" style={{ color: tone.accent }} /> : <CloudUpload className="w-8 h-8" style={{ color: tone.accent }} />}
            </span>
          </span>
          <div className={hasAny ? 'text-left' : ''}>
            <p className={`${hasAny ? 'text-sm' : 'text-base'} font-bold`} style={{ color: 'var(--text-primary)' }}>
              {full ? `Limit reached — ${max} files` : dragOver ? 'Drop them here!' : hasAny ? 'Add more files' : title}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {full ? 'Remove a file to add another one'
                : <>or <span className="font-bold" style={{ color: tone.accent }}>browse your device</span> · {hint}</>}
            </p>
          </div>
        </div>

        {/* counter chip */}
        <span className="absolute top-3 right-3 text-[11px] font-extrabold px-2.5 py-1 rounded-full"
          style={{ background: tone.soft, color: tone.accent }}>
          {used}/{max}
        </span>
      </div>

      {/* Already-saved files (resubmitting / editing) */}
      {existing.length > 0 && (
        <ul className="space-y-2">
          {existing.map((f, i) => {
            const gone = removedIds.includes(f.id);
            return (
              <li key={f.id} className="tf-card flex items-center gap-3 p-2.5 pr-3 rounded-2xl transition-all"
                style={{ animationDelay: `${i * 40}ms`, background: 'var(--surface-100)', border: '1px solid var(--card-border)', opacity: gone ? 0.5 : 1 }}>
                <FileBadge name={f.original_name} tone={tone} size={40} muted={gone} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)', textDecoration: gone ? 'line-through' : 'none' }}>{f.original_name || 'File'}</p>
                  <p className="text-[11px] text-muted mt-0.5">{gone ? 'Will be removed when you save' : `Already uploaded${f.size ? ` · ${formatSize(f.size)}` : ''}`}</p>
                </div>
                {onToggleExisting && !saving && (
                  <button type="button" onClick={() => onToggleExisting(f.id)}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-surface-200"
                    style={{ color: gone ? tone.accent : 'var(--text-secondary)' }}>
                    {gone ? <><Undo2 className="w-3.5 h-3.5" /> Keep</> : <><X className="w-3.5 h-3.5" /> Remove</>}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Newly picked files */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${f.lastModified}`} className="tf-card flex items-center gap-3 p-2.5 pr-3 rounded-2xl"
              style={{ animationDelay: `${i * 45}ms`, background: tone.soft, border: `1px solid ${tone.ring}` }}>
              <FileBadge name={f.name} tone={tone} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</p>
                <p className="text-[11px] text-muted mt-0.5">{formatSize(f.size)} · {saving ? 'uploading…' : 'ready to send'}</p>
              </div>
              {!saving && (
                <button type="button" onClick={() => removeNew(i)} title="Remove file" aria-label={`Remove ${f.name}`}
                  className="p-2 rounded-xl transition-colors hover:bg-red-50 hover:text-red-500">
                  <X className="w-4 h-4 text-muted" />
                </button>
              )}
            </li>
          ))}
          <li className="flex items-center justify-between text-[11px] font-semibold text-muted px-1">
            <span>{files.length} new file{files.length !== 1 ? 's' : ''} · {formatSize(newBytes)}</span>
            {!saving && <button type="button" onClick={() => onChange([])} className="font-bold hover:text-red-500 transition-colors">Clear all</button>}
          </li>
        </ul>
      )}

      {/* Upload progress */}
      {saving && files.length > 0 && (
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span>{progress < 100 ? `Uploading ${files.length} file${files.length !== 1 ? 's' : ''}…` : 'Finishing up…'}</span><span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
            <div className="h-full rounded-full tf-shimmer transition-all duration-300"
              style={{ width: `${progress}%`, backgroundImage: `linear-gradient(90deg, ${tone.accent}, ${tone.accent2}, ${tone.accent})` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Read-only list of files. `onView(file)` / `onDownload(file)` are optional.
 */
export function FileRows({ files = [], tone, onView, onDownload, hint, dense }) {
  if (!files.length) return null;
  return (
    <ul className="space-y-2">
      <style>{STYLES}</style>
      {files.map((f, i) => (
        <li key={f.id || i} className="tf-card group flex items-center gap-3 p-2.5 pr-3 rounded-2xl transition-all hover:-translate-y-0.5"
          style={{ animationDelay: `${i * 45}ms`, background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
          <FileBadge name={f.original_name} tone={tone} size={dense ? 36 : 44} />
          <button type="button" disabled={!onView} onClick={() => onView?.(f)} className="flex-1 min-w-0 text-left">
            <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{f.original_name || 'File'}</span>
            <span className="block text-[11px] text-muted mt-0.5">{[hint, f.size ? formatSize(f.size) : null].filter(Boolean).join(' · ') || 'Attached file'}</span>
          </button>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onView && (
              <button type="button" onClick={() => onView(f)} title="View"
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                style={{ background: tone.soft, color: tone.accent }}>
                <Eye className="w-3.5 h-3.5" /> View
              </button>
            )}
            {onDownload && (
              <button type="button" onClick={() => onDownload(f)} title="Download" aria-label={`Download ${f.original_name}`}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-surface-200" style={{ color: 'var(--text-secondary)' }}>
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, '0');
// Date → value for <input type="datetime-local"> (local time).
export const toLocalInput = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const fmtWhen = (d) => new Date(d).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function diffText(ms) {
  const mins = Math.round(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const parts = [];
  if (d) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
  if (h) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
  if (!d && !h) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

const QUICK = [
  { label: '+1 day', ms: 86400000 },
  { label: '+3 days', ms: 3 * 86400000 },
  { label: '+1 week', ms: 7 * 86400000 },
  { label: '+2 weeks', ms: 14 * 86400000 },
];

/**
 * Teacher: give students more time. `task` needs { id, title, deadline,
 * is_active, deadline_history? }. Calls onDone() after a successful save.
 */
export function ExtendDeadlineModal({ task, tone, onClose, onDone }) {
  const current = new Date(task.deadline);
  // Quick chips count from the later of "current deadline" and "now", so a
  // task that already closed is reopened relative to today.
  const base = Math.max(current.getTime(), Date.now());
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const next = value ? new Date(value) : null;
  const valid = next && !isNaN(next) && next > current && next > new Date();
  const closed = current <= new Date();
  const history = [...(task.deadline_history || [])].reverse();

  const save = async () => {
    if (!valid) return toast.error('Pick a time later than the current deadline');
    setSaving(true);
    try {
      const res = await api.patch(`/assignments/${task.id}/extend-deadline`, { deadline: next.toISOString(), reason, notify });
      toast.success('Deadline extended');
      onDone?.(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not extend the deadline');
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Extend deadline" icon={CalendarClock} accent={tone.accent} accent2={tone.accent2}>
      <style>{STYLES}</style>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
          <p className="text-xs text-muted mt-0.5">
            {closed ? 'Submissions are closed — extending reopens them for every student who can still submit.' : 'Students keep working and can still resubmit until the new time.'}
          </p>
        </div>

        {/* Before → after */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="rounded-2xl p-3.5" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">Now</p>
            <p className="text-sm font-bold mt-1" style={{ color: closed ? '#dc2626' : 'var(--text-primary)' }}>{fmtWhen(current)}</p>
            {closed && <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#dc2626' }}>Closed</p>}
          </div>
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`, opacity: valid ? 1 : 0.4, transition: 'opacity .2s' }}>
            <ArrowRight className="w-4 h-4" />
          </span>
          <div className="rounded-2xl p-3.5 transition-all"
            style={valid
              ? { background: tone.soft, border: `1px solid ${tone.ring}` }
              : { background: 'var(--surface-100)', border: '1px dashed var(--input-border)' }}>
            <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: valid ? tone.accent : 'var(--text-secondary)' }}>New</p>
            <p className="text-sm font-bold mt-1" style={{ color: valid ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{valid ? fmtWhen(next) : 'Pick a time below'}</p>
            {valid && <p className="text-[11px] font-semibold mt-0.5" style={{ color: tone.accent }}>+{diffText(next - current)}</p>}
          </div>
        </div>

        {/* Quick picks */}
        <div>
          <label className="label">Give them</label>
          <div className="flex flex-wrap gap-2">
            {QUICK.map(q => {
              const v = toLocalInput(new Date(base + q.ms));
              const on = value === v;
              return (
                <button key={q.label} type="button" onClick={() => setValue(v)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                  style={on
                    ? { background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`, color: '#fff', boxShadow: `0 6px 14px -6px ${tone.accent}` }
                    : { background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">…or choose an exact time</label>
          <input type="datetime-local" value={value} min={toLocalInput(new Date(Math.max(current.getTime(), Date.now()) + 60000))}
            onChange={e => setValue(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="label flex items-center justify-between">
            <span>Note to students <span className="text-muted font-normal">(optional)</span></span>
            <span className="text-[11px] text-muted font-normal">{reason.length}/300</span>
          </label>
          <input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} className="input-field" placeholder="e.g. Internet was down on Friday" />
        </div>

        <button type="button" onClick={() => setNotify(n => !n)} disabled={!task.is_active}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all disabled:opacity-60"
          style={{ background: notify && task.is_active ? tone.soft : 'var(--surface-100)', border: `1px solid ${notify && task.is_active ? tone.ring : 'var(--card-border)'}` }}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: notify && task.is_active ? tone.soft : 'var(--card-border)' }}>
            {notify && task.is_active ? <Bell className="w-4 h-4" style={{ color: tone.accent }} /> : <BellOff className="w-4 h-4 text-muted" />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {!task.is_active ? 'Task is hidden — nobody to notify' : notify ? 'Tell students about the new deadline' : 'Extend quietly'}
            </span>
            <span className="block text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {notify && task.is_active ? 'They get a notification, and an email if they haven’t submitted yet.' : 'The deadline changes without any message.'}
            </span>
          </span>
        </button>

        {history.length > 0 && (
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Earlier extensions</p>
            <ul className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {history.map((h, i) => (
                <li key={i} className="text-xs flex items-start gap-2 p-2.5 rounded-xl" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
                  <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: tone.accent }} />
                  <span className="min-w-0">
                    <span className="line-through">{fmtWhen(h.from)}</span> → <strong style={{ color: 'var(--text-primary)' }}>{fmtWhen(h.to)}</strong>
                    {h.reason && <span className="block italic mt-0.5">“{h.reason}”</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={save} disabled={!valid || saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`, boxShadow: `0 10px 22px -8px ${tone.accent}` }}>
            {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CalendarClock className="w-4 h-4" />}
            Extend deadline
          </button>
        </div>
      </div>
    </Modal>
  );
}

