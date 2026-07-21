/**
 * AddAttemptModal.jsx
 *
 * A focused action for a shared assessment: give students one (or more)
 * extra attempts without touching duration, expiry, or instructions, and
 * without re-sending the full "new assessment" notification blast that the
 * Share modal sends. Useful when a student needs another try to show they've
 * understood the material.
 *
 * API contract: POST /assessment/teacher/assessments/:id/attempts/add
 *   body: { additional_attempts }
 */
import { useState } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { PlusCircle, Loader2, RotateCcw, Minus, Plus } from 'lucide-react';

export default function AddAttemptModal({ assessment, onClose, onAdded }) {
  const [additional, setAdditional] = useState(1);
  const [saving, setSaving] = useState(false);

  const currentMax = assessment.max_attempts || 1;
  const newMax = currentMax + (Number(additional) || 0);

  const handleAdd = async () => {
    if (!additional || Number(additional) < 1) return toast.error('Add at least 1 attempt.');
    setSaving(true);
    try {
      const { data } = await api.post(`/assessment/teacher/assessments/${assessment.id}/attempts/add`, {
        additional_attempts: Number(additional),
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
