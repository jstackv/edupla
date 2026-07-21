/**
 * AttemptAssessment.jsx
 *
 * Full-screen online assessment attempt.
 *  - Opens in the browser's full-screen mode.
 *  - Leaving the exam screen (tab switch, minimizing, exiting full screen,
 *    or the window losing focus) auto-submits the attempt.
 *  - Auto-submits when the timer reaches zero.
 *  - Questions are shown in the order the server already shuffled them in;
 *    answers autosave as the student works.
 *
 * API contract:
 *   POST /assessment/student/assessments/:id/start        -> attempt payload
 *   GET  /assessment/student/attempts/:attemptId           -> resume / poll
 *   POST /assessment/student/attempts/:attemptId/answer    -> autosave one answer
 *   POST /assessment/student/attempts/:attemptId/submit    -> final submit
 *   POST /assessment/student/attempts/:attemptId/auto-submit -> forced submit
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Loader2, Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Send, ShieldAlert, Award, Hourglass,
} from 'lucide-react';

function useCountdown(dueAt, onExpire) {
  const [remaining, setRemaining] = useState(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!dueAt) return;
    const tick = () => {
      const diff = Math.max(0, new Date(dueAt).getTime() - Date.now());
      setRemaining(diff);
      if (diff <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [dueAt]); // eslint-disable-line

  return remaining;
}

function fmtRemaining(ms) {
  if (ms == null) return '--:--';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AttemptAssessment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(null); // { attempt_id, questions, due_at, ... }
  const [answers, setAnswers] = useState({});   // question_id -> value
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState(null);   // set once ended
  const [submitting, setSubmitting] = useState(false);

  const endedRef = useRef(false); // guards against double auto-submit

  /* ── Start / resume the attempt ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.post(`/assessment/student/assessments/${id}/start`);
        if (!alive) return;
        setAttempt(data);
        const initial = {};
        data.questions.forEach(q => { initial[q.id] = q.saved_answer; });
        setAnswers(initial);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not start this assessment');
        navigate('/student/assessments');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ── Full screen on load, cleanup on unmount ── */
  useEffect(() => {
    const goFullscreen = async () => {
      try { await document.documentElement.requestFullscreen?.(); } catch { /* ignore — some browsers need a user gesture */ }
    };
    goFullscreen();
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const finishAttempt = useCallback(async (reason) => {
    if (!attempt || endedRef.current) return;
    endedRef.current = true;
    setSubmitting(true);
    try {
      const payload = { answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })) };
      const endpoint = reason
        ? `/assessment/student/attempts/${attempt.attempt_id}/auto-submit`
        : `/assessment/student/attempts/${attempt.attempt_id}/submit`;
      const { data } = await api.post(endpoint, reason ? { ...payload, reason } : payload);
      setResult({ ...data, autoSubmitted: !!reason, reason });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
      endedRef.current = false;
    } finally {
      setSubmitting(false);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [attempt, answers]);

  /* ── Timer ── */
  const remaining = useCountdown(attempt?.due_at, () => finishAttempt('timeout'));

  /* ── Anti-cheat: leaving the exam screen auto-submits ── */
  useEffect(() => {
    if (!attempt) return;
    const handleLeave = () => { if (!endedRef.current) finishAttempt('left_screen'); };
    const onVisibility = () => { if (document.hidden) handleLeave(); };
    const onFullscreenChange = () => { if (!document.fullscreenElement) handleLeave(); };
    const onBlur = () => handleLeave();

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [attempt, finishAttempt]);

  const saveAnswer = async (questionId, value) => {
    setAnswers(a => ({ ...a, [questionId]: value }));
    try {
      await api.post(`/assessment/student/attempts/${attempt.attempt_id}/answer`, { question_id: questionId, answer: value });
    } catch { /* best-effort autosave; final submit also flushes every answer */ }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg-primary, #0f172a)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: 'var(--bg-primary, #0f172a)' }}>
        <div className="card max-w-md w-full p-8 text-center">
          {result.autoSubmitted ? (
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-amber-500" />
          ) : (
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
          )}
          <h2 className="font-display text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {result.autoSubmitted
              ? (result.reason === 'left_screen' ? 'Submitted automatically' : "Time's up — submitted automatically")
              : 'Assessment submitted'}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{result.message}</p>
          {result.total_score != null ? (
            <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              <Award className="w-6 h-6 text-amber-500" /> {result.total_score} pts
            </div>
          ) : (
            <p className="text-sm mb-4 flex items-center justify-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Hourglass className="w-4 h-4" /> Some open questions need to be graded by your teacher before your final score is ready.
            </p>
          )}
          <button onClick={() => navigate('/student/assessments')} className="btn-primary w-full">Back to Assessments</button>
        </div>
      </div>
    );
  }

  if (!attempt) return null;

  const q = attempt.questions[current];
  const answeredCount = attempt.questions.filter(qq => {
    const v = answers[qq.id];
    return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  const isLow = remaining != null && remaining < 60000;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--bg-primary, #0f172a)', zIndex: 9999 }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <p className="font-semibold text-white">{attempt.assessment_title}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{attempt.module_name} · Question {current + 1} of {attempt.questions.length} · {answeredCount} answered</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-bold ${isLow ? 'text-red-400' : 'text-white'}`}
          style={{ background: isLow ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)' }}>
          <Clock className="w-4 h-4" /> {fmtRemaining(remaining)}
        </div>
      </div>

      {/* Question navigator strip */}
      <div className="flex gap-1.5 px-6 py-3 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {attempt.questions.map((qq, i) => {
          const done = answers[qq.id] != null && answers[qq.id] !== '';
          return (
            <button key={qq.id} onClick={() => setCurrent(i)}
              className="w-8 h-8 flex-shrink-0 rounded-lg text-xs font-bold transition-colors"
              style={{
                background: i === current ? '#6366f1' : (done ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'),
                color: i === current ? '#fff' : (done ? '#34d399' : 'rgba(255,255,255,0.6)'),
              }}>{i + 1}</button>
          );
        })}
      </div>

      {/* Question body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{q.marks} pts</p>
          <h2 className="text-lg font-semibold mb-5 text-white">{q.question_text}</h2>

          {q.type === 'mcq' && (
            <div className="space-y-2">
              {q.options.map(opt => {
                const selected = Array.isArray(answers[q.id]) && answers[q.id].includes(opt.key);
                return (
                  <button key={opt.key}
                    onClick={() => {
                      const cur = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                      const next = selected ? cur.filter(k => k !== opt.key) : [...cur, opt.key];
                      saveAnswer(q.id, next);
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 transition-colors flex items-center gap-3"
                    style={{ borderColor: selected ? '#6366f1' : 'rgba(255,255,255,0.15)', background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', color: '#fff' }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: selected ? '#6366f1' : 'rgba(255,255,255,0.1)' }}>{opt.key}</span>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === 'true_false' && (
            <div className="flex gap-3">
              {['true', 'false'].map(v => (
                <button key={v} onClick={() => saveAnswer(q.id, v)}
                  className="flex-1 py-4 rounded-xl border-2 font-semibold capitalize transition-colors"
                  style={{ borderColor: answers[q.id] === v ? '#6366f1' : 'rgba(255,255,255,0.15)', background: answers[q.id] === v ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', color: '#fff' }}>
                  {v}
                </button>
              ))}
            </div>
          )}

          {q.type === 'fill_gap' && (
            <input
              value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              onBlur={e => saveAnswer(q.id, e.target.value)}
              placeholder="Type your answer…"
              className="w-full px-4 py-3 rounded-xl text-white text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
            />
          )}

          {q.type === 'matching' && (
            <div className="space-y-3">
              {q.left_items.map(left => (
                <div key={left} className="flex items-center gap-3">
                  <span className="flex-1 text-white text-sm">{left}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
                  <select
                    value={(answers[q.id] || {})[left] || ''}
                    onChange={e => saveAnswer(q.id, { ...(answers[q.id] || {}), [left]: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl text-sm text-white"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    <option value="" style={{ color: '#000' }}>Select match…</option>
                    {q.right_options.map(r => <option key={r} value={r} style={{ color: '#000' }}>{r}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {q.type === 'open' && (
            <textarea
              value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              onBlur={e => saveAnswer(q.id, e.target.value)}
              rows={6}
              placeholder="Write your answer…"
              className="w-full px-4 py-3 rounded-xl text-white text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
            />
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
          className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {current < attempt.questions.length - 1 ? (
          <button onClick={() => setCurrent(c => Math.min(attempt.questions.length - 1, c + 1))}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={() => finishAttempt(null)} disabled={submitting}
            className="btn-primary flex items-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Assessment
          </button>
        )}
      </div>
    </div>
  );
}
