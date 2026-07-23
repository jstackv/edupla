/**
 * AddAttemptModal.jsx
 *
 * A focused action for a shared assessment: give students one (or more)
 * extra attempts without needing the full "new assessment" notification
 * blast that the Share modal sends. Useful when a student needs another try
 * to show they've understood the material.
 *
 * Optionally, the teacher can also set how long this extra attempt should
 * last — a duration and an expiry date/time — without touching anything
 * else (instructions, notification behaviour) the way a full re-share would.
 *
 * API contract: POST /assessment/teacher/assessments/:id/attempts/add
 *   body: { additional_attempts, duration_minutes?, expires_at? }
 */
import { useState } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { PlusCircle, Loader2, RotateCcw, Minus, Plus, Clock, CalendarClock } from 'lucide-react';

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

  const currentMax = assessment.max_attempts || 1;
  const newMax = currentMax + (Number(additional) || 0);

  const handleAdd = async () => {
    if (!additional || Number(additional) < 1) return toast.error('Add at least 1 attempt.');
    if (setTiming) {
      if (!durationMinutes || Number(durationMinutes) <= 0) return toast.error('Set a duration greater than 0 minutes.');
      if (expiresAt && new Date(expiresAt) <= new Date()) return toast.error('Expiry date/time must be in the future.');
    }
    setSaving(true);
    try {
      const { data } = await api.post(`/assessment/teacher/assessments/${assessment.id}/attempts/add`, {
        additional_attempts: Number(additional),
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
    <Modal isOpen={true} onClose={onClose} title={`Add attempt — ${assessment.title}`}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Give students in <strong>{assessment.class_id?.name || 'this class'}</strong> another try at this assessment — handy when someone needs a second chance to show they've understood the material.
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
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>New total</p>
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
          <button onClick={handleAdd} disabled={saving} className="btn-primary assessment-cta flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            Add Attempt{Number(additional) > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}
