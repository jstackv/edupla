/**
 * AttemptResponseModal.jsx
 *
 * Opened from "View Response" on an attempt row in StudentResultModal —
 * shows the student exactly what they answered on a submitted attempt,
 * next to the reference/correct answer for each question, color-coded by
 * whether it was marked correct. Also offers a PDF export of the same
 * content to keep or print.
 *
 * Only reachable once the assessment has closed (see the `expired` flag on
 * the parent assessment) — the caller is responsible for disabling the
 * "View Response" trigger until then; this modal itself also surfaces a
 * clear message if it's ever opened against a still-open attempt (e.g. a
 * stale button state), rather than silently failing.
 *
 * API contract:
 *   GET /assessment/student/attempts/:attemptId/response
 *   GET /assessment/student/attempts/:attemptId/response/pdf  (blob)
 */
import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Loader2, CheckCircle2, XCircle, Clock3, FileText, Download,
  ListChecks, User, GraduationCap, AlertCircle, Lock,
} from 'lucide-react';

function verdictMeta(a) {
  if (a.needs_manual_grading) return { label: 'Pending review', color: '#d97706', bg: 'rgba(217,119,6,0.12)', Icon: Clock3 };
  if (a.is_correct === true) return { label: 'Correct', color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle2 };
  if (a.is_correct === false) return { label: 'Incorrect', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', Icon: XCircle };
  return { label: 'Not answered', color: '#9ca3af', bg: 'rgba(156,163,175,0.14)', Icon: AlertCircle };
}

function QuestionCard({ a, index }) {
  const v = verdictMeta(a);
  return (
    <div
      className="arm-qcard"
      style={{ '--arm-accent': v.color, animationDelay: `${index * 40}ms` }}
    >
      <div className="arm-qcard-bar" />
      <div className="arm-qcard-body">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: v.color }}>{index + 1}.</span> {a.question_text}
          </p>
          <span
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: v.bg, color: v.color }}
          >
            <v.Icon className="w-3 h-3" />
            {v.label}
            {a.marks != null && <span style={{ opacity: 0.75 }}>· {a.score_awarded ?? 0}/{a.marks}</span>}
          </span>
        </div>

        {a.type === 'mcq' && a.options?.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
            {a.options.map(opt => {
              const isStudentPick = String(a.student_answer_raw || '').split(',').includes(opt.key) ||
                (Array.isArray(a.student_answer_raw) && a.student_answer_raw.includes(opt.key));
              const isCorrectOpt = (a.correct_answer || '').startsWith(`${opt.key}.`) || (a.correct_answer || '').includes(`${opt.key}. `);
              return (
                <div key={opt.key} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5" style={{
                  background: isCorrectOpt ? 'rgba(16,185,129,0.1)' : isStudentPick ? 'rgba(239,68,68,0.08)' : 'var(--surface-50)',
                  border: `1px solid ${isCorrectOpt ? 'rgba(16,185,129,0.35)' : isStudentPick ? 'rgba(239,68,68,0.3)' : 'var(--card-border)'}`,
                  color: 'var(--text-primary)',
                }}>
                  <span className="font-bold" style={{ color: isCorrectOpt ? '#10b981' : isStudentPick ? '#ef4444' : 'var(--text-secondary)' }}>{opt.key}.</span>
                  <span className="truncate">{opt.text}</span>
                  {isCorrectOpt && <CheckCircle2 className="w-3 h-3 flex-shrink-0 ml-auto" style={{ color: '#10b981' }} />}
                  {isStudentPick && !isCorrectOpt && <XCircle className="w-3 h-3 flex-shrink-0 ml-auto" style={{ color: '#ef4444' }} />}
                </div>
              );
            })}
          </div>
        )}

        <div className="arm-answer-grid">
          <div>
            <p className="arm-answer-label"><User className="w-3 h-3" /> Your answer</p>
            <p className="text-sm" style={{ color: a.student_answer ? v.color : 'var(--text-secondary)', fontWeight: a.student_answer ? 600 : 400, fontStyle: a.student_answer ? 'normal' : 'italic' }}>
              {a.student_answer || 'No answer submitted'}
            </p>
          </div>
          <div>
            <p className="arm-answer-label"><GraduationCap className="w-3 h-3" /> Reference answer</p>
            <p className="text-sm font-semibold" style={{ color: '#10b981' }}>
              {a.correct_answer || '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AttemptResponseModal({ attemptId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api.get(`/assessment/student/attempts/${attemptId}/response`)
      .then(({ data }) => { if (alive) setData(data); })
      .catch((err) => { if (alive) setError(err.response?.data?.message || 'Unable to load responses.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attemptId]);

  const filenameFromDisposition = (headers, fallback) => {
    const disposition = headers?.['content-disposition'] || '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i);
    return match ? decodeURIComponent(match[1].replace(/"$/, '')) : fallback;
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/assessment/student/attempts/${attemptId}/response/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameFromDisposition(response.headers, 'assessment-response.pdf');
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  const correctCount = data?.answers.filter(a => a.is_correct === true).length ?? 0;
  const wrongCount = data?.answers.filter(a => a.is_correct === false).length ?? 0;
  const pct = data && data.max_marks ? Math.round(((data.attempt.total_score || 0) / data.max_marks) * 100) : null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={data ? `${data.assessment.title} — Attempt ${data.attempt.attempt_number}` : 'Your Responses'}
      icon={ListChecks}
      accent="#6366f1"
      accent2="#8b5cf6"
      size="2xl"
    >
      <style>{`
        .arm-qcard {
          position: relative; display: flex; border-radius: 14px; overflow: hidden;
          background: var(--surface-50); border: 1px solid var(--card-border);
          animation: slideUp 0.35s ease both;
        }
        .arm-qcard-bar { width: 4px; flex-shrink: 0; background: var(--arm-accent); }
        .arm-qcard-body { padding: 14px 16px; flex: 1; min-width: 0; }
        .arm-answer-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
          padding-top: 10px; border-top: 1px dashed var(--card-border);
        }
        .arm-answer-label {
          display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);
          margin-bottom: 4px;
        }
        @media (max-width: 640px) {
          .arm-answer-grid { grid-template-columns: 1fr; gap: 8px; }
        }
      `}</style>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#6366f1' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading your responses…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <Lock className="w-6 h-6" style={{ color: '#ef4444' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{error}</p>
          <button onClick={onClose} className="btn-secondary text-xs mt-1">Close</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p className="text-lg font-bold" style={{ color: '#6366f1' }}>{data.attempt.total_score ?? '—'}/{data.max_marks}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Score {pct != null ? `(${pct}%)` : ''}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p className="text-lg font-bold" style={{ color: '#10b981' }}>{correctCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Correct</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-lg font-bold" style={{ color: '#ef4444' }}>{wrongCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Incorrect</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <ListChecks className="w-3.5 h-3.5" /> {data.answers.length} question{data.answers.length !== 1 ? 's' : ''}
            </p>
            <button onClick={downloadPdf} disabled={downloading} className="btn-secondary text-xs flex items-center gap-1.5">
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Export as PDF
            </button>
          </div>

          <div className="space-y-3" style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
            {data.answers.map((a, i) => <QuestionCard key={a.question_id} a={a} index={i} />)}
          </div>
        </div>
      )}
    </Modal>
  );
}
