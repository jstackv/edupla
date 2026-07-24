/**
 * ShareAssessmentModal.jsx
 *
 * Lets the teacher publish an assessment's question paper to its class:
 * set the attempt duration, an optional start time, an expiry date/time,
 * how many attempts a student gets, and instructions shown before the
 * student starts.
 *
 * "Available from" vs "Expiry date & time": the assessment is shared (and
 * visible to students) the moment this form is submitted — students always
 * see it right away and can read the instructions. "Available from" only
 * gates when they're allowed to actually START an attempt; leave it blank
 * (or set it in the past) to let students start immediately, same as
 * before this field existed. Whatever duration_minutes is set to is still
 * fully respected once an attempt begins — available_from only decides
 * when the clock is allowed to start, not how long it runs once it does.
 *
 * When re-sharing an already-shared assessment ("Update Sharing"), the form
 * is pre-filled with its current settings instead of resetting them — so
 * bumping one field (say, the expiry) doesn't silently reset the others,
 * like attempts, back to their defaults.
 *
 * For just adding an extra attempt without touching anything else, use
 * AddAttemptModal instead — it's the lighter-weight, more direct action.
 *
 * API contract: POST /assessment/teacher/assessments/:id/share
 *   body: { duration_minutes, available_from, expires_at, max_attempts, instructions }
 */
import { useState } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Send, Loader2, Clock, CalendarClock, CalendarPlus, RotateCcw, FileText } from 'lucide-react';

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  // format for <input type="datetime-local">
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDatetimeLocal(value) {
  if (!value) return defaultExpiry();
  const d = new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Unlike expiry (which always defaults to something 7 days out), "available
// from" defaults to blank — blank means "students can start right away",
// which is the same behavior the assessment had before this field existed.
function toDatetimeLocalOrEmpty(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ShareAssessmentModal({ assessment, onClose, onShared }) {
  const isReshare = assessment.is_shared;

  const [durationMinutes, setDurationMinutes] = useState(assessment.duration_minutes || 30);
  const [availableFrom, setAvailableFrom] = useState(isReshare ? toDatetimeLocalOrEmpty(assessment.available_from) : '');
  const [expiresAt, setExpiresAt] = useState(isReshare ? toDatetimeLocal(assessment.expires_at) : defaultExpiry());
  const [maxAttempts, setMaxAttempts] = useState(assessment.max_attempts || 1);
  const [instructions, setInstructions] = useState(
    assessment.instructions || 'Read every question carefully. The assessment opens in full screen and submits automatically if you leave the exam screen or when time runs out.'
  );
  const [saving, setSaving] = useState(false);

  const handleShare = async () => {
    if (!durationMinutes || Number(durationMinutes) <= 0) return toast.error('Set a duration greater than 0 minutes.');
    if (availableFrom && expiresAt && new Date(availableFrom) >= new Date(expiresAt)) {
      return toast.error('The start time must be before the expiry date/time.');
    }
    setSaving(true);
    try {
      await api.post(`/assessment/teacher/assessments/${assessment.id}/share`, {
        duration_minutes: Number(durationMinutes),
        available_from: availableFrom ? new Date(availableFrom).toISOString() : null,
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
          This will {isReshare ? 're-publish' : 'publish'} the assessment to <strong>{assessment.class_id?.name || 'the class'}</strong>. Every student will get an in-app and email notification.
        </p>
        {isReshare && (
          <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
            Just want to give students an extra attempt? Use <strong>Add Attempt</strong> instead — it's quicker and skips the full re-notification.
          </p>
        )}

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
            <Clock className="w-3.5 h-3.5" /> Duration (minutes)
          </label>
          <input type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="chat-form-field w-full text-sm" />
        </div>

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
            <CalendarPlus className="w-3.5 h-3.5" /> Available from <span className="font-normal normal-case" style={{ color: 'var(--text-secondary)' }}>(optional)</span>
          </label>
          <input type="datetime-local" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} className="chat-form-field w-full text-sm" />
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Students are notified and can see this assessment right away, but can't start it until this time. Leave blank to let them start immediately.
          </p>
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
          <button onClick={handleShare} disabled={saving} className="btn-primary assessment-cta flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isReshare ? 'Update & Re-notify' : 'Share Assessment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
