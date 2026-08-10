/**
 * AssessmentAttemptsModal.jsx
 *
 * The teacher's "results" view for a shared quiz assessment:
 *  - a mark-sheet style table (best score per student, attempts used, status)
 *  - a live per-student "trend" sparkline showing every attempt's score, so
 *    a teacher can see retake improvement at a glance without expanding
 *  - a summary stat strip (students, class average, top score, needs
 *    grading, total attempts submitted) mirroring the overall mark sheet
 *  - search, "needs grading only" and "improved on retry" filters, and
 *    sortable columns
 *  - an expandable per-student list of every individual attempt, each with
 *    a "View answers" action so the teacher can see exactly what the
 *    student answered on every question — not only the ones still
 *    awaiting manual grading
 *  - a per-attempt grading view for open questions: ungraded questions get
 *    a score input right away, and already-graded ones can be reopened via
 *    a "Regrade" button in case the teacher scored something incorrectly
 *  - Excel / PDF mark-sheet downloads
 *
 * API contract:
 *   GET  /assessment/teacher/assessments/:id/attempts        -> { assessment, rows }
 *   GET  /assessment/teacher/attempts/:attemptId              -> { attempt, assessment, answers }
 *   POST /assessment/teacher/attempts/:attemptId/grade        -> body: { grades: [{question_id, manual_score}] }
 *   GET  /assessment/teacher/assessments/:id/attempts/excel   -> file download
 *   GET  /assessment/teacher/assessments/:id/attempts/pdf     -> file download
 */
import { useState, useEffect, useMemo, Fragment } from 'react';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Loader2, FileSpreadsheet, FileText, ArrowLeft,
  CheckCircle2, XCircle, AlertCircle, Save, ChevronDown, ChevronUp, Eye, ShieldAlert,
  Pencil, X as XIcon, Search, X, Users, TrendingUp, Trophy, AlertTriangle,
  Repeat, Medal, ArrowUpDown, ArrowUp, ArrowDown, ArrowUpCircle, Minus, Star,
} from 'lucide-react';

const STATUS_STYLE = {
  graded:         { label: 'Graded',          color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  needs_grading:  { label: 'Needs grading',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  submitted:      { label: 'Submitted',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  not_attempted:  { label: 'Not attempted',   color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};

const ATTEMPT_STATUS_STYLE = {
  graded:       { label: 'Graded',      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  submitted:    { label: 'Submitted',   color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  in_progress:  { label: 'In progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

const RANK_STYLE = {
  1: { color: '#eab308', label: '1st' },
  2: { color: '#94a3b8', label: '2nd' },
  3: { color: '#d97706', label: '3rd' },
};

// Column widths — named constants so the sticky-column left offsets below
// always agree with the grid template itself.
const COL_NO = 40;
const COL_STUDENT = 260;
const COL_ATTEMPTS = 90;
const COL_TREND = 150;
const COL_BEST = 100;
const COL_PCT = 130;
const COL_MW = 90;
const COL_DECISION = 100;
const COL_STATUS_MIN = 110;

// Status is the only flexible column — like the Overall mark sheet, this
// lets the table stretch to fill the modal's full width instead of leaving
// a gap, rather than every column being a hard-coded pixel size.
const GRID_COLS = `${COL_NO}px ${COL_STUDENT}px ${COL_ATTEMPTS}px ${COL_TREND}px ${COL_BEST}px ${COL_PCT}px ${COL_MW}px ${COL_DECISION}px minmax(${COL_STATUS_MIN}px, 1fr)`;
const GRID_MIN_WIDTH = COL_NO + COL_STUDENT + COL_ATTEMPTS + COL_TREND + COL_BEST + COL_PCT + COL_MW + COL_DECISION + COL_STATUS_MIN;

const vDivider = { borderRight: '1px solid var(--card-border)' };

// Round to the nearest whole number for display; leaves null/undefined as-is.
const roundNum = (v) => (v == null ? v : Math.round(v));

// Performance color scale used for the percentage bar + text + sparkline.
function perfColor(pct) {
  if (pct == null) return '#9ca3af';
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#6366f1';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

function SortHeader({ label, active, dir, onClick, style, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 px-3 flex items-center gap-1 text-left w-full transition-colors duration-150 hover:text-[var(--text-primary)] ${className}`}
      style={style}
    >
      {label}
      {active ? (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
    </button>
  );
}

/* Compact per-student sparkline: one bar per attempt, scaled to that
   attempt's percentage of max marks. The best attempt is drawn in full
   performance color; every other attempt is a muted version of it, so the
   bar that actually counts toward the student's result is unmistakable at
   a glance — no need to expand the row to see whether a retake helped. */
function AttemptTrend({ attempts, maxMarks, bestScore }) {
  const scored = (attempts || []).filter(a => a.total_score != null);
  if (scored.length === 0) {
    return <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>—</span>;
  }
  const w = 12, gap = 5, h = 26;
  const svgWidth = scored.length * w + (scored.length - 1) * gap;
  return (
    <div className="flex items-center gap-2">
      <svg width={svgWidth} height={h} style={{ flexShrink: 0 }}>
        {scored.map((a, i) => {
          const pct = maxMarks ? Math.min(100, (a.total_score / maxMarks) * 100) : 0;
          const barH = Math.max(2, (pct / 100) * h);
          const isBest = a.total_score === bestScore;
          const color = perfColor(pct);
          return (
            <rect
              key={a.id ?? i}
              x={i * (w + gap)}
              y={h - barH}
              width={w}
              height={barH}
              rx={2}
              fill={color}
              opacity={isBest ? 1 : 0.32}
            >
              <title>{`Attempt ${a.attempt_number}: ${a.total_score} / ${maxMarks} (${Math.round(pct)}%)`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

// Delta badge comparing the first scored attempt to the best one — the
// clearest, single-glance answer to "did retaking this help?".
function RetakeDelta({ attempts }) {
  const scored = (attempts || []).filter(a => a.total_score != null);
  if (scored.length < 2) return null;
  const first = scored[0].total_score;
  const best = Math.max(...scored.map(a => a.total_score));
  const delta = best - first;
  if (delta === 0) {
    return (
      <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-secondary)' }}>
        <Minus className="w-3 h-3" /> No change
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold flex items-center gap-0.5" style={{ color: '#10b981' }}>
      <ArrowUpCircle className="w-3 h-3" /> +{roundNum(delta)} on retry
    </span>
  );
}

/* Shows every answer on an attempt. Ungraded open questions get an editable
   score input right away; already-graded open questions are shown read-only
   with a "Regrade" button so the teacher can reopen and correct a score they
   entered wrongly. Auto-graded questions stay read-only (they aren't a
   manual-grading concern). */
function GradingView({ attemptId, onClose, onGraded }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmZero, setConfirmZero] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/assessment/teacher/attempts/${attemptId}`);
        if (!alive) return;
        setData(data);
        const initial = {};
        data.answers.filter(a => a.type === 'open' && a.manual_score == null).forEach(a => { initial[a.question_id] = ''; });
        setScores(initial);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load attempt');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [attemptId]);

  const doSave = async () => {
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

  // Blank score fields would be saved as 0 (Number('') || 0) — warn the
  // teacher first instead of silently zeroing a question they simply
  // haven't gotten to yet.
  const handleSave = () => {
    const blankCount = Object.values(scores).filter(v => v === '' || v == null).length;
    if (blankCount > 0) { setConfirmZero(true); return; }
    doSave();
  };

  // Reopen an already-graded open question so the teacher can correct a
  // mistaken score. Cancelling reverts to the read-only view without saving.
  const startEdit = (questionId, currentScore) => {
    setScores(s => ({ ...s, [questionId]: String(currentScore ?? 0) }));
  };
  const cancelEdit = (questionId) => {
    setScores(s => {
      const next = { ...s };
      delete next[questionId];
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>;
  if (!data) return null;

  const pendingOpenIds = Object.keys(scores);
  const hasPendingGrading = pendingOpenIds.length > 0;
  const blankCount = Object.values(scores).filter(v => v === '' || v == null).length;
  const maxTotal = data.answers.reduce((s, a) => s + (a.marks || 0), 0);
  const scorePct = data.attempt.total_score != null && maxTotal ? (data.attempt.total_score / maxTotal) * 100 : null;
  const pColor = perfColor(scorePct);

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="text-sm font-semibold flex items-center gap-1 transition-colors duration-150 hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to mark sheet
      </button>

      <div className="card assessment-card p-3.5 flex items-center justify-between gap-3 relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 w-20 h-20" style={{ background: `radial-gradient(circle at top right, ${pColor}20 0%, transparent 70%)` }} />
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{data.attempt.student?.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Attempt {data.attempt.attempt_number}</p>
        </div>
        {data.attempt.total_score != null ? (
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono font-bold text-lg" style={{ color: pColor }}>{data.attempt.total_score} / {maxTotal}</span>
            {scorePct != null && (
              <div className="assessment-progress-track" style={{ width: 96 }}>
                <div className="assessment-progress-fill" style={{ width: `${Math.min(100, scorePct)}%`, background: pColor }} />
              </div>
            )}
          </div>
        ) : (
          <span className="badge text-xs flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            <ShieldAlert className="w-3.5 h-3.5" /> Awaiting grading
          </span>
        )}
      </div>

      <div className="space-y-3">
        {data.answers.map((a, i) => {
          const isOpen = a.type === 'open';
          const wasManuallyGraded = isOpen && a.manual_score != null;
          const isEditing = isOpen && Object.prototype.hasOwnProperty.call(scores, a.question_id);
          return (
            <div key={a.question_id} className="card assessment-card p-3">
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

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Score:</label>
                  <input
                    type="number" min="0" max={a.marks} step="0.5"
                    value={scores[a.question_id] ?? ''}
                    onChange={e => setScores(s => ({ ...s, [a.question_id]: e.target.value }))}
                    className="chat-form-field w-24 text-sm"
                    autoFocus={wasManuallyGraded}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>/ {a.marks}</span>
                  {wasManuallyGraded && (
                    <button
                      onClick={() => cancelEdit(a.question_id)}
                      className="text-xs font-semibold flex items-center gap-1 transition-colors duration-150 hover:opacity-80"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <XIcon className="w-3.5 h-3.5" /> Cancel
                    </button>
                  )}
                </div>
              ) : wasManuallyGraded ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Manually graded: {a.manual_score ?? 0} / {a.marks} pts
                  </p>
                  <button
                    onClick={() => startEdit(a.question_id, a.manual_score)}
                    className="text-xs font-semibold flex items-center gap-1 transition-colors duration-150 hover:opacity-80"
                    style={{ color: '#6366f1' }}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Regrade
                  </button>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Auto-graded: {a.auto_score ?? 0} / {a.marks} pts
                </p>
              )}
            </div>
          );
        })}
      </div>

      {hasPendingGrading && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary assessment-cta flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Grading
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmZero}
        onClose={() => setConfirmZero(false)}
        onConfirm={() => { setConfirmZero(false); doSave(); }}
        variant="warning"
        title="Ungraded questions will score 0"
        message={`${blankCount} question${blankCount > 1 ? 's' : ''} ${blankCount > 1 ? "don't" : "doesn't"} have a score entered yet. If you continue, ${blankCount > 1 ? 'they' : 'it'} will be recorded as 0 out of ${blankCount > 1 ? 'their' : 'its'} marks. Continue?`}
        confirmText="Save as 0"
        cancelText="Go back"
      />
    </div>
  );
}

function AttemptsList({ attempts, onViewAttempt }) {
  const scored = attempts.filter(a => a.total_score != null);
  const bestScore = scored.length ? Math.max(...scored.map(a => a.total_score)) : null;
  return (
    <div className="mt-2 space-y-1.5 pl-1">
      {attempts.map((att, idx) => {
        const st = ATTEMPT_STATUS_STYLE[att.status] || ATTEMPT_STATUS_STYLE.submitted;
        const isBest = att.total_score != null && att.total_score === bestScore && scored.length > 1;
        const prevScored = scored.filter(a => a.attempt_number < att.attempt_number);
        const prevBest = prevScored.length ? Math.max(...prevScored.map(a => a.total_score)) : null;
        const delta = (att.total_score != null && prevBest != null) ? att.total_score - prevBest : null;
        return (
          <div
            key={att.id}
            className="results-attempt-chip flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--surface-100)', outline: isBest ? '1px solid rgba(16,185,129,0.35)' : 'none' }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Attempt {att.attempt_number}</span>
              <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              {isBest && (
                <span className="badge flex items-center gap-1" style={{ background: 'rgba(16,185,129,0.14)', color: '#10b981' }}>
                  <Star className="w-3 h-3" /> Best
                </span>
              )}
              {att.needs_manual_grading && att.status === 'submitted' && (
                <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Open Qs pending</span>
              )}
              {att.auto_submitted && (
                <span style={{ color: 'var(--text-secondary)' }}>· auto-submitted ({att.auto_submit_reason === 'left_screen' ? 'left screen' : 'timeout'})</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {delta != null && delta !== 0 && (
                <span className="font-semibold flex items-center gap-0.5" style={{ color: delta > 0 ? '#10b981' : '#ef4444' }}>
                  {delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {delta > 0 ? '+' : ''}{roundNum(delta)}
                </span>
              )}
              {att.total_score != null && <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{att.total_score} pts</span>}
              {att.status !== 'in_progress' && (
                <button onClick={() => onViewAttempt(att.id)} className="font-semibold flex items-center gap-1 transition-colors duration-150 hover:opacity-80" style={{ color: '#6366f1' }}>
                  <Eye className="w-3.5 h-3.5" /> View answers
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AssessmentAttemptsModal({ assessment, onClose }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [gradingAttemptId, setGradingAttemptId] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [search, setSearch] = useState('');
  const [needsGradingOnly, setNeedsGradingOnly] = useState(false);
  const [improvedOnly, setImprovedOnly] = useState(false);
  const [sortKey, setSortKey] = useState('no'); // 'no' | 'name' | 'attempts' | 'best' | 'percentage'
  const [sortDir, setSortDir] = useState('asc');

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

  // Pulls the real filename the server chose (e.g. "WEB DEVELOPMENT USING
  // PHP - Formative Assessment 1 marks.xlsx") off the Content-Disposition
  // header, falling back to a generic name only if that header is ever
  // missing — blob: URLs carry no HTTP headers of their own, so this is
  // the only way the browser's save dialog gets the real name instead of
  // a hardcoded placeholder.
  const filenameFromDisposition = (headers, fallback) => {
    const disposition = headers?.['content-disposition'] || '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i);
    return match ? decodeURIComponent(match[1].replace(/"$/, '')) : fallback;
  };

  const download = async (type) => {
    setDownloading(type);
    try {
      const response = await api.get(`/assessment/teacher/assessments/${assessment.id}/attempts/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameFromDisposition(response.headers, `assessment-marksheet.${type === 'excel' ? 'xlsx' : 'pdf'}`);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Failed to download ${type === 'excel' ? 'Excel' : 'PDF'} mark sheet`);
    } finally {
      setDownloading(null);
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  // Rank computed from the full, unfiltered/unsorted dataset so a student's
  // medal never shifts just because of a search, filter, or sort change.
  const rankByStudent = useMemo(() => {
    const withPct = rows.filter(r => r.percentage != null).sort((a, b) => b.percentage - a.percentage);
    const map = {};
    withPct.forEach((r, idx) => { map[r.student_id] = idx + 1; });
    return map;
  }, [rows]);

  const improvedStudentIds = useMemo(() => {
    const set = new Set();
    rows.forEach(r => {
      const scored = (r.attempts || []).filter(a => a.total_score != null);
      if (scored.length < 2) return;
      const first = scored[0].total_score;
      const best = Math.max(...scored.map(a => a.total_score));
      if (best > first) set.add(r.student_id);
    });
    return set;
  }, [rows]);

  const stats = useMemo(() => {
    const withPct = rows.filter(r => r.percentage != null);
    const avg = withPct.length ? withPct.reduce((s, r) => s + r.percentage, 0) / withPct.length : null;
    const highest = withPct.length ? Math.max(...withPct.map(r => r.percentage)) : null;
    const needsGrading = rows.filter(r => r.status === 'needs_grading').length;
    const totalAttempts = rows.reduce((s, r) => s + (r.attempts_used || 0), 0);
    // Decision ('C' / 'NYC') is already computed server-side against the
    // correct passing line (70% specific modules, 50% general/complementary).
    const passed = rows.filter(r => r.decision === 'C').length;
    const failed = rows.filter(r => r.decision === 'NYC').length;
    return { avg, highest, needsGrading, totalAttempts, passed, failed, total: rows.length };
  }, [rows]);

  // Assessment-wide max marks / module weight (same for every row) — used
  // to label the Best Score / MW columns instead of repeating "34 / 50" on
  // every single cell.
  const maxMarks = useMemo(() => rows.find(r => r.max_marks != null)?.max_marks ?? null, [rows]);
  const moduleWeight = useMemo(() => rows.find(r => r.module_weight != null)?.module_weight ?? null, [rows]);

  const visibleRows = useMemo(() => {
    let list = rows;
    if (needsGradingOnly) list = list.filter(r => r.status === 'needs_grading');
    if (improvedOnly) list = list.filter(r => improvedStudentIds.has(r.student_id));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r => r.student_name.toLowerCase().includes(q));
    if (sortKey === 'no') return list;
    const sorted = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === 'name') { av = a.student_name.toLowerCase(); bv = b.student_name.toLowerCase(); }
      else if (sortKey === 'attempts') { av = a.attempts_used ?? -1; bv = b.attempts_used ?? -1; }
      else if (sortKey === 'best') { av = a.best_score ?? -1; bv = b.best_score ?? -1; }
      else { av = a.percentage ?? -1; bv = b.percentage ?? -1; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, search, needsGradingOnly, improvedOnly, improvedStudentIds, sortKey, sortDir]);

  return (
    <Modal isOpen={true} onClose={onClose} title={`Results — ${assessment.title}`} size="full">
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
            <button onClick={() => download('excel')} disabled={!!downloading} className="results-download-btn btn-secondary text-xs flex items-center gap-1.5">
              {downloading === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Excel
            </button>
            <button onClick={() => download('pdf')} disabled={!!downloading} className="results-download-btn btn-secondary text-xs flex items-center gap-1.5">
              {downloading === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
            </button>
          </div>

          {/* Summary stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 assessment-stagger">
            {[
              { label: 'Students', value: stats.total, color: '#6366f1', icon: Users },
              { label: 'Class average', value: stats.avg != null ? `${roundNum(stats.avg)}%` : '—', color: perfColor(stats.avg), icon: TrendingUp },
              { label: 'Top score', value: stats.highest != null ? `${roundNum(stats.highest)}%` : '—', color: '#eab308', icon: Trophy },
              { label: 'Passed', value: stats.passed, color: '#10b981', icon: CheckCircle2 },
              { label: 'Failed', value: stats.failed, color: '#ef4444', icon: XCircle },
              { label: 'Needs grading', value: stats.needsGrading, color: '#f59e0b', icon: AlertTriangle },
              { label: 'Attempts submitted', value: stats.totalAttempts, color: '#8b5cf6', icon: Repeat },
            ].map((it, i) => (
              <div key={it.label} style={{ '--i': i }} className="card assessment-card results-stat-card p-3.5 flex items-center gap-3 relative overflow-hidden">
                <div className="pointer-events-none absolute top-0 right-0 w-16 h-16" style={{ background: `radial-gradient(circle at top right, ${it.color}20 0%, transparent 70%)` }} />
                <div className="results-stat-icon w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${it.color}1f` }}>
                  <it.icon className="w-4.5 h-4.5" style={{ color: it.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{it.value}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{it.label}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>The best score across all of a student's attempts is what counts towards their result. Expand a student to see their individual attempts and every answer they gave.</p>

          {/* Toolbar: search + filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
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
              onClick={() => setNeedsGradingOnly(v => !v)}
              className={`filter-pill flex items-center gap-1.5 ${needsGradingOnly ? 'active' : ''}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Needs grading only
            </button>
            <button
              onClick={() => setImprovedOnly(v => !v)}
              className={`filter-pill flex items-center gap-1.5 ${improvedOnly ? 'active' : ''}`}
            >
              <ArrowUpCircle className="w-3.5 h-3.5" /> Improved on retry
            </button>
            {(search || needsGradingOnly || improvedOnly) && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Showing {visibleRows.length} of {rows.length} student{rows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="results-table-shell overflow-auto rounded-xl" style={{ border: '1px solid var(--card-border)', maxHeight: '58vh' }}>
            <div style={{ minWidth: GRID_MIN_WIDTH }}>
              {/* Header row */}
              <div
                className="results-header-row grid text-xs uppercase tracking-wide sticky top-0 z-10"
                style={{ gridTemplateColumns: GRID_COLS, color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
              >
                <div className="results-sticky-col py-2.5 px-2 flex items-center" style={{ left: 0, ...vDivider }}>No.</div>
                <SortHeader
                  label="Student" active={sortKey === 'name'} dir={sortDir}
                  onClick={() => toggleSort('name')}
                  className="results-sticky-col"
                  style={{ left: COL_NO, ...vDivider, background: 'var(--card-bg)' }}
                />
                <SortHeader label="Attempts" active={sortKey === 'attempts'} dir={sortDir} onClick={() => toggleSort('attempts')} style={vDivider} />
                <div className="py-2.5 px-3 flex items-center" style={vDivider}>Trend</div>
                <SortHeader label={`Best Score${maxMarks != null ? ` /${roundNum(maxMarks)}` : ''}`} active={sortKey === 'best'} dir={sortDir} onClick={() => toggleSort('best')} style={vDivider} />
                <SortHeader label="%" active={sortKey === 'percentage'} dir={sortDir} onClick={() => toggleSort('percentage')} style={vDivider} />
                <div className="py-2.5 px-3 flex items-center" style={vDivider}>{moduleWeight != null ? `MW /${roundNum(moduleWeight)}` : 'MW'}</div>
                <div className="py-2.5 px-3 flex items-center" style={vDivider}>Decision</div>
                <div className="py-2.5 px-3 flex items-center">Status</div>
              </div>

              {visibleRows.map((row, i) => {
                const st = STATUS_STYLE[row.status] || STATUS_STYLE.not_attempted;
                const expanded = expandedStudentId === row.student_id;
                const canExpand = row.attempts_used > 0;
                const rank = rankByStudent[row.student_id];
                const rankStyle = rank ? RANK_STYLE[rank] : null;
                const pColor = perfColor(row.percentage);
                return (
                  <Fragment key={row.student_id}>
                    <div
                      className="results-row grid items-center"
                      style={{ gridTemplateColumns: GRID_COLS, borderTop: i === 0 ? 'none' : '1px solid var(--card-border)', '--i': i }}
                    >
                      <div className="results-sticky-col py-2.5 px-2" style={{ left: 0, color: 'var(--text-secondary)', ...vDivider }}>{i + 1}</div>
                      <div className="results-sticky-col py-2.5 px-3 font-medium truncate flex items-center gap-1.5" style={{ left: COL_NO, color: 'var(--text-primary)', ...vDivider }} title={row.student_name}>
                        {rankStyle && <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: rankStyle.color }} title={`Rank ${rankStyle.label}`} />}
                        <span className="truncate">{row.student_name}</span>
                      </div>
                      <div className="py-2.5 px-3 min-w-0 truncate" style={{ color: 'var(--text-secondary)', ...vDivider }}>{row.attempts_used}</div>
                      <div className="py-2 px-3 min-w-0" style={vDivider}>
                        <AttemptTrend attempts={row.attempts} maxMarks={row.max_marks} bestScore={row.best_score} />
                      </div>
                      <div className="py-2.5 px-3 min-w-0" style={vDivider}>
                        <div className="font-mono font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {row.best_score != null ? roundNum(row.best_score) : '—'}
                        </div>
                        <RetakeDelta attempts={row.attempts} />
                      </div>
                      <div className="py-2.5 px-3 min-w-0" style={vDivider}>
                        {row.percentage != null ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold" style={{ color: pColor }}>{roundNum(row.percentage)}%</span>
                            <div className="assessment-progress-track" style={{ width: 72 }}>
                              <div className="assessment-progress-fill" style={{ width: `${Math.min(100, row.percentage)}%`, background: pColor }} />
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                      </div>
                      <div className="py-2.5 px-3 min-w-0 truncate font-mono" style={{ color: 'var(--text-secondary)', ...vDivider }}>
                        {row.marks_on_mw != null ? roundNum(row.marks_on_mw) : '—'}
                      </div>
                      <div className="py-2.5 px-3 min-w-0 truncate" style={vDivider}>
                        {row.decision ? (
                          <span
                            className="results-decision-badge text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"
                            style={{
                              background: row.decision === 'C' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                              color: row.decision === 'C' ? '#10b981' : '#ef4444',
                            }}
                          >
                            {row.decision === 'C' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {row.decision}
                          </span>
                        ) : '—'}
                      </div>
                      <div className="py-2.5 px-3 min-w-0 flex items-center gap-2">
                        <span className="badge text-xs whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        {canExpand && (
                          <button
                            onClick={() => setExpandedStudentId(expanded ? null : row.student_id)}
                            title={expanded ? 'Hide attempts' : 'View attempts'}
                            className="flex-shrink-0 transition-all duration-150 hover:opacity-80"
                            style={{ color: '#6366f1' }}
                          >
                            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                    {expanded && (
                      <div className="results-expand-panel pb-3 px-3" style={{ borderTop: 'none' }}>
                        <AttemptsList attempts={row.attempts} onViewAttempt={setGradingAttemptId} />
                      </div>
                    )}
                  </Fragment>
                );
              })}
              {visibleRows.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Search className="w-6 h-6 opacity-50" />
                  <p className="text-sm">{rows.length === 0 ? 'No students in this class yet.' : 'No students match your filters.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}