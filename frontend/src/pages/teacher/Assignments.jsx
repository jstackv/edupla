import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import FileViewer, { downloadFile } from '../../components/common/FileViewer';
import TaskGroupsPanel from '../../components/common/TaskGroupsPanel';
import {
  Plus, Search, ClipboardList, Download, Eye, Edit2, Trash2,
  Clock, Users, Award, X, CloudUpload, Star,
  BarChart2, FileDown, Printer,
  ToggleLeft, ToggleRight,
  BookOpen, ChevronRight, ArrowLeft, AlertCircle, Home, User,
} from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function DeadlineBadge({ deadline }) {
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  if (diff < 0) return <span className="badge bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 text-xs">Overdue</span>;
  if (diff <= 2) return <span className="badge bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 text-xs">Due in {diff}d</span>;
  return <span className="badge bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs">{diff}d left</span>;
}

const MODULE_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: '#3b82f6' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: '#10b981' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: '#c2410c' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: '#f59e0b' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: '#f43f5e' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: '#06b6d4' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: '#c2410c' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: '#c2410c' },
];
function moduleColor(idx) { return MODULE_COLORS[idx % MODULE_COLORS.length]; }

// "Assignment" (class work) or "Homework" (done at home); assignments are
// either Individual or Discussion (a task given to specific random groups).
const kindNoun = (taskType, n = 1) => (taskType === 'homework' ? 'homework' : `assignment${n !== 1 ? 's' : ''}`);
const kindTitle = (taskType, mode) =>
  taskType === 'homework' ? 'Homework' : mode === 'discussion' ? 'Group Discussion' : 'Individual Assignment';

function KindBadge({ taskType, mode }) {
  const tone = taskType === 'homework'
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
    : mode === 'discussion'
      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return <span className={`badge text-xs ${tone}`}>{kindTitle(taskType, mode)}</span>;
}

function ChoiceCard({ icon: Icon, title, desc, color, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-4 px-5 py-5 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className={`w-14 h-14 rounded-2xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-7 h-7 ${color.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-xs text-muted mt-1">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
    </button>
  );
}

// ─── Grades Report Modal ──────────────────────────────────────────────────────
function GradesReportModal({ assignment, onClose }) {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('all'); // 'all' | studentId (number)
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'single'

  useEffect(() => {
    setLoading(true);
    api.get(`/assignments/${assignment.id}/grades-report`)
      .then(r => { setGrades(r.data.grades || []); })
      .catch(() => toast.error('Failed to load grades'))
      .finally(() => setLoading(false));
  }, [assignment.id]);

  const displayGrades = selected === 'all'
    ? grades
    : grades.filter(g => String(g.student_id) === String(selected));

  const submitted = displayGrades.filter(g => g.submission_id);
  const graded = displayGrades.filter(g => g.score !== null);
  const avgScore = graded.length
    ? (graded.reduce((s, g) => s + g.score, 0) / graded.length).toFixed(1)
    : '—';

  // CSV export
  const exportCSV = () => {
    const header = ['Student Name', 'Email', 'Level', 'Trade', 'Submitted At', 'Score', `Max Score (${assignment.max_score || 100})`, 'Percentage', 'Feedback', 'Graded At'];
    const rows = displayGrades.map(g => [
      g.student_name,
      g.student_email,
      g.level || '',
      g.trade || '',
      g.submitted_at ? new Date(g.submitted_at).toLocaleString() : 'Not submitted',
      g.score !== null ? g.score : '',
      assignment.max_score || 100,
      g.score !== null ? ((g.score / (assignment.max_score || 100)) * 100).toFixed(1) + '%' : '',
      g.feedback || '',
      g.graded_at ? new Date(g.graded_at).toLocaleString() : ''
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = selected === 'all' ? 'all-students' : (displayGrades[0]?.student_name || 'student').replace(/\s+/g, '-').toLowerCase();
    a.download = `${assignment.title.replace(/\s+/g, '-')}-grades-${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // Print/View report
  const printReport = () => {
    const content = `
      <html>
      <head>
        <title>${assignment.title} — Grades Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a2e; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
          .stats { display: flex; gap: 24px; margin-bottom: 20px; }
          .stat { background: #f5f5f5; padding: 12px 20px; border-radius: 8px; }
          .stat-val { font-size: 22px; font-weight: bold; color: #c2410c; }
          .stat-lbl { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #c2410c; color: white; padding: 8px 12px; text-align: left; }
          td { padding: 8px 12px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .score-high { color: #059669; font-weight: bold; }
          .score-mid { color: #d97706; font-weight: bold; }
          .score-low { color: #dc2626; font-weight: bold; }
          .no-sub { color: #999; font-style: italic; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>${assignment.title} — Grades Report</h1>
        <div class="meta">Class: ${assignment.class_name} &nbsp;|&nbsp; Max Score: ${assignment.max_score || 100} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</div>
        <div class="stats">
          <div class="stat"><div class="stat-val">${displayGrades.length}</div><div class="stat-lbl">Students</div></div>
          <div class="stat"><div class="stat-val">${submitted.length}</div><div class="stat-lbl">Submitted</div></div>
          <div class="stat"><div class="stat-val">${graded.length}</div><div class="stat-lbl">Graded</div></div>
          <div class="stat"><div class="stat-val">${avgScore}</div><div class="stat-lbl">Avg Score</div></div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Student</th><th>Email</th><th>Level</th><th>Trade</th>
            <th>Submitted</th><th>Score</th><th>%</th><th>Feedback</th>
          </tr></thead>
          <tbody>
            ${displayGrades.map((g, i) => {
              const pct = g.score !== null ? ((g.score / (assignment.max_score || 100)) * 100).toFixed(0) : null;
              const cls = pct !== null ? (pct >= 70 ? 'score-high' : pct >= 50 ? 'score-mid' : 'score-low') : '';
              return `<tr>
                <td>${i + 1}</td>
                <td>${g.student_name}</td>
                <td>${g.student_email}</td>
                <td>${g.level || '—'}</td>
                <td>${g.trade || '—'}</td>
                <td>${g.submitted_at ? new Date(g.submitted_at).toLocaleDateString() : '<span class="no-sub">Not submitted</span>'}</td>
                <td class="${cls}">${g.score !== null ? g.score : '<span class="no-sub">—</span>'}</td>
                <td class="${cls}">${pct !== null ? pct + '%' : '<span class="no-sub">—</span>'}</td>
                <td>${g.feedback || ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </body></html>
    `;
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(content);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const getScoreColor = (score, max) => {
    if (score === null || score === undefined) return '';
    const pct = (score / (max || 100)) * 100;
    if (pct >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Grades Report — ${assignment.title}`} size="xl">
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin w-7 h-7 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Student selector */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1">
              <label className="label mb-1">Select Student</label>
              <select
                className="input-field"
                value={selected === 'all' ? 'all' : String(selected)}
                onChange={e => setSelected(e.target.value === 'all' ? 'all' : e.target.value)}>
                <option value="all">All Students ({grades.length})</option>
                {grades.map(g => (
                  <option key={g.student_id} value={String(g.student_id)}>
                    {g.student_name} {g.score !== null ? `— ${g.score}/${assignment.max_score || 100}` : '(not graded)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 flex-shrink-0 sm:mt-5">
              <button onClick={exportCSV} className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button onClick={printReport} className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print / View
              </button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Students', value: displayGrades.length, color: 'text-primary-600' },
              { label: 'Submitted', value: submitted.length, color: 'text-blue-600' },
              { label: 'Graded', value: graded.length, color: 'text-emerald-600' },
              { label: 'Avg Score', value: avgScore, color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--card-border)' }}>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Grades Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
            <div className="overflow-x-auto max-h-[45vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: 'var(--card-border)' }}>
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>Student</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>{assignment.mode === 'discussion' ? 'Group' : 'Level / Trade'}</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>Submitted</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>Score</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>%</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {displayGrades.map((g, idx) => {
                    const pct = g.score !== null ? ((g.score / (assignment.max_score || 100)) * 100).toFixed(0) : null;
                    return (
                      <tr key={g.student_id}
                        style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--card-border)', opacity: 0.85 }}>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>{g.student_name}</p>
                          <p className="text-xs text-muted">{g.student_email}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs text-muted">
                            {assignment.mode === 'discussion' ? (g.group_name || '—') : <>{g.level || '—'} {g.trade ? `/ ${g.trade}` : ''}</>}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          {g.submitted_at
                            ? <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {new Date(g.submitted_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            : <span className="text-xs text-muted italic">Not submitted</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {g.score !== null
                            ? <span className={`font-bold text-sm ${getScoreColor(g.score, assignment.max_score)}`}>
                                {g.score}<span className="text-xs font-normal text-muted">/{assignment.max_score || 100}</span>
                              </span>
                            : <span className="text-xs text-muted">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {pct !== null
                            ? <span className={`text-xs font-medium ${getScoreColor(g.score, assignment.max_score)}`}>{pct}%</span>
                            : <span className="text-xs text-muted">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs italic text-muted line-clamp-2">{g.feedback || ''}</p>
                        </td>
                      </tr>
                    );
                  })}
                  {displayGrades.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-muted text-sm">No data found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button onClick={onClose} className="btn-secondary text-sm">Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Submissions Modal ────────────────────────────────────────────────────────
// Shows the FULL class roster (submitted + pending), with search, status
// filter/sort, an Export to PDF action, and an inline grading flow.
function SubmissionsModal({ assignment, onClose }) {
  const [roster, setRoster] = useState([]);   // every student in the class, submitted or not
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'submitted' | 'pending'
  const [grading, setGrading] = useState(null);
  const [gradeForm, setGradeForm] = useState({ score: '', feedback: '' });
  const [viewingSub, setViewingSub] = useState(null);

  const fetchRoster = useCallback(() => {
    setLoading(true);
    // grades-report returns every enrolled student, with submission info merged in
    api.get(`/assignments/${assignment.id}/grades-report`)
      .then(r => setRoster(r.data.grades || []))
      .catch(() => toast.error('Failed to load submissions'))
      .finally(() => setLoading(false));
  }, [assignment.id]);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  const handleDownload = (row) => downloadFile({
    ...row,
    type: 'submission',
    submission_id: row.submission_id,
    assignment_id: assignment.id,
    title: `${assignment.title}${row.student_name ? ` - ${row.student_name}` : ''}`,
  });

  const submitGrade = async () => {
    try {
      await api.put(`/assignments/${assignment.id}/submissions/${grading.submission_id}/grade`, gradeForm);
      toast.success('Grade saved');
      setRoster(prev => prev.map(r => r.submission_id === grading.submission_id
        ? { ...r, score: parseInt(gradeForm.score), feedback: gradeForm.feedback, graded_at: new Date() }
        : r));
      setGrading(null);
    } catch { toast.error('Failed to save grade'); }
  };

  // Search + status filter, with submitted-first sorting (then pending), name as tiebreaker
  const filtered = roster
    .filter(r => !search || r.student_name?.toLowerCase().includes(search.toLowerCase()) || r.student_email?.toLowerCase().includes(search.toLowerCase()))
    .filter(r => filter === 'all' ? true : filter === 'submitted' ? !!r.submission_id : !r.submission_id)
    .sort((a, b) => {
      const aSub = a.submission_id ? 0 : 1; // submitted first
      const bSub = b.submission_id ? 0 : 1;
      if (aSub !== bSub) return aSub - bSub;
      return (a.student_name || '').localeCompare(b.student_name || '');
    });

  const submittedCount = roster.filter(r => r.submission_id).length;
  const pendingCount = roster.length - submittedCount;
  const gradedCount = roster.filter(r => r.score !== null).length;

  const exportPDF = () => {
    const content = `
      <html>
      <head>
        <title>${assignment.title} — Submissions</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a2e; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
          .stats { display: flex; gap: 24px; margin-bottom: 20px; }
          .stat { background: #f5f5f5; padding: 12px 20px; border-radius: 8px; }
          .stat-val { font-size: 22px; font-weight: bold; color: #c2410c; }
          .stat-lbl { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #c2410c; color: white; padding: 8px 12px; text-align: left; }
          td { padding: 8px 12px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .status-submitted { color: #059669; font-weight: bold; }
          .status-pending { color: #dc2626; font-weight: bold; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>${assignment.title} — Submissions</h1>
        <div class="meta">Class: ${assignment.class_name || ''} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</div>
        <div class="stats">
          <div class="stat"><div class="stat-val">${roster.length}</div><div class="stat-lbl">Total Students</div></div>
          <div class="stat"><div class="stat-val">${submittedCount}</div><div class="stat-lbl">Submitted</div></div>
          <div class="stat"><div class="stat-val">${pendingCount}</div><div class="stat-lbl">Pending</div></div>
          <div class="stat"><div class="stat-val">${gradedCount}</div><div class="stat-lbl">Graded</div></div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Student</th><th>Email</th><th>Status</th><th>Submitted</th><th>Score</th>
          </tr></thead>
          <tbody>
            ${filtered.map((r, i) => `<tr>
              <td>${i + 1}</td>
              <td>${r.student_name}</td>
              <td>${r.student_email}</td>
              <td class="${r.submission_id ? 'status-submitted' : 'status-pending'}">${r.submission_id ? 'Submitted' : 'Pending'}</td>
              <td>${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}</td>
              <td>${r.score !== null ? `${r.score}/${assignment.max_score || 100}` : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </body></html>
    `;
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(content);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const TABS = [
    { key: 'all', label: 'All', count: roster.length },
    { key: 'submitted', label: 'Submitted', count: submittedCount },
    { key: 'pending', label: 'Pending', count: pendingCount },
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title={`Submissions — ${assignment.title}`} size="xl">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Toolbar: tabs + search + export */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex gap-1 p-1 rounded-xl w-fit flex-shrink-0" style={{ background: 'var(--card-border)' }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filter === t.key ? 'bg-white dark:bg-neutral-800 shadow-sm text-primary-600' : 'text-muted hover:text-primary-600'
                  }`}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 py-1.5 text-sm" placeholder="Search students…" />
            </div>
            <button onClick={exportPDF} className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 flex-shrink-0">
              <Printer className="w-3.5 h-3.5" /> Export to PDF
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList className="w-12 h-12 mx-auto mb-2 text-muted opacity-30" />
              <p className="text-muted">No students match this view</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {filtered.map(row => {
                const isSubmitted = !!row.submission_id;
                return (
                  <div key={row.student_id} className="p-4 rounded-xl" style={{ background: 'var(--card-border)' }}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSubmitted ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        <span className={`font-bold text-sm ${isSubmitted ? 'text-primary-700 dark:text-primary-300' : 'text-amber-700 dark:text-amber-300'}`}>
                          {row.student_name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{row.student_name}</p>
                          <span className={`badge text-xs ${isSubmitted ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                            {isSubmitted ? 'Submitted' : 'Pending'}
                          </span>
                          {row.group_name && (
                            <span className="badge text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{row.group_name}</span>
                          )}
                          {row.score !== null && (
                            <span className={`badge text-xs ml-auto ${row.score >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : row.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {row.score}/{assignment.max_score || 100}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-0.5">{row.student_email}</p>
                        {isSubmitted
                          ? <p className="text-xs text-muted mt-0.5">Submitted {new Date(row.submitted_at).toLocaleString()}</p>
                          : <p className="text-xs text-muted mt-0.5 italic">No submission yet</p>}
                        {row.notes && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{row.notes}</p>}
                        {row.feedback && <p className="text-xs italic mt-1" style={{ color: 'var(--text-secondary)' }}>"{row.feedback}"</p>}
                      </div>
                    </div>
                    {isSubmitted && (
                      <div className="flex gap-2 mt-3">
                        {row.filename && (
                          <>
                            <button
                              onClick={() => setViewingSub(row)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center transition-colors"
                              style={{ background: 'var(--card-border)', color: 'var(--text-primary)', border: '1px solid var(--input-border)' }}
                              title="View this student's submission"
                            >
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                            <button
                              onClick={() => handleDownload(row)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center transition-colors"
                              style={{ background: '#c2410c', color: '#fff', border: 'none' }}
                              title="Download submission"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </button>
                          </>
                        )}
                        <button onClick={() => { setGrading(row); setGradeForm({ score: row.score ?? '', feedback: row.feedback || '' }); }}
                          className="btn-primary py-1.5 text-xs flex-1 justify-center">
                          <Award className="w-3.5 h-3.5" />
                          {row.score !== null ? 'Re-grade' : 'Grade'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grade modal */}
      {grading && (
        <div className="mt-4 p-4 rounded-xl border" style={{ background: 'var(--card-bg)', borderColor: 'var(--input-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Grade: {grading.student_name}</p>
            <button onClick={() => setGrading(null)} className="text-muted hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Score (/{assignment.max_score || 100})</label>
              <input type="number" min="0" max={assignment.max_score || 100} value={gradeForm.score}
                onChange={e => setGradeForm(f => ({ ...f, score: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Feedback</label>
              <input value={gradeForm.feedback} onChange={e => setGradeForm(f => ({ ...f, feedback: e.target.value }))}
                className="input-field" placeholder="Optional feedback" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submitGrade} className="btn-primary text-sm flex-1 justify-center">
              <Star className="w-3.5 h-3.5" /> Save Grade
            </button>
          </div>
        </div>
      )}

      {viewingSub && (
        <FileViewer
          file={{
            ...viewingSub,
            type: 'submission',
            submission_id: viewingSub.submission_id,
            assignment_id: assignment.id,
            original_name: viewingSub.original_name,
            title: `${assignment.title}${viewingSub.student_name ? ` - ${viewingSub.student_name}` : ''}`,
          }}
          onClose={() => setViewingSub(null)}
        />
      )}
    </Modal>
  );
}

// ─── Create/Edit Task Modal (module-aware) ────────────────────────────────────
function AssignmentFormModal({ isOpen, onClose, editing, presetClass, presetModule, taskType, mode, groups, onSuccess }) {
  const isHomework = taskType === 'homework';
  const isDiscussion = mode === 'discussion';
  const noun = isHomework ? 'Homework' : isDiscussion ? 'Group Task' : 'Assignment';

  const [form, setForm] = useState({ title: '', description: '', deadline: '', classId: '', courseId: '', max_score: 100, is_active: true, groupIds: [] });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      const deadline = editing.deadline ? new Date(editing.deadline).toISOString().slice(0, 16) : '';
      setForm({
        title: editing.title, description: editing.description || '', deadline,
        classId: String(editing.class_id), courseId: editing.course_id?._id ? String(editing.course_id._id) : editing.course_id ? String(editing.course_id) : '',
        max_score: editing.max_score || 100, is_active: editing.is_active || false,
        groupIds: (editing.group_ids || []).map(String),
      });
    } else {
      setForm({
        title: '', description: '', deadline: '',
        classId: presetClass?._id || '', courseId: presetModule?._id || '',
        max_score: 100, is_active: true, groupIds: [],
      });
    }
    setFile(null);
  }, [isOpen, editing, presetClass, presetModule]);

  // Saved groups bucketed by the set they came from, for the picker.
  const batches = useMemo(() => {
    const map = new Map();
    (groups || []).forEach(g => {
      const key = String(g.batch_id);
      if (!map.has(key)) map.set(key, { batch_id: key, batch_name: g.batch_name, groups: [] });
      map.get(key).groups.push(g);
    });
    map.forEach(b => b.groups.sort((a, c) => a.name.localeCompare(c.name, undefined, { numeric: true })));
    return Array.from(map.values());
  }, [groups]);

  const toggleGroup = (id) => setForm(f => ({
    ...f, groupIds: f.groupIds.includes(id) ? f.groupIds.filter(x => x !== id) : [...f.groupIds, id],
  }));
  const toggleBatch = (b) => setForm(f => {
    const ids = b.groups.map(g => String(g.id));
    const all = ids.every(id => f.groupIds.includes(id));
    return { ...f, groupIds: all ? f.groupIds.filter(id => !ids.includes(id)) : [...new Set([...f.groupIds, ...ids])] };
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDiscussion && form.groupIds.length === 0) return toast.error('Choose at least one group for this task');
    setSaving(true);
    try {
      const fd = new FormData();
      const { groupIds, ...rest } = form;
      Object.entries(rest).forEach(([k, v]) => fd.append(k, v));
      fd.append('taskType', taskType || 'assignment');
      fd.append('mode', isHomework ? 'individual' : (mode || 'individual'));
      fd.append('groupIds', JSON.stringify(isDiscussion ? groupIds : []));
      if (file) fd.append('file', file);
      if (editing) {
        await api.put(`/assignments/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success(`${noun} updated`);
      } else {
        await api.post('/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success(`${noun} created`);
      }
      onClose();
      onSuccess();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit ${noun}` : `New ${noun}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Context pill — shows which class / module / kind of task this is for */}
        {(presetClass || presetModule) && (
          <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--surface-50, var(--card-bg))', border: '1px solid var(--card-border)' }}>
            <BookOpen className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-muted">{presetClass?.name}</span>
            {presetModule && (
              <>
                <ChevronRight className="w-3 h-3 text-muted" />
                <span style={{ color: 'var(--text-primary)' }}>
                  {presetModule.code && `[${presetModule.code}] `}{presetModule.name}
                </span>
              </>
            )}
            <ChevronRight className="w-3 h-3 text-muted" />
            <span className="text-primary-600">{kindTitle(taskType, mode)}</span>
          </div>
        )}
        <div>
          <label className="label">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="input-field" placeholder={`${noun} title`} required autoFocus />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="input-field resize-none" rows={3} placeholder="Instructions for students…" />
        </div>

        {/* Group picker — discussion tasks only */}
        {isDiscussion && (
          <div>
            <label className="label">Give this task to *</label>
            {batches.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  No groups yet. Close this window, open the <strong>Groups</strong> tab and generate some first.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {batches.map(b => {
                  const allOn = b.groups.every(g => form.groupIds.includes(String(g.id)));
                  return (
                    <div key={b.batch_id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold text-muted truncate">{b.batch_name}</p>
                        <button type="button" onClick={() => toggleBatch(b)} className="text-xs font-bold flex-shrink-0" style={{ color: '#c2410c' }}>
                          {allOn ? 'Unselect all' : 'Select all'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {b.groups.map(g => {
                          const on = form.groupIds.includes(String(g.id));
                          return (
                            <button key={g.id} type="button" onClick={() => toggleGroup(String(g.id))}
                              className="px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                              style={on
                                ? { background: 'linear-gradient(135deg, #9a3412, #7c2d12)', color: '#fff' }
                                : { background: 'var(--surface-100)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                              {g.name} · {g.members.length}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted mt-1.5">Only the students in the selected groups will see and submit this task.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Max Score</label>
            <input type="number" value={form.max_score} onChange={e => setForm(f => ({ ...f, max_score: e.target.value }))}
              className="input-field" min="1" max="1000" />
          </div>
          <div>
            <label className="label">Deadline *</label>
            <input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="input-field" required />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: form.is_active ? 'rgba(16,185,129,0.06)' : 'var(--surface-50)', borderRadius: 10, border: `1px solid ${form.is_active ? 'rgba(16,185,129,0.25)' : 'var(--card-border)'}` }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {form.is_active ? `✓ ${noun} is Active` : `${noun} is Inactive`}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
              {form.is_active ? 'Students can view and submit this task' : 'Students cannot see or submit this task'}
            </p>
          </div>
          <button type="button"
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            {form.is_active
              ? <ToggleRight size={28} style={{ color: '#10b981' }} />
              : <ToggleLeft size={28} style={{ color: '#9ca3af' }} />}
          </button>
        </div>
        <div>
          <label className="label">Attachment (optional)</label>
          <div className="flex items-center gap-2">
            <input type="file" id="assignment-file" className="hidden" onChange={e => setFile(e.target.files[0])} />
            <label htmlFor="assignment-file" className="btn-secondary text-xs cursor-pointer">
              <CloudUpload className="w-3.5 h-3.5" />
              {file ? file.name : editing?.original_name || 'Choose file'}
            </label>
            {file && (
              <button type="button" onClick={() => setFile(null)} className="text-muted hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving || (isDiscussion && batches.length === 0)} className="btn-primary">
            {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {editing ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Task Manager Page ───────────────────────────────────────────────────
// Flow: class → module → kind (Assignment | Homework) → for Assignment:
// Individual | Discussion → task list. Discussion adds a Groups tab where the
// random groups are generated, saved, and then handed tasks.
export default function Assignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState('classes');               // 'classes' | 'modules' | 'type' | 'mode' | 'list'
  const [selectedClass, setSelectedClass] = useState(null);   // { _id, name, modules[] }
  const [selectedModule, setSelectedModule] = useState(null); // course object
  const [taskType, setTaskType] = useState(null);             // 'assignment' | 'homework'
  const [mode, setMode] = useState(null);                     // 'individual' | 'discussion'
  const [discTab, setDiscTab] = useState('groups');           // 'groups' | 'tasks' (discussion only)
  const [groupFilter, setGroupFilter] = useState('');         // saved group id, to filter discussion tasks
  const [groups, setGroups] = useState([]);                   // saved groups for the selected class + module

  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);

  const [courses, setCourses] = useState([]); // teacher's modules from /assessment/teacher/courses

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewingSubs, setViewingSubs] = useState(null);
  const [viewingGrades, setViewingGrades] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);
  const [flashId, setFlashId] = useState(searchParams.get('highlight') || null);
  const cardRefs = useRef({});
  const deepLinkApplied = useRef(false);

  const isDiscussion = taskType === 'assignment' && mode === 'discussion';
  const showTaskList = view === 'list' && (!isDiscussion || discTab === 'tasks');

  // Load teacher's assigned modules (each carries its class_id)
  useEffect(() => {
    api.get('/assessment/teacher/courses')
      .then(r => setCourses(r.data.courses || []))
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoadingInit(false));
  }, []);

  // Derive unique classes with their modules from courses.
  // Supports both new class_ids[] array and legacy class_id field.
  const teacherClasses = (() => {
    const map = new Map();
    courses.forEach(c => {
      const classEntries = [];
      if (Array.isArray(c.class_ids) && c.class_ids.length > 0) {
        c.class_ids.forEach(cls => { if (cls) classEntries.push(cls); });
      }
      if (c.class_id) {
        const legacyId = String(c.class_id._id || c.class_id);
        const alreadyCovered = classEntries.some(e => String(e._id || e) === legacyId);
        if (!alreadyCovered) classEntries.push(c.class_id);
      }
      classEntries.forEach(cls => {
        const id = String(cls._id || cls);
        if (!map.has(id)) map.set(id, { _id: id, name: cls.name || 'Class', modules: [] });
        map.get(id).modules.push(c);
      });
    });
    return Array.from(map.values());
  })();

  // Deep-link: a notification may point straight at a class/module/task — jump there once loaded.
  useEffect(() => {
    if (deepLinkApplied.current || loadingInit || !courses.length) return;
    const targetClassId = searchParams.get('classId');
    const targetCourseId = searchParams.get('courseId');
    if (!targetClassId && !targetCourseId) return;
    deepLinkApplied.current = true;
    const cls = targetClassId ? teacherClasses.find(c => String(c._id) === targetClassId) : null;
    if (!cls) return;
    setSelectedClass(cls);
    const mod = targetCourseId ? cls.modules.find(m => String(m._id) === targetCourseId) : null;
    if (!mod) { setView('modules'); return; }
    setSelectedModule(mod);
    const highlight = searchParams.get('highlight');
    if (!highlight) { setView('type'); return; }
    // The notification only knows the task id — look it up to learn its kind.
    api.get('/assignments', { params: { classId: cls._id, courseId: mod._id, limit: 100 } })
      .then(r => {
        const hit = (r.data.assignments || []).find(a => String(a.id) === String(highlight));
        if (!hit) { setView('type'); return; }
        setTaskType(hit.task_type || 'assignment');
        setMode(hit.mode || 'individual');
        setDiscTab('tasks');
        setView('list');
      })
      .catch(() => setView('type'));
  }, [loadingInit, courses]);

  // Saved groups for the selected class + module (feeds the task form and group filter)
  const fetchGroups = useCallback(async () => {
    if (!selectedClass || !selectedModule) return;
    try {
      const r = await api.get('/task-groups', { params: { classId: selectedClass._id, courseId: selectedModule._id } });
      setGroups(r.data.groups || []);
    } catch { /* the Groups panel reports its own load errors */ }
  }, [selectedClass, selectedModule]);

  useEffect(() => { if (isDiscussion && view === 'list') fetchGroups(); }, [isDiscussion, view, fetchGroups]);

  // Fetch tasks scoped to the selected module + kind
  const fetchAssignments = useCallback(async () => {
    if (!showTaskList || !selectedModule || !taskType) return;
    setLoading(true);
    try {
      const params = { search, page, limit: 10, taskType, mode: taskType === 'homework' ? 'individual' : mode };
      if (selectedClass) params.classId = selectedClass._id;
      if (selectedModule) params.courseId = selectedModule._id;
      if (isDiscussion && groupFilter) params.groupId = groupFilter;
      const res = await api.get('/assignments', { params });
      setAssignments(res.data.assignments || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [showTaskList, search, page, selectedClass, selectedModule, taskType, mode, isDiscussion, groupFilter]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  /* ── jump to, highlight, and (for submission notifications) open the
     submissions panel for the task a notification pointed to ── */
  useEffect(() => {
    if (!flashId || loading || !assignments.length) return;
    const match = assignments.find(a => String(a.id) === String(flashId));
    const el = cardRefs.current[flashId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (match && searchParams.get('openSubmissions') === '1') setViewingSubs(match);
    const t = setTimeout(() => {
      setFlashId(null);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight'); next.delete('courseId'); next.delete('classId'); next.delete('openSubmissions');
      setSearchParams(next, { replace: true });
    }, 3500);
    return () => clearTimeout(t);
  }, [flashId, loading, assignments]);

  const openModal = (a = null) => { setEditing(a); setModal(true); };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/assignments/${deleteTarget.id}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      fetchAssignments();
      if (isDiscussion) fetchGroups();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const handleToggleStatus = (assignment) => setToggleTarget(assignment);

  const handleToggleConfirm = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const res = await api.patch(`/assignments/${toggleTarget.id}/toggle-status`);
      toast.success(res.data.message);
      setToggleTarget(null);
      fetchAssignments();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to toggle status'); }
    finally { setToggling(false); }
  };

  const goToModules = (cls) => {
    setSelectedClass(cls);
    setSelectedModule(null);
    setTaskType(null); setMode(null);
    setAssignments([]);
    setView('modules');
  };

  const goToType = (mod) => {
    setSelectedModule(mod);
    setTaskType(null); setMode(null);
    setSearch(''); setPage(1); setGroupFilter(''); setGroups([]);
    setAssignments([]);
    setView('type');
  };

  const pickType = (type) => {
    setTaskType(type);
    setSearch(''); setPage(1); setGroupFilter(''); setAssignments([]);
    if (type === 'homework') { setMode('individual'); setView('list'); }
    else { setMode(null); setView('mode'); }
  };

  const pickMode = (m) => {
    setMode(m);
    setSearch(''); setPage(1); setGroupFilter(''); setAssignments([]);
    setDiscTab('groups');
    setView('list');
  };

  const goBack = () => {
    setAssignments([]);
    if (view === 'list') setView(taskType === 'homework' ? 'type' : 'mode');
    else if (view === 'mode') setView('type');
    else if (view === 'type') setView('modules');
    else if (view === 'modules') setView('classes');
  };

  /* ── Classes view ── */
  if (view === 'classes') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Assignments</h2>
          <p className="text-sm text-muted">Select a class to manage module assignments</p>
        </div>

        {loadingInit ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : teacherClasses.length === 0 ? (
          <div className="card text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No modules assigned yet</p>
            <p className="text-sm text-muted">Ask the admin to assign modules to you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teacherClasses.map((cls, idx) => {
              const color = moduleColor(idx);
              return (
                <button key={cls._id} onClick={() => goToModules(cls)}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <div className={`w-12 h-12 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                    <BookOpen className={`w-6 h-6 ${color.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{cls.name}</p>
                    <p className="text-xs text-muted mt-0.5">{cls.modules.length} module{cls.modules.length !== 1 ? 's' : ''} assigned to you</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ── Modules view ── */
  if (view === 'modules') {
    const modules = selectedClass?.modules || [];
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack}
            className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-muted font-medium">Classes → Modules</p>
            <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{selectedClass?.name}</h2>
          </div>
        </div>

        <div className="space-y-2">
          {modules.map((mod, idx) => {
            const color = moduleColor(idx);
            return (
              <button key={mod._id} onClick={() => goToType(mod)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:scale-[1.005] active:scale-[0.99]"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <div className={`w-12 h-12 rounded-xl ${color.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-sm font-bold ${color.text}`}>{(mod.code || mod.name || '').slice(0, 3).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {mod.code && <p className={`text-xs font-bold ${color.text} mb-0.5`}>{mod.code}</p>}
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{mod.name}</p>
                  {mod.category && <p className="text-xs text-muted">{mod.category}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            );
          })}
          {modules.length === 0 && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">No modules assigned to you in this class.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Header shared by the kind / mode / list screens ── */
  const crumbs = (
    <div className="flex items-center gap-1.5 text-xs text-muted font-medium mb-0.5 flex-wrap">
      <span>{selectedClass?.name}</span>
      <ChevronRight className="w-3 h-3" />
      {selectedModule?.code && <span className="text-primary-600 font-bold">{selectedModule.code}</span>}
      {taskType && <><ChevronRight className="w-3 h-3" /><span>{taskType === 'homework' ? 'Homework' : 'Assignment'}</span></>}
      {taskType === 'assignment' && mode && <><ChevronRight className="w-3 h-3" /><span>{mode === 'discussion' ? 'Discussion' : 'Individual'}</span></>}
    </div>
  );

  /* ── Kind picker: Assignment | Homework ── */
  if (view === 'type') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div className="flex-1 min-w-0">
            {crumbs}
            <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>{selectedModule?.name}</h2>
            <p className="text-sm text-muted">What kind of task are you giving?</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoiceCard icon={ClipboardList} color={{ bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600' }}
            title="Assignment" desc="Class work — set it for each student individually, or for random discussion groups."
            onClick={() => pickType('assignment')} />
          <ChoiceCard icon={Home} color={{ bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-600' }}
            title="Homework" desc="Individual work students complete at home and submit."
            onClick={() => pickType('homework')} />
        </div>
      </div>
    );
  }

  /* ── Mode picker: Individual | Discussion ── */
  if (view === 'mode') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div className="flex-1 min-w-0">
            {crumbs}
            <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>Assignment</h2>
            <p className="text-sm text-muted">Who is it for?</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoiceCard icon={User} color={{ bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600' }}
            title="Individual" desc="Every student in the class gets the task and submits their own work."
            onClick={() => pickMode('individual')} />
          <ChoiceCard icon={Users} color={{ bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600' }}
            title="Discussion" desc="Create random groups, then give a task to each group. Other groups never see it."
            onClick={() => pickMode('discussion')} />
        </div>
      </div>
    );
  }

  /* ── Task list view (scoped to module + kind) ── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={goBack}
          className="p-2 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div className="flex-1 min-w-0">
          {crumbs}
          <h2 className="font-display font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
            {selectedModule?.name}
          </h2>
          {showTaskList && <p className="text-sm text-muted">{total} {kindNoun(taskType, total)} posted</p>}
        </div>
        {showTaskList && (
          <button onClick={() => openModal()} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> New {taskType === 'homework' ? 'Homework' : isDiscussion ? 'Group Task' : 'Assignment'}
          </button>
        )}
      </div>

      {/* Discussion: Groups | Tasks */}
      {isDiscussion && (
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--card-border)' }}>
          {[['groups', 'Groups', Users], ['tasks', 'Tasks', ClipboardList]].map(([key, label, Icon]) => (
            <button key={key} onClick={() => { setDiscTab(key); setPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                discTab === key ? 'bg-white dark:bg-neutral-800 shadow-sm text-primary-600' : 'text-muted hover:text-primary-600'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}

      {isDiscussion && discTab === 'groups' && (
        <>
          <TaskGroupsPanel cls={selectedClass} module={selectedModule} onChanged={fetchGroups} />
          {groups.length > 0 && (
            <div className="flex justify-end">
              <button onClick={() => setDiscTab('tasks')} className="btn-primary">
                Assign a task to these groups <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {showTaskList && (
        <>
          {/* Search (+ group filter for discussion tasks) */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input-field pl-10" placeholder="Search tasks…" />
            </div>
            {isDiscussion && groups.length > 0 && (
              <select value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setPage(1); }}
                className="input-field sm:w-56">
                <option value="">All groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name} — {g.batch_name}</option>)}
              </select>
            )}
          </div>

          {/* Task list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="card text-center py-16">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted opacity-30" />
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                You haven't posted any {kindNoun(taskType, 2)} here yet
              </p>
              <p className="text-sm text-muted mb-4">
                {isDiscussion && groups.length === 0
                  ? 'Generate and save some groups first, then give them a task.'
                  : `Create the first ${taskType === 'homework' ? 'homework' : 'assignment'} for ${selectedModule?.name}.`}
              </p>
              {isDiscussion && groups.length === 0 ? (
                <button onClick={() => setDiscTab('groups')} className="btn-primary mx-auto">
                  <Users className="w-4 h-4" /> Create groups
                </button>
              ) : (
                <button onClick={() => openModal()} className="btn-primary mx-auto">
                  <Plus className="w-4 h-4" /> New {taskType === 'homework' ? 'Homework' : isDiscussion ? 'Group Task' : 'Assignment'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => (
                <div key={a.id} ref={el => { cardRefs.current[a.id] = el; }}
                  className="card hover:shadow-soft transition-all"
                  style={flashId === a.id ? { boxShadow: '0 0 0 2px #f59e0b, 0 8px 24px rgba(245,158,11,0.25)', transition: 'box-shadow 0.4s ease' } : undefined}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      {taskType === 'homework' ? <Home className="w-5 h-5 text-sky-600" /> : isDiscussion ? <Users className="w-5 h-5 text-violet-600" /> : <ClipboardList className="w-5 h-5 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{a.title}</h3>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <KindBadge taskType={a.task_type} mode={a.mode} />
                            {a.class_name && (
                              <span className="badge text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                {a.class_name}
                              </span>
                            )}
                            <DeadlineBadge deadline={a.deadline} />
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                              background: a.is_active ? '#ecfdf5' : '#f3f4f6',
                              color: a.is_active ? '#059669' : '#6b7280',
                            }}>
                              {a.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Award className="w-3 h-3" /> Max: {a.max_score || 100}
                            </span>
                          </div>
                          {a.mode === 'discussion' && a.groups?.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-2">
                              <Users className="w-3 h-3 text-muted" />
                              {a.groups.map(g => (
                                <span key={g.id} className="badge text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                  {g.name} · {g.member_count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {a.filename && (
                            <button
                              onClick={() => setViewingFile({ ...a, type: 'assignment' })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                background: 'var(--card-border)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--input-border)',
                              }}
                              title="Preview attached file"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Preview
                            </button>
                          )}
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleToggleStatus(a)}
                              className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                              title={a.is_active ? 'Deactivate' : 'Activate'}>
                              {a.is_active
                                ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                                : <ToggleLeft className="w-4 h-4 text-muted" />}
                            </button>
                            <button onClick={() => openModal(a)}
                              className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors" title="Edit">
                              <Edit2 className="w-4 h-4 text-muted" />
                            </button>
                            <button onClick={() => setDeleteTarget(a)}
                              className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-muted" />
                            </button>
                          </div>
                        </div>
                      </div>
                      {a.description && (
                        <p className="text-xs text-muted mt-2 line-clamp-2">{a.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 pt-3 flex-wrap" style={{ borderTop: '1px solid var(--card-border)' }}>
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(a.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <button onClick={() => setViewingSubs(a)}
                          className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline">
                          <Users className="w-3.5 h-3.5" />
                          {a.submission_count || 0}/{a.total_students || 0} submitted
                          {a.avg_score !== null && a.avg_score !== undefined && (
                            <span className="text-muted ml-1">• avg {Math.round(a.avg_score)}%</span>
                          )}
                        </button>
                        {/* Grades Report button — shown after at least one submission */}
                        {(a.submission_count > 0) && (
                          <button onClick={() => setViewingGrades(a)}
                            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline ml-auto">
                            <BarChart2 className="w-3.5 h-3.5" /> Grades Report
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total > 10 && <Pagination page={page} totalPages={Math.ceil(total / 10)} onPageChange={setPage} />}
        </>
      )}

      {/* Create/Edit Modal — module + kind aware */}
      <AssignmentFormModal
        isOpen={modal}
        onClose={() => setModal(false)}
        editing={editing}
        presetClass={selectedClass}
        presetModule={selectedModule}
        taskType={taskType}
        mode={mode}
        groups={groups}
        onSuccess={() => { fetchAssignments(); if (isDiscussion) fetchGroups(); }}
      />

      <ConfirmDialog
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleConfirm}
        loading={toggling}
        title={toggleTarget?.is_active ? 'Deactivate Task' : 'Activate Task'}
        message={toggleTarget?.is_active
          ? `Deactivate "${toggleTarget?.title}"? Students will no longer be able to view or submit it.`
          : `Activate "${toggleTarget?.title}"? Students will be able to view and submit it.`}
        confirmText={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Task"
        message={`Delete "${deleteTarget?.title}"? All submissions will be lost.`}
        confirmText="Delete"
        variant="danger"
      />

      {viewingSubs && <SubmissionsModal assignment={viewingSubs} onClose={() => setViewingSubs(null)} />}
      {viewingGrades && <GradesReportModal assignment={viewingGrades} onClose={() => setViewingGrades(null)} />}
      {viewingFile && (
        <FileViewer
          file={{ ...viewingFile, original_name: viewingFile.original_name || viewingFile.filename }}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}
