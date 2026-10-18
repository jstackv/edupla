/**
 * GradingWorkspace — the teacher's marking screen for one task.
 *
 *   ┌ students ┐ ┌──── submission ────┐ ┌──── grading ────┐
 *   │ search   │ │ who · when · files │ │ score ring      │
 *   │ list     │ │ the student's note │ │ score + quick % │
 *   └──────────┘ └────────────────────┘ │ feedback        │
 *                                       │ Save & next     │
 *                                       └─────────────────┘
 *
 * The grading panel is always on screen, right beside the submission it
 * belongs to — no "Grade" button to hunt for. Drafts are kept per student, so
 * moving around never loses typing. Ctrl/⌘ + Enter saves and jumps to the next
 * submission that still needs a mark.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import { downloadFile } from './FileViewer';
import FileViewer from './FileViewer';
import { FileRows } from './TaskFiles';
import { exportMarksheetPdf } from '../../utils/marksheetPdf';
import {
  Search, Award, Check, ChevronLeft, ChevronRight, Download, Paperclip, FileDown, CalendarClock,
  ClipboardList, Minus, Plus, Inbox, MessageSquareText, RotateCcw, Save, ArrowRight, Sparkles, PartyPopper,
} from 'lucide-react';

const QUICK_PERCENTS = [100, 90, 80, 70, 60, 50, 0];
const FEEDBACK_CHIPS = [
  'Excellent work!',
  'Well done — keep it up.',
  'Good effort, but it needs improvement.',
  'Incomplete — please finish the missing parts.',
  'Please see my comments in your file.',
];

const hasScore = (r) => typeof r.score === 'number' && Number.isFinite(r.score);
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const bandOf = (p) => (p >= 70 ? { c: '#10b981', label: p >= 90 ? 'Outstanding' : p >= 80 ? 'Excellent' : 'Very good' }
  : p >= 50 ? { c: '#f59e0b', label: p >= 60 ? 'Good' : 'Pass' }
  : { c: '#ef4444', label: 'Below pass' });

/* Circular progress showing the live percentage. */
function ScoreRing({ pct, tone }) {
  const R = 52, C = 2 * Math.PI * R;
  const has = pct !== null;
  const band = has ? bandOf(pct) : null;
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--card-border)" strokeWidth="10" />
        <circle cx="64" cy="64" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
          stroke={has ? band.c : 'transparent'} strokeDasharray={C} strokeDashoffset={C - (C * Math.min(Math.max(pct || 0, 0), 100)) / 100}
          style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1), stroke .3s', filter: has ? `drop-shadow(0 0 6px ${band.c}88)` : 'none' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-extrabold text-3xl leading-none" style={{ color: has ? band.c : 'var(--text-secondary)' }}>
          {has ? `${Math.round(pct * 10) / 10}%` : '—'}
        </span>
        <span className="text-[11px] font-bold mt-1.5" style={{ color: has ? 'var(--text-secondary)' : 'var(--text-secondary)', opacity: has ? 1 : 0.7 }}>
          {has ? band.label : 'Not graded'}
        </span>
      </div>
    </div>
  );
}

export default function GradingWorkspace({ assignment, tone, onClose, onExtend, hidden }) {
  const { user } = useAuth();
  const maxScore = assignment.max_score || 100;

  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');           // 'all' | 'togr' | 'graded' | 'pending'
  const [selectedId, setSelectedId] = useState(null);
  const [drafts, setDrafts] = useState({});               // submission_id → { score, feedback }
  const [saving, setSaving] = useState(false);
  const [viewingSub, setViewingSub] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportOpts, setExportOpts] = useState({ withPending: true, dark: false });
  const listRef = useRef(null);

  const fetchRoster = useCallback(() => {
    setLoading(true);
    api.get(`/assignments/${assignment.id}/grades-report`)
      .then(r => setRoster(r.data.grades || []))
      .catch(() => toast.error('Failed to load submissions'))
      .finally(() => setLoading(false));
  }, [assignment.id]);
  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  /* ── ordering, filters, counts ── */
  const sorted = useMemo(() => roster.slice().sort((a, b) => {
    const as = a.submission_id ? 0 : 1, bs = b.submission_id ? 0 : 1;
    if (as !== bs) return as - bs;
    return (a.student_name || '').localeCompare(b.student_name || '');
  }), [roster]);

  const filtered = useMemo(() => sorted
    .filter(r => !search || r.student_name?.toLowerCase().includes(search.toLowerCase()) || r.student_email?.toLowerCase().includes(search.toLowerCase()))
    .filter(r => filter === 'all' ? true
      : filter === 'togr' ? (r.submission_id && !hasScore(r))
      : filter === 'graded' ? hasScore(r)
      : !r.submission_id), [sorted, search, filter]);

  const submittedCount = roster.filter(r => r.submission_id).length;
  const gradedRows = roster.filter(hasScore);
  const toGradeCount = roster.filter(r => r.submission_id && !hasScore(r)).length;
  const pendingCount = roster.length - submittedCount;
  const avgPct = gradedRows.length ? gradedRows.reduce((n, r) => n + (r.score / maxScore) * 100, 0) / gradedRows.length : null;

  // Open on the first submission that still needs a mark.
  useEffect(() => {
    if (selectedId || !sorted.length) return;
    const first = sorted.find(r => r.submission_id && !hasScore(r)) || sorted.find(r => r.submission_id) || sorted[0];
    setSelectedId(first.student_id);
  }, [sorted, selectedId]);

  // When the filter/search changes and hides the open student, jump to the first match.
  const filteredRef = useRef(filtered); filteredRef.current = filtered;
  useEffect(() => {
    const list = filteredRef.current;
    if (list.length && !list.some(r => r.student_id === selectedId)) setSelectedId(list[0].student_id);
  }, [filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = roster.find(r => r.student_id === selectedId) || null;
  const idx = current ? filtered.findIndex(r => r.student_id === current.student_id) : -1;
  const go = (delta) => { const n = filtered[idx + delta]; if (n) setSelectedId(n.student_id); };

  // Keep the selected row in view when moving with prev/next.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId]);

  /* ── the grading form for the open student ── */
  const subId = current?.submission_id || null;
  const savedScoreStr = current && hasScore(current) ? String(current.score) : '';
  const savedFeedback = current?.feedback || '';
  const draft = subId ? drafts[subId] : undefined;
  const scoreStr = draft?.score ?? savedScoreStr;
  const feedback = draft?.feedback ?? savedFeedback;
  const scoreNum = scoreStr === '' ? NaN : Number(scoreStr);
  const valid = Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= maxScore;
  const pct = valid ? (scoreNum / maxScore) * 100 : null;
  const dirty = !!draft && (scoreStr !== savedScoreStr || feedback !== savedFeedback);
  const isGraded = current ? hasScore(current) : false;
  const scoreError = scoreStr !== '' && !valid ? `Enter a number from 0 to ${maxScore}` : '';

  const patchDraft = (patch) => setDrafts(d => ({ ...d, [subId]: { score: scoreStr, feedback, ...d[subId], ...patch } }));
  const setScore = (v) => patchDraft({ score: v });
  const bump = (delta) => {
    const base = Number.isFinite(scoreNum) ? scoreNum : 0;
    setScore(fmt(Math.min(Math.max(base + delta, 0), maxScore)));
  };
  const addFeedback = (text) => patchDraft({ feedback: feedback.trim() ? `${feedback.trim()} ${text}` : text });

  const nextToGrade = (fromId, rows) => {
    const list = rows.slice().sort((a, b) => {
      const as = a.submission_id ? 0 : 1, bs = b.submission_id ? 0 : 1;
      if (as !== bs) return as - bs;
      return (a.student_name || '').localeCompare(b.student_name || '');
    });
    const at = list.findIndex(r => r.student_id === fromId);
    for (let i = 1; i <= list.length; i++) {
      const r = list[(at + i) % list.length];
      if (r.submission_id && !hasScore(r) && r.student_id !== fromId) return r;
    }
    return null;
  };

  const save = async (advance) => {
    if (!current || !subId || !valid || saving) return;
    setSaving(true);
    try {
      await api.put(`/assignments/${assignment.id}/submissions/${subId}/grade`, { score: scoreNum, feedback });
      const updated = roster.map(r => r.submission_id === subId ? { ...r, score: scoreNum, feedback: feedback.trim() || null, graded_at: new Date().toISOString() } : r);
      setRoster(updated);
      setDrafts(d => { const n = { ...d }; delete n[subId]; return n; });
      if (advance) {
        const next = nextToGrade(current.student_id, updated);
        if (next) { setSelectedId(next.student_id); toast.success(`Saved — next: ${next.student_name}`); }
        else toast.success('Saved — every submission is graded 🎉');
      } else toast.success('Grade saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save grade');
    } finally { setSaving(false); }
  };

  const clearGrade = async () => {
    if (!subId || saving) return;
    setSaving(true);
    try {
      await api.put(`/assignments/${assignment.id}/submissions/${subId}/grade`, { score: null, feedback });
      setRoster(rs => rs.map(r => r.submission_id === subId ? { ...r, score: null, graded_at: null } : r));
      setDrafts(d => { const n = { ...d }; delete n[subId]; return n; });
      toast.success('Grade cleared');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to clear grade'); }
    finally { setSaving(false); }
  };

  const onPanelKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(true); } };

  /* ── files ── */
  const fileTitle = (row, f) => {
    const many = (row.files || []).length > 1;
    const base = many ? (f.original_name || '').replace(/\.[^/.]+$/, '') : assignment.title;
    return `${base}${row.student_name ? ` - ${row.student_name}` : ''}`;
  };
  const asViewable = (row, f) => ({ ...f, type: 'submission', submission_id: row.submission_id, assignment_id: assignment.id, title: fileTitle(row, f) });
  const downloadAll = async (row) => {
    for (const f of row.files || []) { await downloadFile(asViewable(row, f)); await new Promise(r => setTimeout(r, 350)); }
  };

  /* ── mark sheet ── */
  const doExport = () => {
    const rows = roster.slice()
      .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''))
      .filter(r => exportOpts.withPending || hasScore(r))
      .map(r => ({ name: r.student_name, score: hasScore(r) ? r.score : null }));
    if (!rows.length) return toast.error('No marks to export yet');
    try {
      exportMarksheetPdf({
        title: assignment.title, className: assignment.class_name || '', subtitle: assignment.course_name || '',
        kindLabel: tone.label, maxScore, rows, teacherName: user?.name, dark: exportOpts.dark,
      });
      setExportOpen(false);
    } catch { toast.error('Could not create the mark sheet'); }
  };

  const TABS = [
    { key: 'all', label: 'All', count: roster.length },
    { key: 'togr', label: 'To grade', count: toGradeCount },
    { key: 'graded', label: 'Graded', count: gradedRows.length },
    { key: 'pending', label: 'Pending', count: pendingCount },
  ];
  const gradedOfSubmitted = submittedCount ? Math.round((gradedRows.length / submittedCount) * 100) : 0;
  const gradient = `linear-gradient(135deg, ${tone.accent}, ${tone.accent2})`;
  const inputBase = { background: 'var(--surface-100)', border: '1.5px solid var(--card-border)', color: 'var(--text-primary)' };

  return (
    <Modal isOpen onClose={onClose} hidden={hidden} size="3xl" title={`Grading — ${assignment.title}`} icon={Award} accent={tone.accent} accent2={tone.accent2}>
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-7 h-7 border-4 border-t-transparent rounded-full" style={{ borderColor: `${tone.accent} transparent ${tone.accent} ${tone.accent}` }} /></div>
      ) : (
        <div className="space-y-3">
          {/* ── Summary ── */}
          <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: tone.hero }}>
            <div className="flex items-center justify-between gap-3 flex-wrap relative">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/65">{tone.label}</p>
                <p className="text-sm font-bold truncate">{assignment.title}</p>
                <button onClick={onExtend} className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors hover:bg-white/30" style={{ background: 'rgba(255,255,255,0.18)' }}>
                  <CalendarClock className="w-3 h-3" />
                  Due {new Date(assignment.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {assignment.deadline_extended ? ' · extended' : ''} · Extend
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[['Submitted', submittedCount], ['To grade', toGradeCount], ['Graded', gradedRows.length], ['Average', avgPct === null ? '—' : `${Math.round(avgPct)}%`]].map(([l, v]) => (
                  <div key={l} className="px-3 py-1.5 rounded-xl text-center min-w-[64px]" style={{ background: 'rgba(255,255,255,0.14)' }}>
                    <p className="text-lg font-extrabold leading-none">{v}</p>
                    <p className="text-[10px] text-white/70 mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative mt-3">
              <div className="flex justify-between text-[11px] font-semibold text-white/80 mb-1"><span>Marked: {gradedRows.length} of {submittedCount} submissions</span><span>{gradedOfSubmitted}%</span></div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${gradedOfSubmitted}%` }} />
              </div>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex gap-1 p-1 rounded-xl w-fit flex-shrink-0 overflow-x-auto max-w-full" style={{ background: 'var(--card-border)' }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                  style={filter === t.key ? { background: 'var(--card-bg)', color: tone.accent, boxShadow: '0 1px 4px rgba(0,0,0,.2)' } : { color: 'var(--text-secondary)' }}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 py-1.5 text-sm" placeholder="Search students…" />
            </div>
            <div className="relative flex-shrink-0">
              <button onClick={() => setExportOpen(o => !o)}
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5 active:scale-95"
                style={{ background: gradient, boxShadow: `0 10px 22px -10px ${tone.accent}` }}>
                <FileDown className="w-3.5 h-3.5" /> Export mark sheet
              </button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-2xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 24px 50px rgba(0,0,0,.45)' }}>
                    <p className="text-xs font-extrabold uppercase tracking-widest text-muted">Mark sheet</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>A branded PDF with No, Names, Score and %.</p>
                    {[['withPending', 'Include students without a score'], ['dark', 'Dark theme']].map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2.5 text-sm cursor-pointer select-none" style={{ color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={exportOpts[k]} onChange={e => setExportOpts(o => ({ ...o, [k]: e.target.checked }))} style={{ accentColor: tone.accent }} />
                        {label}
                      </label>
                    ))}
                    <button onClick={doExport} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition-transform" style={{ background: gradient }}>
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Workspace: students | submission | grading ── */}
          <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_330px] lg:h-[56vh]">
            {/* Students */}
            <div ref={listRef} className="rounded-2xl p-1.5 overflow-y-auto max-h-56 lg:max-h-none min-h-0" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
              {filtered.length === 0 ? (
                <div className="text-center py-10 px-3">
                  <ClipboardList className="w-9 h-9 mx-auto mb-2 text-muted opacity-30" />
                  <p className="text-xs text-muted">No students match this view</p>
                </div>
              ) : filtered.map(r => {
                const on = r.student_id === selectedId;
                const g = hasScore(r);
                const sub = !!r.submission_id;
                const dot = g ? '#10b981' : sub ? tone.accent : '#a3a3a3';
                const p = g ? (r.score / maxScore) * 100 : null;
                return (
                  <button key={r.student_id} data-selected={on} onClick={() => setSelectedId(r.student_id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all mb-0.5"
                    style={on ? { background: tone.soft, boxShadow: `inset 3px 0 0 ${tone.accent}` } : { background: 'transparent' }}>
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold flex-shrink-0 text-white" style={{ background: sub ? gradient : 'var(--card-border)', color: sub ? '#fff' : 'var(--text-secondary)' }}>
                      {r.student_name?.[0]?.toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{r.student_name}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
                        {g ? 'Graded' : sub ? 'To grade' : 'Pending'}
                      </span>
                    </span>
                    {g && (
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${bandOf(p).c}22`, color: bandOf(p).c }}>
                        {fmt(r.score)}/{fmt(maxScore)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Submission */}
            <div className="rounded-2xl overflow-y-auto min-h-0 lg:max-h-none" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              {!current ? (
                <div className="h-full flex items-center justify-center text-sm text-muted py-16">Select a student</div>
              ) : (
                <div className="p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0" style={{ background: current.submission_id ? gradient : 'var(--card-border)', boxShadow: current.submission_id ? `0 10px 22px -10px ${tone.accent}` : 'none' }}>
                      {current.student_name?.[0]?.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-extrabold text-base truncate" style={{ color: 'var(--text-primary)' }}>{current.student_name}</h3>
                        {current.group_name && <span className="badge text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{current.group_name}</span>}
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={isGraded ? { background: 'rgba(16,185,129,.15)', color: '#059669' } : current.submission_id ? { background: tone.soft, color: tone.accent } : { background: 'rgba(245,158,11,.15)', color: '#b45309' }}>
                          {isGraded ? 'Graded' : current.submission_id ? 'Waiting for a mark' : 'Not submitted'}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5 truncate">{current.student_email}</p>
                      {current.submission_id && <p className="text-xs text-muted mt-0.5">Submitted {new Date(current.submitted_at).toLocaleString()}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => go(-1)} disabled={idx <= 0} title="Previous student" className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-surface-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                      <span className="text-[11px] font-bold text-muted w-12 text-center">{idx >= 0 ? `${idx + 1} / ${filtered.length}` : '—'}</span>
                      <button onClick={() => go(1)} disabled={idx < 0 || idx >= filtered.length - 1} title="Next student" className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-surface-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {!current.submission_id ? (
                    <div className="text-center rounded-2xl py-12 px-6" style={{ border: '2px dashed var(--card-border)' }}>
                      <Inbox className="w-10 h-10 mx-auto mb-2 text-muted opacity-40" />
                      <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>No submission yet</p>
                      <p className="text-xs text-muted mt-1">You can grade this student as soon as they hand something in.</p>
                    </div>
                  ) : (
                    <>
                      {current.notes && (
                        <div>
                          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5"><MessageSquareText className="w-3.5 h-3.5" /> Student's answer</p>
                          <div className="p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--surface-100)', color: 'var(--text-primary)', borderLeft: `3px solid ${tone.accent}` }}>{current.notes}</div>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5" /> {(current.files || []).length ? `${current.files.length} file${current.files.length !== 1 ? 's' : ''}` : 'Files'}
                          </p>
                          {(current.files || []).length > 1 && (
                            <button onClick={() => downloadAll(current)} className="text-xs font-bold flex items-center gap-1 transition-opacity hover:opacity-70" style={{ color: tone.accent }}>
                              <Download className="w-3.5 h-3.5" /> Download all
                            </button>
                          )}
                        </div>
                        {(current.files || []).length > 0 ? (
                          <FileRows tone={tone} files={current.files}
                            onView={f => setViewingSub(asViewable(current, f))} onDownload={f => downloadFile(asViewable(current, f))} />
                        ) : <p className="text-xs text-muted italic">No files attached{current.notes ? ' — the answer is in the text above.' : '.'}</p>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Grading — always visible, right next to the submission */}
            <div onKeyDown={onPanelKey} className="rounded-2xl overflow-y-auto min-h-0 relative"
              style={{ background: 'var(--card-bg)', border: `1px solid ${dirty ? tone.accent : 'var(--card-border)'}`, boxShadow: dirty ? `0 0 0 3px ${tone.soft}` : 'none', transition: 'box-shadow .2s, border-color .2s' }}>
              <div className="h-1" style={{ background: gradient }} />
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-display font-extrabold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Award className="w-4 h-4" style={{ color: tone.accent }} /> Grade
                  </p>
                  {current?.submission_id && (
                    <span className="text-[11px] font-bold" style={{ color: dirty ? tone.accent : isGraded ? '#059669' : 'var(--text-secondary)' }}>
                      {dirty ? '● Unsaved changes' : isGraded ? '✓ Saved' : 'Not graded yet'}
                    </span>
                  )}
                </div>

                {!current?.submission_id ? (
                  <div className="text-center py-10">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted opacity-40" />
                    <p className="text-xs text-muted">Grading opens once this student has submitted.</p>
                  </div>
                ) : (
                  <>
                    <ScoreRing pct={pct} tone={tone} />

                    {/* Score input */}
                    <div>
                      <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted block mb-2">Score</label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => bump(-1)} className="w-10 h-12 rounded-xl flex items-center justify-center transition-colors hover:bg-surface-200 active:scale-90" style={inputBase}><Minus className="w-4 h-4" /></button>
                        <div className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-xl px-2" style={{ ...inputBase, borderColor: scoreError ? '#ef4444' : dirty ? tone.accent : 'var(--card-border)' }}>
                          <input type="number" inputMode="decimal" min={0} max={maxScore} step="any" value={scoreStr} placeholder="0"
                            onChange={e => setScore(e.target.value)}
                            className="w-20 text-center text-2xl font-extrabold bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            style={{ color: 'var(--text-primary)' }} />
                          <span className="text-sm font-bold text-muted">/ {fmt(maxScore)}</span>
                        </div>
                        <button type="button" onClick={() => bump(1)} className="w-10 h-12 rounded-xl flex items-center justify-center transition-colors hover:bg-surface-200 active:scale-90" style={inputBase}><Plus className="w-4 h-4" /></button>
                      </div>
                      {scoreError && <p className="text-xs mt-1.5 font-semibold" style={{ color: '#ef4444' }}>{scoreError}</p>}
                      <input type="range" min={0} max={maxScore} step={maxScore > 20 ? 1 : 0.5} value={valid ? scoreNum : 0}
                        onChange={e => setScore(e.target.value)} className="w-full mt-3" style={{ accentColor: tone.accent }} aria-label="Score slider" />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {QUICK_PERCENTS.map(p => {
                          const v = fmt(Math.round(((maxScore * p) / 100) * 2) / 2);
                          const on = scoreStr === v;
                          return (
                            <button key={p} type="button" onClick={() => setScore(v)}
                              className="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all active:scale-90"
                              style={on ? { background: gradient, color: '#fff' } : { background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                              {p}%
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Feedback */}
                    <div>
                      <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted flex items-center justify-between mb-2">
                        <span>Feedback <span className="normal-case font-semibold">(optional)</span></span>
                        <span className="font-semibold">{feedback.length}/1000</span>
                      </label>
                      <textarea value={feedback} maxLength={1000} rows={3} onChange={e => patchDraft({ feedback: e.target.value })}
                        placeholder="Tell the student what went well and what to improve…"
                        className="w-full rounded-xl p-3 text-sm outline-none resize-y leading-relaxed transition-shadow" style={{ ...inputBase, minHeight: 84 }}
                        onFocus={e => { e.target.style.borderColor = tone.accent; e.target.style.boxShadow = `0 0 0 3px ${tone.soft}`; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--card-border)'; e.target.style.boxShadow = 'none'; }} />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {FEEDBACK_CHIPS.map(c => (
                          <button key={c} type="button" onClick={() => addFeedback(c)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors hover:opacity-80" style={{ background: tone.soft, color: tone.accent }}>
                            + {c.replace(/[.!]$/, '')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-1">
                      <button onClick={() => save(true)} disabled={!valid || saving}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-45 disabled:hover:translate-y-0"
                        style={{ background: gradient, boxShadow: valid ? `0 14px 26px -12px ${tone.accent}` : 'none' }}>
                        {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        Save &amp; next
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => save(false)} disabled={!valid || saving || (!dirty && isGraded)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-surface-200 disabled:opacity-40"
                          style={{ ...inputBase, color: 'var(--text-primary)' }}>
                          {isGraded && !dirty ? <><Check className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
                        </button>
                        {isGraded && (
                          <button onClick={clearGrade} disabled={saving} title="Remove this grade"
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40" style={{ ...inputBase, color: 'var(--text-secondary)' }}>
                            <RotateCcw className="w-3.5 h-3.5" /> Clear
                          </button>
                        )}
                      </div>
                      <p className="text-[10.5px] text-center text-muted">Tip: press <kbd className="px-1 py-0.5 rounded bg-surface-200 font-bold">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-surface-200 font-bold">Enter</kbd> to save &amp; go to the next one</p>
                    </div>
                  </>
                )}
              </div>
              {toGradeCount === 0 && submittedCount > 0 && (
                <div className="mx-4 mb-4 flex items-center gap-2 text-xs font-semibold p-3 rounded-xl" style={{ background: 'rgba(16,185,129,.12)', color: '#059669' }}>
                  <PartyPopper className="w-4 h-4 flex-shrink-0" /> All submitted work has been graded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingSub && <FileViewer file={viewingSub} onClose={() => setViewingSub(null)} />}
    </Modal>
  );
}
