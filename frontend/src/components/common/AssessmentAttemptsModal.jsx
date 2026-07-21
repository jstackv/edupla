/**
 * AssessmentAttemptsModal.jsx
 *
 * The teacher's "results" view for a shared quiz assessment:
 *  - a mark-sheet style table (best score per student, attempts used, status)
 *  - a per-attempt grading view for open questions that need a manual score
 *  - Excel / PDF mark-sheet downloads
 *
 * API contract:
 *   GET  /assessment/teacher/assessments/:id/attempts        -> { assessment, rows }
 *   GET  /assessment/teacher/attempts/:attemptId              -> { attempt, assessment, answers }
 *   POST /assessment/teacher/attempts/:attemptId/grade        -> body: { grades: [{question_id, manual_score}] }
 *   GET  /assessment/teacher/assessments/:id/attempts/excel   -> file download
 *   GET  /assessment/teacher/assessments/:id/attempts/pdf     -> file download
 */
import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Loader2, Download, FileSpreadsheet, FileText, ArrowLeft,
  CheckCircle2, AlertCircle, Circle, Save,
} from 'lucide-react';

const STATUS_STYLE = {
  graded:         { label: 'Graded',          color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  needs_grading:  { label: 'Needs grading',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  submitted:      { label: 'Submitted',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  not_attempted:  { label: 'Not attempted',   color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};

function GradingView({ attemptId, onClose, onGraded }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/assessment/teacher/attempts/${attemptId}`);
        if (!alive) return;
        setData(data);
        const initial = {};
        data.answers.filter(a => a.type === 'open').forEach(a => { initial[a.question_id] = a.manual_score ?? ''; });
        setScores(initial);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load attempt');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [attemptId]);

  const handleSave = async () => {
    const grades = Object.entries(scores).map(([question_id, manual_score]) => ({ question_id, manual_score: Number(manual_score) || 0 }));
    setSaving(true);
    try {
      const { data: res } = await api.post(`/assessment/teacher/attempts/${attemptId}/grade`, { grades });
      toast.success(res.message);
      onGraded?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save grading');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to mark sheet
      </button>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{data.attempt.student?.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{data.attempt.student?.email}</p>
        </div>
        {data.attempt.total_score != null && (
          <span className="font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{data.attempt.total_score} pts</span>
        )}
      </div>

      <div className="space-y-3">
        {data.answers.map((a, i) => (
          <div key={a.question_id} className="card p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Q{i + 1}. {a.question_text} <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>({a.marks} pts)</span></p>
              {a.type !== 'open' && (
                a.is_correct
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              )}
            </div>

            <div className="text-sm rounded-lg p-2 mb-2" style={{ background: 'var(--card-bg-secondary, rgba(0,0,0,0.03))', color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Student's answer: </span>
              {a.type === 'matching'
                ? Object.entries(a.student_answer || {}).map(([l, r]) => `${l} → ${r}`).join(', ') || '—'
                : Array.isArray(a.student_answer) ? a.student_answer.join(', ') : (a.student_answer ?? '—')}
            </div>

            {a.type === 'open' ? (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Score:</label>
                <input
                  type="number" min="0" max={a.marks} step="0.5"
                  value={scores[a.question_id] ?? ''}
                  onChange={e => setScores(s => ({ ...s, [a.question_id]: e.target.value }))}
                  className="chat-form-field w-24 text-sm"
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>/ {a.marks}</span>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Auto-graded: {a.auto_score ?? 0} / {a.marks} pts
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Grading
        </button>
      </div>
    </div>
  );
}

export default function AssessmentAttemptsModal({ assessment, onClose }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [gradingAttemptId, setGradingAttemptId] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/assessment/teacher/assessments/${assessment.id}/attempts`);
      setRows(data.rows);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load attempts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [assessment.id]);

  const download = async (type) => {
    setDownloading(type);
    try {
      const { data } = await api.get(`/assessment/teacher/assessments/${assessment.id}/attempts/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assessment-marksheet.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Failed to download ${type === 'excel' ? 'Excel' : 'PDF'} mark sheet`);
    } finally {
      setDownloading(null);
    }
  };

  const findAttemptToGrade = (row) => row.attempts.find(a => a.needs_manual_grading && a.status === 'submitted');

  return (
    <Modal isOpen={true} onClose={onClose} title={`Results — ${assessment.title}`} size="xl">
      {gradingAttemptId ? (
        <GradingView
          attemptId={gradingAttemptId}
          onClose={() => setGradingAttemptId(null)}
          onGraded={() => { setGradingAttemptId(null); load(); }}
        />
      ) : loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => download('excel')} disabled={!!downloading} className="btn-secondary text-xs flex items-center gap-1.5">
              {downloading === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Excel
            </button>
            <button onClick={() => download('pdf')} disabled={!!downloading} className="btn-secondary text-xs flex items-center gap-1.5">
              {downloading === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Attempts</th>
                  <th className="py-2 pr-3">Best Score</th>
                  <th className="py-2 pr-3">%</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const st = STATUS_STYLE[row.status] || STATUS_STYLE.not_attempted;
                  const toGrade = findAttemptToGrade(row);
                  return (
                    <tr key={row.student_id} style={{ borderTop: '1px solid var(--card-border)' }}>
                      <td className="py-2 pr-3">
                        <div style={{ color: 'var(--text-primary)' }} className="font-medium">{row.student_name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{row.student_email}</div>
                      </td>
                      <td className="py-2 pr-3" style={{ color: 'var(--text-secondary)' }}>{row.attempts_used}</td>
                      <td className="py-2 pr-3 font-mono" style={{ color: 'var(--text-primary)' }}>{row.best_score != null ? `${row.best_score} / ${row.max_marks}` : '—'}</td>
                      <td className="py-2 pr-3" style={{ color: 'var(--text-secondary)' }}>{row.percentage != null ? `${row.percentage}%` : '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="badge text-xs" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {toGrade && (
                          <button onClick={() => setGradingAttemptId(toGrade.id)} className="text-xs font-semibold" style={{ color: '#6366f1' }}>
                            Grade open answers
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>No students in this class yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
