/**
 * AttemptResponseModal.jsx
 *
 * Opened from "View Response" on an attempt row in StudentResultModal —
 * shows the student exactly what they answered on a submitted attempt,
 * next to the reference/correct answer for each question, color-coded by
 * whether it was marked correct. Also offers a PDF export of the same
 * content to keep or print.
 *
 * Rendered as a sibling of StudentResultModal, which passes `hidden` to
 * its own <Modal> the moment this one opens — see Modal.jsx's `hidden`
 * prop. That keeps exactly one modal backdrop on screen at a time (rather
 * than two stacked blurred backdrops, which read as a UI glitch) while
 * preserving the results modal's state underneath, ready the instant this
 * one closes.
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
  Loader2, CheckCircle2, XCircle, Clock3, FileText,
  ListChecks, User, GraduationCap, AlertCircle, Lock, Target,
} from 'lucide-react';

function verdictMeta(a) {
  if (a.needs_manual_grading) return { label: 'Pending review', color: '#d97706', bg: 'rgba(217,119,6,0.14)', ring: 'rgba(217,119,6,0.35)', Icon: Clock3 };
  if (a.is_correct === true) return { label: 'Correct', color: '#10b981', bg: 'rgba(16,185,129,0.14)', ring: 'rgba(16,185,129,0.35)', Icon: CheckCircle2 };
  if (a.is_correct === false) return { label: 'Incorrect', color: '#ef4444', bg: 'rgba(239,68,68,0.14)', ring: 'rgba(239,68,68,0.35)', Icon: XCircle };
  return { label: 'Not answered', color: '#9ca3af', bg: 'rgba(156,163,175,0.16)', ring: 'rgba(156,163,175,0.3)', Icon: AlertCircle };
}

// Normalizes MCQ and True/False into the same { key, text, isPicked,
// isCorrect } shape so both render through one option-list UI instead of
// two different code paths — True/False gets the same clear "which one did
// I pick vs which one was right" treatment as a full MCQ question.
function buildDisplayOptions(a) {
  if (a.type === 'mcq' && a.options?.length > 0) {
    return a.options.map(opt => {
      const isPicked = String(a.student_answer_raw || '').split(',').includes(opt.key) ||
        (Array.isArray(a.student_answer_raw) && a.student_answer_raw.includes(opt.key));
      const isCorrect = (a.correct_answer || '').startsWith(`${opt.key}.`) || (a.correct_answer || '').includes(`${opt.key}. `);
      return { key: opt.key, text: opt.text, isPicked, isCorrect };
    });
  }
  if (a.type === 'true_false') {
    return ['True', 'False'].map(label => ({
      key: label[0],
      text: label,
      isPicked: a.student_answer === label,
      isCorrect: a.correct_answer === label,
    }));
  }
  return null;
}

function QuestionCard({ a, index }) {
  const v = verdictMeta(a);
  const displayOptions = buildDisplayOptions(a);
  return (
    <div className="arm-qcard" style={{ '--arm-accent': v.color, '--arm-ring': v.ring, animationDelay: `${Math.min(index, 10) * 45}ms` }}>
      <div className="arm-qcard-bar" />
      <div className="arm-qcard-body">
        {/* Header row: number badge + question text + verdict pill */}
        <div className="arm-qhead">
          <span className="arm-qnum" style={{ background: v.bg, color: v.color, boxShadow: `0 0 0 3px ${v.bg}` }}>
            {index + 1}
          </span>
          <p className="arm-qtext">{a.question_text}</p>
          <span className="arm-pill" style={{ background: v.bg, color: v.color, border: `1px solid ${v.ring}` }}>
            <v.Icon className="w-3.5 h-3.5" />
            {v.label}
            {a.marks != null && <b style={{ opacity: 0.85, fontWeight: 800 }}>&nbsp;· {a.score_awarded ?? 0}/{a.marks}</b>}
          </span>
        </div>

        {displayOptions && (
          <div className="arm-options">
            {displayOptions.map(opt => (
              <div key={opt.key} className="arm-option" style={{
                background: opt.isCorrect ? 'rgba(16,185,129,0.1)' : opt.isPicked ? 'rgba(239,68,68,0.08)' : 'var(--surface-50)',
                borderColor: opt.isCorrect ? 'rgba(16,185,129,0.4)' : opt.isPicked ? 'rgba(239,68,68,0.35)' : 'var(--card-border)',
              }}>
                <span className="arm-option-key" style={{ color: opt.isCorrect ? '#10b981' : opt.isPicked ? '#ef4444' : 'var(--text-secondary)' }}>{opt.key}</span>
                <span className="arm-option-text">{opt.text}</span>
                {opt.isCorrect && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />}
                {opt.isPicked && !opt.isCorrect && <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#ef4444' }} />}
              </div>
            ))}
          </div>
        )}

        {/* Answer comparison — each side its own tinted panel, not just plain text */}
        <div className="arm-answer-grid">
          <div className="arm-answer-panel" style={{ background: a.student_answer ? v.bg : 'var(--surface-50)', borderColor: a.student_answer ? v.ring : 'var(--card-border)' }}>
            <p className="arm-answer-label" style={{ color: a.student_answer ? v.color : 'var(--text-secondary)' }}>
              <User className="w-3.5 h-3.5" /> Your answer
            </p>
            <p className="arm-answer-text" style={{ color: a.student_answer ? v.color : 'var(--text-secondary)', fontStyle: a.student_answer ? 'normal' : 'italic' }}>
              {a.student_answer || 'No answer submitted'}
            </p>
          </div>
          <div className="arm-answer-panel" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.28)' }}>
            <p className="arm-answer-label" style={{ color: '#10b981' }}>
              <GraduationCap className="w-3.5 h-3.5" /> Reference answer
            </p>
            <p className="arm-answer-text" style={{ color: '#059669', fontWeight: 700 }}>
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
  const pendingCount = data?.answers.filter(a => a.needs_manual_grading).length ?? 0;
  const pct = data && data.max_marks ? Math.round(((data.attempt.total_score || 0) / data.max_marks) * 100) : null;
  const pctColor = pct == null ? '#6366f1' : pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

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
        .arm-hero {
          display: flex; align-items: center; gap: 20px; padding: 20px 22px;
          border-radius: 18px; margin-bottom: 20px; position: relative; overflow: hidden;
          background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06));
          border: 1px solid rgba(99,102,241,0.18);
        }
        .arm-hero-ring {
          width: 74px; height: 74px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; position: relative;
          background: conic-gradient(var(--arm-pct-color) calc(var(--arm-pct, 0) * 1%), var(--surface-100) 0);
        }
        .arm-hero-ring::before {
          content: ''; position: absolute; inset: 6px; border-radius: 50%; background: var(--card-bg);
        }
        .arm-hero-ring span { position: relative; font-size: 18px; font-weight: 800; color: var(--arm-pct-color); }
        .arm-hero-stats { display: flex; gap: 10px; flex-wrap: wrap; flex: 1; min-width: 0; }
        .arm-hero-chip {
          padding: 10px 16px; border-radius: 14px; min-width: 84px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        }
        .arm-hero-chip b { font-size: 18px; font-weight: 800; line-height: 1; }
        .arm-hero-chip span { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.8; }

        .arm-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--card-border);
        }

        .arm-qcard {
          position: relative; display: flex; border-radius: 18px; overflow: hidden;
          background: var(--card-bg); border: 1px solid var(--card-border);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          animation: slideUp 0.4s ease both; transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .arm-qcard:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .arm-qcard-bar { width: 6px; flex-shrink: 0; background: linear-gradient(180deg, var(--arm-accent), var(--arm-accent)); }
        .arm-qcard-body { padding: 20px 22px 22px; flex: 1; min-width: 0; }

        .arm-qhead { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
        .arm-qnum {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0; font-size: 13px; font-weight: 800;
          display: flex; align-items: center; justify-content: center; margin-top: 1px;
        }
        .arm-qtext { flex: 1; min-width: 0; font-size: 15px; font-weight: 650; line-height: 1.5; color: var(--text-primary); padding-top: 3px; }
        .arm-pill {
          flex-shrink: 0; display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700;
          padding: 6px 12px; border-radius: 999px; white-space: nowrap; margin-top: 2px;
        }

        .arm-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .arm-option {
          display: flex; align-items: center; gap: 10px; font-size: 13.5px; padding: 12px 14px;
          border-radius: 12px; border: 1px solid; color: var(--text-primary);
        }
        .arm-option-key {
          font-weight: 800; font-size: 12px; flex-shrink: 0;
          width: 20px; height: 20px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.04);
        }
        .arm-option-text { flex: 1; min-width: 0; }

        .arm-answer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .arm-answer-panel { border-radius: 14px; border: 1px solid; padding: 14px 16px; }
        .arm-answer-label {
          display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;
        }
        .arm-answer-text { font-size: 14px; line-height: 1.5; }

        @media (max-width: 640px) {
          .arm-hero { flex-direction: column; align-items: stretch; text-align: center; }
          .arm-hero-stats { justify-content: center; }
          .arm-answer-grid { grid-template-columns: 1fr; gap: 10px; }
          .arm-qhead { flex-wrap: wrap; }
          .arm-pill { margin-left: 42px; }
        }
      `}</style>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366f1' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading your responses…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <Lock className="w-6 h-6" style={{ color: '#ef4444' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{error}</p>
          <button onClick={onClose} className="btn-secondary text-xs mt-1">Close</button>
        </div>
      ) : (
        <div>
          {/* Hero summary */}
          <div className="arm-hero">
            <div className="arm-hero-ring" style={{ '--arm-pct': pct ?? 0, '--arm-pct-color': pctColor }}>
              <span>{pct != null ? `${pct}%` : '—'}</span>
            </div>
            <div className="arm-hero-stats">
              <div className="arm-hero-chip" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                <b>{data.attempt.total_score ?? '—'}/{data.max_marks}</b>
                <span>Score</span>
              </div>
              <div className="arm-hero-chip" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                <b>{correctCount}</b>
                <span>Correct</span>
              </div>
              <div className="arm-hero-chip" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                <b>{wrongCount}</b>
                <span>Incorrect</span>
              </div>
              {pendingCount > 0 && (
                <div className="arm-hero-chip" style={{ background: 'rgba(217,119,6,0.12)', color: '#d97706' }}>
                  <b>{pendingCount}</b>
                  <span>Pending</span>
                </div>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="arm-toolbar">
            <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Target className="w-3.5 h-3.5" /> {data.answers.length} question{data.answers.length !== 1 ? 's' : ''} reviewed
            </p>
            <button onClick={downloadPdf} disabled={downloading} className="btn-secondary text-xs flex items-center gap-1.5">
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Export as PDF
            </button>
          </div>

          {/* Question cards */}
          <div className="space-y-4" style={{ maxHeight: '58vh', overflowY: 'auto', paddingRight: 6 }}>
            {data.answers.map((a, i) => <QuestionCard key={a.question_id} a={a} index={i} />)}
          </div>
        </div>
      )}
    </Modal>
  );
}