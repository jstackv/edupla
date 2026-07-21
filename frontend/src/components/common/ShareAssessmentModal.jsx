/**
 * ShareAssessmentModal.jsx
 *
 * Lets the teacher publish an assessment's question paper to its class:
 * set the attempt duration, an expiry date/time, how many attempts a
 * student gets, and instructions shown before the student starts.
 *
 * API contract: POST /assessment/teacher/assessments/:id/share
 *   body: { duration_minutes, expires_at, max_attempts, instructions }
 */
import { useState } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Send, Loader2, Clock, CalendarClock, RotateCcw, FileText } from 'lucide-react';

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  // format for <input type="datetime-local">
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ShareAssessmentModal({ assessment, onClose, onShared }) {
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [instructions, setInstructions] = useState('Read every question carefully. The assessment opens in full screen and submits automatically if you leave the exam screen or when time runs out.');
  const [saving, setSaving] = useState(false);

  const isReshare = assessment.is_shared;

  const handleShare = async () => {
    if (!durationMinutes || Number(durationMinutes) <= 0) return toast.error('Set a duration greater than 0 minutes.');
    setSaving(true);
    try {
      await api.post(`/assessment/teacher/assessments/${assessment.id}/share`, {
        duration_minutes: Number(durationMinutes),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_attempts: Number(maxAttempts) || 1,
        instructions,
      });
      toast.success(`Assessment shared with ${assessment.class_id?.name || 'the class'}. Students have been notified.`);
      onShared?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to share assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`${isReshare ? 'Update sharing' : 'Share'} — ${assessment.title}`}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          This will publish the assessment to <strong>{assessment.class_id?.name || 'the class'}</strong>. Every student will get an in-app and email notification.
        </p>

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
            <Clock className="w-3.5 h-3.5" /> Duration (minutes)
          </label>
          <input type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="chat-form-field w-full text-sm" />
        </div>

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
            <CalendarClock className="w-3.5 h-3.5" /> Expiry date &amp; time
          </label>
          <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="chat-form-field w-full text-sm" />
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Students can no longer start the assessment after this time.</p>
        </div>

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
            <RotateCcw className="w-3.5 h-3.5" /> Number of attempts
          </label>
          <input type="number" min="1" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} className="chat-form-field w-full text-sm" />
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Questions are shuffled per attempt whenever more than one attempt is allowed.</p>
        </div>

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
            <FileText className="w-3.5 h-3.5" /> Instructions shown to students
          </label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} className="chat-form-field w-full text-sm" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleShare} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isReshare ? 'Update & Re-notify' : 'Share Assessment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
