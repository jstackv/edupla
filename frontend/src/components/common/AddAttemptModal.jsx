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
 * Optionally, the teacher can also set how long this extra attempt should
 * last — a duration and an expiry date/time — without touching anything
 * else (instructions, notification behaviour) the way a full re-share would.
 * That timing change always applies assessment-wide regardless of which
 * students the attempts themselves go to.
 *
 * API contract:
 *   GET  /assessment/teacher/assessments/:id/attempts                 -> { assessment, rows } (student roster)
 *   POST /assessment/teacher/assessments/:id/attempts/add
 *     body: { additional_attempts, student_ids?, duration_minutes?, expires_at? }
 *     student_ids omitted/empty -> applies to the whole class (previous behaviour)
 */
import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { PlusCircle, Loader2, RotateCcw, Minus, Plus, Clock, CalendarClock, Users, User, Search, X, CheckSquare, Square } from 'lucide-react';

function toDatetimeLocal(value) {
  const d = value ? new Date(value) : new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddAttemptModal({ assessment, onClose, onAdded }) {
  const [additional, setAdditional] = useState(1);
  const [setTiming, setSetTiming] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(assessment.duration_minutes || 30);
  const [expiresAt, setExpiresAt] = useState(toDatetimeLocal(assessment.expires_at));
  const [saving, setSaving] = useState(false);

  // ── Student targeting ──────────────────────────────────────────────────
  // 'all'      -> extra attempt(s) go to the whole class (previous behaviour)
  // 'selected' -> only the checked student(s) get the extra attempt(s)
  const [target, setTarget] = useState('all');
  const [roster, setRoster] = useState([]);          // [{ student_id, student_name, attempts_used, max_attempts }]
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterError, setRosterError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [search, setSearch] = useState('');

  // The roster is only needed once the teacher actually wants to pick
  // specific students — no point loading it (and no point failing loudly
  // if it can't load) for the common "whole class" case.
  // NOTE: only `target`/`assessment.id` are dependencies here — NOT
  // `roster.length`/`loadingRoster`. Those are read purely as guards against
  // re-fetching; putting them in the dependency array would make the
  // `setLoadingRoster(true)` call below re-trigger this same effect, whose
  // cleanup then marks the in-flight request `cancelled` before it ever
  // resolves — the roster never loads and the spinner never stops.
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

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(roster.map(s => s.student_id)));
  };

  const currentMax = assessment.max_attempts || 1;
  const newMax = currentMax + (Number(additional) || 0);
  const selectedCount = selectedIds.size;

  const handleAdd = async () => {
    if (!additional || Number(additional) < 1) return toast.error('Add at least 1 attempt.');
    if (setTiming) {
      if (!durationMinutes || Number(durationMinutes) <= 0) return toast.error('Set a duration greater than 0 minutes.');
      if (expiresAt && new Date(expiresAt) <= new Date()) return toast.error('Expiry date/time must be in the future.');
    }
    if (target === 'selected' && selectedCount === 0) {
      return toast.error('Select at least one student, or switch to "All students".');
    }
    setSaving(true);
    try {
      // Selecting every student in the roster is functionally the same as
      // "all students" — send it that way so the grant applies class-wide
      // (including any student who joins the class later) rather than as a
      // frozen list of today's roster.
      const applyToSelected = target === 'selected' && !allSelected;
      const { data } = await api.post(`/assessment/teacher/assessments/${assessment.id}/attempts/add`, {
        additional_attempts: Number(additional),
        ...(applyToSelected ? { student_ids: Array.from(selectedIds) } : {}),
        ...(setTiming ? {
          duration_minutes: Number(durationMinutes),
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

        <div className="card p-4 flex items-center justify-between" style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
          <div className="text-center flex-1">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{currentMax}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Current attempts</p>
          </div>
          <div className="flex flex-col items-center gap-1 px-2">
            <RotateCcw className="w-4 h-4" style={{ color: '#6366f1' }} />
            <span className="text-xs font-semibold" style={{ color: '#6366f1' }}>+{additional || 0}</span>
          </div>
          <div className="text-center flex-1">
            <p className="text-2xl font-bold" style={{ color: '#6366f1' }}>{newMax}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{target === 'selected' ? 'New total (selected)' : 'New total'}</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Attempts to add</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdditional(a => Math.max(1, Number(a) - 1))}
              className="btn-secondary w-9 h-9 flex items-center justify-center p-0 rounded-xl"
              aria-label="Decrease"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number" min="1" value={additional}
              onChange={e => setAdditional(e.target.value)}
              className="chat-form-field w-full text-sm text-center"
            />
            <button
              onClick={() => setAdditional(a => Math.max(1, Number(a) + 1))}
              className="btn-secondary w-9 h-9 flex items-center justify-center p-0 rounded-xl"
              aria-label="Increase"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Give this attempt to</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTarget('all')}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl py-2 transition-colors"
              style={target === 'all'
                ? { background: '#6366f1', color: '#fff' }
                : { background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}
            >
              <Users className="w-4 h-4" /> All students
            </button>
            <button
              onClick={() => setTarget('selected')}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl py-2 transition-colors"
              style={target === 'selected'
                ? { background: '#6366f1', color: '#fff' }
                : { background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}
            >
              <User className="w-4 h-4" /> Specific students
            </button>
          </div>

          {target === 'selected' && (
            <div className="mt-3 card p-3" style={{ borderColor: 'var(--card-border)' }}>
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
                    <button
                      onClick={toggleSelectAll}
                      className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2"
                    >
                      {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      Select all
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                    {filteredRoster.length === 0 ? (
                      <p className="text-xs text-center py-3" style={{ color: 'var(--text-secondary)' }}>No students match "{search}".</p>
                    ) : filteredRoster.map(s => {
                      const checked = selectedIds.has(s.student_id);
                      return (
                        <label
                          key={s.student_id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors"
                          style={{ background: checked ? 'rgba(99,102,241,0.08)' : 'transparent' }}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStudent(s.student_id)}
                              className="w-4 h-4 rounded flex-shrink-0"
                            />
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

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={setTiming} onChange={e => setSetTiming(e.target.checked)} className="w-4 h-4 rounded" />
          Also set how long this attempt should last
        </label>

        {setTiming && (
          <div className="space-y-3 pl-1 border-l-2 ml-1" style={{ borderColor: 'rgba(99,102,241,0.25)', paddingLeft: '0.9rem' }}>
            <div>
              <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
                <Clock className="w-3.5 h-3.5" /> Duration (minutes)
              </label>
              <input type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="chat-form-field w-full text-sm" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Applies to every attempt started from now on, including this new one.</p>
            </div>
            <div>
              <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
                <CalendarClock className="w-3.5 h-3.5" /> Expiry date &amp; time
              </label>
              <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="chat-form-field w-full text-sm" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Students can no longer start an attempt after this time.</p>
            </div>
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