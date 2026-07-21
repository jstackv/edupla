import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import {
  ClipboardCheck, Clock, RotateCcw, CalendarClock, AlertTriangle,
  CheckCircle2, PlayCircle, Loader2, Inbox, Award, Hourglass,
} from 'lucide-react';

function fmtDate(d) {
  if (!d) return 'No expiry';
  return new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ a }) {
  if (a.expired) return <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs">Expired</span>;
  if (a.in_progress_attempt_id) return <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs">In progress</span>;
  if (a.best_score != null) return <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs">Graded</span>;
  if (a.has_pending_grading) return <span className="badge bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs">Awaiting grading</span>;
  if (!a.can_start) return <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-xs">No attempts left</span>;
  return <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs">Not started</span>;
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
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{data.module_name} · {data.teacher_name}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="card p-3"><Clock className="w-4 h-4 mb-1" style={{ color: 'var(--text-secondary)' }} /><div style={{ color: 'var(--text-primary)' }} className="font-semibold">{data.duration_minutes} min</div><div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Time limit</div></div>
            <div className="card p-3"><RotateCcw className="w-4 h-4 mb-1" style={{ color: 'var(--text-secondary)' }} /><div style={{ color: 'var(--text-primary)' }} className="font-semibold">{data.attempts_left} of {data.max_attempts}</div><div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Attempts left</div></div>
            <div className="card p-3"><ClipboardCheck className="w-4 h-4 mb-1" style={{ color: 'var(--text-secondary)' }} /><div style={{ color: 'var(--text-primary)' }} className="font-semibold">{data.question_count} questions</div><div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total {data.total_marks} pts</div></div>
            <div className="card p-3"><CalendarClock className="w-4 h-4 mb-1" style={{ color: 'var(--text-secondary)' }} /><div style={{ color: 'var(--text-primary)' }} className="font-semibold text-xs">{fmtDate(data.expires_at)}</div><div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Available until</div></div>
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
              className="btn-primary flex items-center gap-2"
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
  const grouped = assessments.reduce((acc, a) => {
    const key = a.module_name || 'Other';
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40">
          <ClipboardCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Assessments</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Online assessments shared by your teachers</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>
      ) : assessments.length === 0 ? (
        <div className="card p-10 text-center">
          <Inbox className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No assessments have been shared with your class yet.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([module, list]) => (
          <div key={module} className="mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>{module}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map(a => (
                <div key={a.id} className="card p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
                    <StatusPill a={a} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>By {a.teacher_name}</p>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-1"><Hourglass className="w-3.5 h-3.5" /> {a.duration_minutes} min</span>
                    <span className="flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> {a.attempts_left}/{a.max_attempts} left</span>
                    {a.best_score != null && <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {a.best_score} pts</span>}
                  </div>
                  <button
                    onClick={() => setInstructionsFor(a)}
                    disabled={a.expired || (!a.can_start && !a.in_progress_attempt_id)}
                    className="btn-primary text-sm mt-1 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {a.in_progress_attempt_id
                      ? <><PlayCircle className="w-4 h-4" /> Resume</>
                      : a.can_start
                        ? <><PlayCircle className="w-4 h-4" /> View & Start</>
                        : <><CheckCircle2 className="w-4 h-4" /> {a.expired ? 'Expired' : 'No attempts left'}</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
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
