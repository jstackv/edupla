/**
 * OverallResultsModal.jsx
 *
 * Combines every SHARED assessment of one type/term/year (e.g. Formative
 * Assessment 1 + Formative Assessment 2, both in Term 1 2025-2026) into a
 * single "Overall" mark sheet: each student's best score on every
 * assessment is summed, that sum is taken over the sum of each
 * assessment's own max marks, and the combined fraction is scaled onto
 * the module weight — so the module weight is never counted more than
 * once even though each assessment independently caps at it.
 *
 * The table can have an arbitrary number of per-assessment columns, so
 * this uses a wide modal, pinned "No./Student" columns (they stay put
 * while the assessment columns scroll horizontally), and wrapped —
 * rather than truncated — column headers so every assessment title stays
 * legible no matter how many there are.
 *
 * API contract:
 *   GET /assessment/teacher/assessments/overall?course_id=&class_id=&type=&term=&academic_year=
 *   GET /assessment/teacher/assessments/overall/excel  (same query params) -> file download
 *   GET /assessment/teacher/assessments/overall/pdf    (same query params) -> file download
 */
import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Loader2, FileSpreadsheet, FileText, Layers, MoveHorizontal, Search, X,
  ArrowUpDown, ArrowUp, ArrowDown, Users, TrendingUp, Trophy, AlertTriangle,
  CheckCircle2, XCircle, Medal,
} from 'lucide-react';

const STATUS_STYLE = {
  graded:         { label: 'Graded',        color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  needs_grading:  { label: 'Needs grading', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  not_attempted:  { label: 'Not attempted', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};

// Column widths — kept as named constants so the sticky-column left
// offsets below always agree with the grid template itself.
const COL_NO = 40;
const COL_STUDENT = 190;
const COL_ASSESSMENT_MIN = 130;
const COL_TOTAL = 100;
const COL_PCT = 130;
const COL_MW = 110;
const COL_DECISION = 110;

// Two-line clamp for header labels so long assessment titles stay fully
// readable (wrapped) instead of being cut off with an ellipsis.
const clampStyle = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'normal',
  lineHeight: 1.25,
};

// Vertical divider between every column of the grid.
const vDivider = { borderRight: '1px solid var(--card-border)' };

// "Formative Assessment 2" -> "FA2"; "Comprehensive Assessment" -> "CA1"
// (untitled/first-in-series assessments have no trailing number, so they
// default to 1 to stay consistent with how siblings are auto-numbered).
function shorthandTitle(title) {
  if (!title) return '';
  const match = title.trim().match(/^(.*?)\s*(\d+)?$/);
  const base = (match?.[1] || title).trim();
  const num = match?.[2] || '1';
  const initials = base.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();
  return `${initials}${num}`;
}

// Round to the nearest whole number for display; leaves null/undefined as-is.
const roundNum = (v) => (v == null ? v : Math.round(v));

// Performance color scale used for the percentage bar + text.
function perfColor(pct) {
  if (pct == null) return '#9ca3af';
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#6366f1';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

const RANK_STYLE = {
  1: { color: '#eab308', label: '1st' },
  2: { color: '#94a3b8', label: '2nd' },
  3: { color: '#d97706', label: '3rd' },
};

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

export default function OverallResultsModal({ courseId, classId, type, term, academicYear, typeLabel, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('no');   // 'no' | 'name' | 'total' | 'percentage'
  const [sortDir, setSortDir] = useState('asc');
  const [needsGradingOnly, setNeedsGradingOnly] = useState(false);

  const params = { course_id: courseId, class_id: classId, type, term, academic_year: academicYear };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/assessment/teacher/assessments/overall', { params });
        if (alive) setData(data);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load overall results');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [courseId, classId, type, term, academicYear]);

  const download = async (kind) => {
    setDownloading(kind);
    try {
      const { data } = await api.get(`/assessment/teacher/assessments/overall/${kind}`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overall-marksheet.${kind === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Failed to download ${kind === 'excel' ? 'Excel' : 'PDF'} mark sheet`);
    } finally {
      setDownloading(null);
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  // Rank is computed from the full, unfiltered/unsorted dataset so a
  // student's medal never shifts just because of a search or sort change.
  const rankByStudent = useMemo(() => {
    if (!data) return {};
    const withPct = data.rows.filter(r => r.percentage != null).sort((a, b) => b.percentage - a.percentage);
    const map = {};
    withPct.forEach((r, idx) => { map[r.student_id] = idx + 1; });
    return map;
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return null;
    const withPct = data.rows.filter(r => r.percentage != null);
    const avg = withPct.length ? withPct.reduce((s, r) => s + r.percentage, 0) / withPct.length : null;
    const highest = withPct.length ? Math.max(...withPct.map(r => r.percentage)) : null;
    const passCount = data.rows.filter(r => r.decision === 'C').length;
    const needsGrading = data.rows.filter(r => r.status === 'needs_grading').length;
    return { avg, highest, passCount, needsGrading, total: data.rows.length };
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (needsGradingOnly) rows = rows.filter(r => r.status === 'needs_grading');
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.student_name.toLowerCase().includes(q));
    if (sortKey === 'no') return rows;
    const sorted = [...rows].sort((a, b) => {
      let av, bv;
      if (sortKey === 'name') { av = a.student_name.toLowerCase(); bv = b.student_name.toLowerCase(); }
      else if (sortKey === 'total') { av = a.total_obtained ?? -1; bv = b.total_obtained ?? -1; }
      else { av = a.percentage ?? -1; bv = b.percentage ?? -1; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, search, needsGradingOnly, sortKey, sortDir]);

  const n = data?.assessments?.length || 0;
  const gridCols = `${COL_NO}px ${COL_STUDENT}px repeat(${n}, minmax(${COL_ASSESSMENT_MIN}px, 1fr)) ${COL_TOTAL}px ${COL_PCT}px ${COL_MW}px ${COL_DECISION}px`;
  const minWidth = COL_NO + COL_STUDENT + n * COL_ASSESSMENT_MIN + COL_TOTAL + COL_PCT + COL_MW + COL_DECISION;

  return (
    <Modal isOpen={true} onClose={onClose} title={`Overall — ${typeLabel} · ${term} · ${academicYear}`} size="full">
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>
      ) : !data ? null : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs flex items-center gap-1.5 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
              <Layers className="w-3.5 h-3.5 flex-shrink-0" />
              Combines {n} assessment{n > 1 ? 's' : ''} ({data.assessments.map(a => a.title).join(', ')}) — {data.combined_max} marks scaled onto the module weight ({data.module_weight}).
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => download('excel')} disabled={!!downloading} className="btn-secondary text-xs flex items-center gap-1.5">
                {downloading === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Excel
              </button>
              <button onClick={() => download('pdf')} disabled={!!downloading} className="btn-secondary text-xs flex items-center gap-1.5">
                {downloading === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} PDF
              </button>
            </div>
          </div>

          {/* Summary stat strip */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 assessment-stagger">
              {[
                { label: 'Students', value: stats.total, color: '#6366f1', icon: Users },
                { label: 'Class average', value: stats.avg != null ? `${roundNum(stats.avg)}%` : '—', color: perfColor(stats.avg), icon: TrendingUp },
                { label: 'Top score', value: stats.highest != null ? `${roundNum(stats.highest)}%` : '—', color: '#eab308', icon: Trophy },
                { label: 'Needs grading', value: stats.needsGrading, color: '#f59e0b', icon: AlertTriangle },
              ].map((it, i) => (
                <div key={it.label} style={{ '--i': i }} className="card assessment-card p-3.5 flex items-center gap-3 relative overflow-hidden">
                  <div className="pointer-events-none absolute top-0 right-0 w-16 h-16" style={{ background: `radial-gradient(circle at top right, ${it.color}20 0%, transparent 70%)` }} />
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${it.color}1f` }}>
                    <it.icon className="w-4.5 h-4.5" style={{ color: it.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-none" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{it.value}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{it.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar: search + filter chip */}
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
              className="filter-pill flex items-center gap-1.5"
              className={`filter-pill flex items-center gap-1.5 ${needsGradingOnly ? 'active' : ''}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Needs grading only
            </button>
            {(search || needsGradingOnly) && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Showing {visibleRows.length} of {data.rows.length} student{data.rows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {n > 2 && (
            <p className="text-xs flex items-center gap-1.5 sm:hidden" style={{ color: 'var(--text-secondary)' }}>
              <MoveHorizontal className="w-3.5 h-3.5" /> Scroll sideways to see every assessment
            </p>
          )}

          <div className="overflow-auto rounded-xl" style={{ border: '1px solid var(--card-border)', maxHeight: '58vh' }}>
            <div style={{ minWidth }}>
              {/* Header row */}
              <div
                className="results-header-row grid text-xs uppercase tracking-wide sticky top-0 z-10"
                style={{ gridTemplateColumns: gridCols, color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
              >
                <div className="results-sticky-col py-2.5 px-2 flex items-center" style={{ left: 0, ...vDivider }}>No.</div>
                <SortHeader
                  label="Student" active={sortKey === 'name'} dir={sortDir}
                  onClick={() => toggleSort('name')}
                  className="results-sticky-col"
                  style={{ left: COL_NO, ...vDivider, background: 'var(--card-bg)' }}
                />
                {data.assessments.map(a => (
                  <div key={a.id} className="py-2.5 px-3 flex items-center" title={`${a.title} /${a.max_marks}`} style={{ ...clampStyle, ...vDivider }}>{shorthandTitle(a.title)} /{a.max_marks}</div>
                ))}
                <SortHeader label={`Total /${data.combined_max}`} active={sortKey === 'total'} dir={sortDir} onClick={() => toggleSort('total')} style={vDivider} />
                <SortHeader label="%" active={sortKey === 'percentage'} dir={sortDir} onClick={() => toggleSort('percentage')} style={vDivider} />
                <div className="py-2.5 px-3 flex items-center" style={vDivider}>{data.module_weight}</div>
                <div className="py-2.5 px-3 flex items-center">Decision</div>
              </div>

              {visibleRows.map((row, i) => {
                const st = STATUS_STYLE[row.status] || STATUS_STYLE.not_attempted;
                const rank = rankByStudent[row.student_id];
                const rankStyle = rank ? RANK_STYLE[rank] : null;
                const pColor = perfColor(row.percentage);
                return (
                  <div
                    key={row.student_id}
                    className="results-row grid items-center"
                    style={{ gridTemplateColumns: gridCols, borderTop: i === 0 ? 'none' : '1px solid var(--card-border)', '--i': i }}
                  >
                    <div className="results-sticky-col py-2.5 px-2" style={{ left: 0, color: 'var(--text-secondary)', ...vDivider }}>{i + 1}</div>
                    <div className="results-sticky-col py-2.5 px-3 font-medium truncate flex items-center gap-1.5" style={{ left: COL_NO, color: 'var(--text-primary)', ...vDivider }} title={row.student_name}>
                      {rankStyle && <Medal className="w-3.5 h-3.5 flex-shrink-0" style={{ color: rankStyle.color }} title={`Rank ${rankStyle.label}`} />}
                      <span className="truncate">{row.student_name}</span>
                    </div>
                    {row.per_assessment.map(pa => (
                      <div key={pa.assessment_id} className="py-2.5 px-3 min-w-0 truncate font-mono" style={{ color: 'var(--text-secondary)', ...vDivider }}>
                        {pa.best_score != null ? roundNum(pa.best_score) : '—'}
                      </div>
                    ))}
                    <div className="py-2.5 px-3 min-w-0 truncate font-mono font-semibold" style={{ color: 'var(--text-primary)', ...vDivider }}>
                      {row.total_obtained != null ? roundNum(row.total_obtained) : '—'}
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
                    <div className="py-2.5 px-3 min-w-0 flex items-center gap-2">
                      {row.decision ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1" style={{ background: row.decision === 'C' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)', color: row.decision === 'C' ? '#10b981' : '#ef4444' }}>
                          {row.decision === 'C' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {row.decision}
                        </span>
                      ) : (
                        <span className="badge text-xs whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {visibleRows.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Search className="w-6 h-6 opacity-50" />
                  <p className="text-sm">{data.rows.length === 0 ? 'No students in this class yet.' : 'No students match your filters.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}