/**
 * AddAttemptModal.jsx
 *
 * A focused action for a shared assessment: give students one (or more)
 * extra attempts without needing the full "new assessment" notification
 * blast that the Share modal sends. Useful when a student needs another try
 * to show they've understood the material.
 *
 * By default the extra attempt(s) go to the whole class, same as before.
 * The teacher can instead target specific students — the roster (with each
 * student's current attempts-used) is loaded from the same endpoint the
 * results/mark-sheet view uses. Once specific students are picked, only
 * those students get the extra attempt(s); everyone else keeps whatever
 * cap they already had, unless/until every student in the class ends up
 * selected, which is equivalent to (and communicated to the backend as)
 * applying to the whole class.
 *
 * Optionally, the teacher can also set the timing of this extra attempt —
 * a duration, WHEN it becomes startable ("available from" — the attempt is
 * granted right away, but students can't actually begin it until this
 * moment arrives), and an expiry date/time — without touching anything
 * else (instructions, notification behaviour) the way a full re-share
 * would. That timing change always applies assessment-wide regardless of
 * which students the attempts themselves go to.
 *
 * API contract:
 *   GET  /assessment/teacher/assessments/:id/attempts                 -> { assessment, rows } (student roster)
 *   POST /assessment/teacher/assessments/:id/attempts/add
 *     body: { additional_attempts, student_ids?, duration_minutes?, available_from?, expires_at? }
 *     student_ids omitted/empty -> applies to the whole class
 *     available_from omitted    -> students can start as soon as they have attempts left
 */
import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  PlusCircle, Loader2, Minus, Plus, Clock, CalendarClock, CalendarPlus,
  Users, User, Search, X, Check, Sparkles, ArrowRight, Zap, Sun, Moon, CalendarDays,
} from 'lucide-react';

function pad(n) { return String(n).padStart(2, '0'); }
function toDatetimeLocal(value) {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Unlike expiry (which always resolves to something concrete), "available
// from" defaults to blank — blank means "students can start right away".
function toDatetimeLocalOrEmpty(value) {
  if (!value) return '';
  return toDatetimeLocal(value);
}
function fromNow(minutes) {
  return toDatetimeLocal(new Date(Date.now() + minutes * 60000));
}
function todayAt(hour, minute = 0) {
  const d = new Date(); d.setHours(hour, minute, 0, 0);
  return toDatetimeLocal(d);
}
function tomorrowAt(hour, minute = 0) {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(hour, minute, 0, 0);
  return toDatetimeLocal(d);
}
function nextMondayAt(hour = 8) {
  const d = new Date();
  const diff = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + diff); d.setHours(hour, 0, 0, 0);
  return toDatetimeLocal(d);
}
function daysFromNowEndOfDay(n) {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(23, 59, 0, 0);
  return toDatetimeLocal(d);
}
function fmtShort(v) {
  if (!v) return null;
  return new Date(v).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const AVATAR_PALETTE = [
  ['#6366f1', '#8b5cf6'], ['#ec4899', '#f43f5e'], ['#f59e0b', '#f97316'],
  ['#10b981', '#0ea5e9'], ['#8b5cf6', '#ec4899'], ['#0ea5e9', '#6366f1'],
];
function avatarGradient(name) {
  const s = name || '?';
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

/* Slim horizontal preview of the attempt's open window — "available from"
   through "expires at" — with a live "now" marker, so the teacher can see
   at a glance whether the window they've configured actually makes sense
   before saving. */
function TimingPreview({ availableFrom, expiresAt }) {
  if (!availableFrom && !expiresAt) return null;
  const now = Date.now();
  const start = availableFrom ? new Date(availableFrom).getTime() : now;
  const end = expiresAt ? new Date(expiresAt).getTime() : null;
  const invalid = end != null && end <= start;
  let nowPct = null;
  if (end && end > start) nowPct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));

  return (
    <div className="aam-timeline p-3 rounded-xl" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <CalendarDays className="w-3 h-3" /> Attempt window preview
        </span>
        {invalid && <span className="text-[11px] font-bold" style={{ color: '#ef4444' }}>Start is after expiry</span>}
      </div>
      <div className="aam-timeline-track">
        <div className="aam-timeline-fill" style={{ opacity: invalid ? 0.35 : 1 }} />
        {nowPct != null && !invalid && (
          <div className="aam-timeline-now" style={{ left: `${nowPct}%` }} title={`Now — ${fmtShort(now)}`} />
        )}
      </div>
      <div className="flex justify-between text-[11px] mt-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1"><Sun className="w-3 h-3" style={{ color: '#8b5cf6' }} /> {availableFrom ? fmtShort(availableFrom) : 'Opens immediately'}</span>
        <span className="flex items-center gap-1">{expiresAt ? fmtShort(expiresAt) : 'No expiry'} <Moon className="w-3 h-3" style={{ color: '#6366f1' }} /></span>
      </div>
    </div>
  );
}

export default function AddAttemptModal({ assessment, onClose, onAdded }) {
  const [additional, setAdditional] = useState(1);
  const [setTiming, setSetTiming] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(assessment.duration_minutes || 30);
  const [availableFrom, setAvailableFrom] = useState(toDatetimeLocalOrEmpty(assessment.available_from));
  const [expiresAt, setExpiresAt] = useState(toDatetimeLocal(assessment.expires_at));
  const [saving, setSaving] = useState(false);

  // ── Student targeting ──────────────────────────────────────────────────
  const [target, setTarget] = useState('all');
  const [roster, setRoster] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterError, setRosterError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [search, setSearch] = useState('');

  // See original note: only `target`/`assessment.id` are dependencies here —
  // NOT `roster.length`/`loadingRoster`, or the `setLoadingRoster(true)` call
  // below would re-trigger this same effect and cancel itself before the
  // request ever resolves.
  useEffect(() => {
    if (target !== 'selected' || roster.length || loadingRoster) return;
    let cancelled = false;
    setLoadingRoster(true);
    setRosterError(null);
    api.get(`/assessment/teacher/assessments/${assessment.id}/attempts`)
      .then(({ data }) => { if (!cancelled) setRoster(data.rows || []); })
      .catch(err => { if (!cancelled) setRosterError(err.response?.data?.message || 'Failed to load students'); })
      .finally(() => { if (!cancelled) setLoadingRoster(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, assessment.id]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(s => s.student_name?.toLowerCase().includes(q));
  }, [roster, search]);

  const allSelected = roster.length > 0 && selectedIds.size === roster.length;

  const toggleStudent = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(roster.map(s => s.student_id)));

  const currentMax = assessment.max_attempts || 1;
  const newMax = currentMax + (Number(additional) || 0);
  const selectedCount = selectedIds.size;

  const handleAdd = async () => {
    if (!additional || Number(additional) < 1) return toast.error('Add at least 1 attempt.');
    if (setTiming) {
      if (!durationMinutes || Number(durationMinutes) <= 0) return toast.error('Set a duration greater than 0 minutes.');
      if (availableFrom && expiresAt && new Date(availableFrom) >= new Date(expiresAt)) {
        return toast.error('The start time must be before the expiry date/time.');
      }
      if (expiresAt && new Date(expiresAt) <= new Date()) return toast.error('Expiry date/time must be in the future.');
    }
    if (target === 'selected' && selectedCount === 0) {
      return toast.error('Select at least one student, or switch to "All students".');
    }
    setSaving(true);
    try {
      const applyToSelected = target === 'selected' && !allSelected;
      const { data } = await api.post(`/assessment/teacher/assessments/${assessment.id}/attempts/add`, {
        additional_attempts: Number(additional),
        ...(applyToSelected ? { student_ids: Array.from(selectedIds) } : {}),
        ...(setTiming ? {
          duration_minutes: Number(durationMinutes),
          available_from: availableFrom ? new Date(availableFrom).toISOString() : null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        } : {}),
      });
      toast.success(data.message || 'Attempt added');
      onAdded?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add attempt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Add attempt — ${assessment.title}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Give students in <strong>{assessment.class_id?.name || 'this class'}</strong> another try at this assessment — handy when someone needs a second chance to show they've understood the material. Apply it to the whole class, or just the students who need it.
        </p>

        {/* ── Summary card: current -> new total, with animated glow ── */}
        <div className="aam-summary flex items-center justify-between">
          <div className="text-center flex-1 relative z-10">
            <p className="text-2xl font-bold aam-summary-num" style={{ color: 'var(--text-primary)' }}>{currentMax}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Current attempts</p>
          </div>
          <div className="flex flex-col items-center gap-1 px-2 relative z-10">
            <span key={additional} className="aam-arrow-icon flex items-center justify-center w-8 h-8 rounded-full" style={{ background: 'rgba(99,102,241,0.14)' }}>
              <ArrowRight className="w-4 h-4" style={{ color: '#6366f1' }} />
            </span>
            <span className="text-xs font-bold" style={{ color: '#6366f1' }}>+{additional || 0}</span>
          </div>
          <div className="text-center flex-1 relative z-10">
            <p className="text-2xl font-bold aam-summary-num" style={{ color: '#6366f1' }}>{newMax}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{target === 'selected' ? 'New total (selected)' : 'New total'}</p>
          </div>
        </div>

        {/* ── Attempts to add: quick chips + stepper ── */}
        <div>
          <label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <Zap className="w-3.5 h-3.5" /> Attempts to add
          </label>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {[1, 2, 3, 5, 10].map(n => (
              <button
                key={n}
                onClick={() => setAdditional(n)}
                className={`aam-chip ${Number(additional) === n ? 'aam-chip-active' : ''}`}
              >
                +{n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdditional(a => Math.max(1, Number(a) - 1))}
              className="btn-secondary w-9 h-9 flex items-center justify-center p-0 rounded-xl flex-shrink-0"
              aria-label="Decrease"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number" min="1" value={additional}
              onChange={e => setAdditional(e.target.value)}
              className="chat-form-field w-full text-sm text-center font-semibold"
            />
            <button
              onClick={() => setAdditional(a => Math.max(1, Number(a) + 1))}
              className="btn-secondary w-9 h-9 flex items-center justify-center p-0 rounded-xl flex-shrink-0"
              aria-label="Increase"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Target: sliding segmented control ── */}
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Give this attempt to</label>
          <div className="aam-segment">
            <span className="aam-segment-thumb" style={{ transform: target === 'all' ? 'translateX(0%)' : 'translateX(100%)' }} />
            <button onClick={() => setTarget('all')} className={target === 'all' ? 'active' : ''}>
              <Users className="w-4 h-4" /> All students
            </button>
            <button onClick={() => setTarget('selected')} className={target === 'selected' ? 'active' : ''}>
              <User className="w-4 h-4" /> Specific students
            </button>
          </div>

          {target === 'selected' && (
            <div className="mt-3 card p-3 animate-scale-in" style={{ borderColor: 'var(--card-border)' }}>
              {loadingRoster ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-secondary)' }} />
                </div>
              ) : rosterError ? (
                <p className="text-sm text-center py-4" style={{ color: '#ef4444' }}>{rosterError}</p>
              ) : roster.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>No students in this class yet.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search student..."
                        className="chat-form-field w-full text-sm pl-8 pr-8"
                      />
                      {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button onClick={toggleSelectAll} className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2">
                      <span className={`aam-check ${allSelected ? 'aam-check-active' : ''}`}>{allSelected && <Check className="w-3 h-3 text-white" />}</span>
                      Select all
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
                    {filteredRoster.length === 0 ? (
                      <p className="text-xs text-center py-3" style={{ color: 'var(--text-secondary)' }}>No students match "{search}".</p>
                    ) : filteredRoster.map(s => {
                      const checked = selectedIds.has(s.student_id);
                      const [c1, c2] = avatarGradient(s.student_name);
                      return (
                        <label
                          key={s.student_id}
                          className="aam-student-row flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer select-none"
                          style={{ background: checked ? 'rgba(99,102,241,0.08)' : 'transparent' }}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={`aam-check ${checked ? 'aam-check-active' : ''}`}>
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <input type="checkbox" checked={checked} onChange={() => toggleStudent(s.student_id)} className="sr-only" />
                            <span className="aam-avatar" style={{ '--aam-a1': c1, '--aam-a2': c2 }}>{initials(s.student_name)}</span>
                            <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{s.student_name}</span>
                          </span>
                          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                            {s.attempts_used}/{s.max_attempts} used
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                    {selectedCount === 0
                      ? 'No students selected yet — the rest of the class keeps their current attempts.'
                      : allSelected
                        ? `All ${roster.length} students selected — same as choosing "All students".`
                        : `${selectedCount} of ${roster.length} student${roster.length === 1 ? '' : 's'} selected. Everyone else keeps their current attempts.`}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Timing switch ── */}
        <label className="flex items-center justify-between gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--text-primary)' }}>
          <span className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="w-4 h-4" style={{ color: '#6366f1' }} /> Also set the timing for this attempt
          </span>
          <span className={`aam-switch ${setTiming ? 'aam-switch-on' : ''}`} onClick={() => setSetTiming(v => !v)}>
            <span className="aam-switch-knob" />
          </span>
        </label>

        {setTiming && (
          <div className="aam-timing-panel space-y-3 pl-3 border-l-2" style={{ borderColor: 'rgba(99,102,241,0.25)' }}>
            <div>
              <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
                <Clock className="w-3.5 h-3.5" /> Duration (minutes)
              </label>
              <input type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="chat-form-field w-full text-sm" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Applies to every attempt started from now on, including this new one.</p>
            </div>

            <div>
              <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
                <CalendarPlus className="w-3.5 h-3.5" /> Available from <span className="font-normal normal-case">(optional)</span>
              </label>
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <button type="button" className="aam-preset" onClick={() => setAvailableFrom('')}>Immediately</button>
                <button type="button" className="aam-preset" onClick={() => setAvailableFrom(fromNow(60))}>In 1 hour</button>
                <button type="button" className="aam-preset" onClick={() => setAvailableFrom(tomorrowAt(9))}>Tomorrow 9AM</button>
                <button type="button" className="aam-preset" onClick={() => setAvailableFrom(nextMondayAt(8))}>Next Monday 8AM</button>
              </div>
              <input type="datetime-local" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} className="chat-form-field w-full text-sm" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                The attempt is granted right away, but students can't actually start it until this moment. Leave blank to let them start immediately.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
                <CalendarClock className="w-3.5 h-3.5" /> Expiry date &amp; time
              </label>
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <button type="button" className="aam-preset" onClick={() => setExpiresAt(todayAt(23, 59))}>Today</button>
                <button type="button" className="aam-preset" onClick={() => setExpiresAt(daysFromNowEndOfDay(3))}>+3 days</button>
                <button type="button" className="aam-preset" onClick={() => setExpiresAt(daysFromNowEndOfDay(7))}>+1 week</button>
                <button type="button" className="aam-preset" onClick={() => setExpiresAt(daysFromNowEndOfDay(14))}>+2 weeks</button>
              </div>
              <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="chat-form-field w-full text-sm" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Students can no longer start an attempt after this time.</p>
            </div>

            <TimingPreview availableFrom={availableFrom} expiresAt={expiresAt} />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={saving || (target === 'selected' && selectedCount === 0)}
            className="btn-primary assessment-cta flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            Add Attempt{Number(additional) > 1 ? 's' : ''}{target === 'selected' && selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}