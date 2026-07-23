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
import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Loader2, FileSpreadsheet, FileText, Layers, MoveHorizontal } from 'lucide-react';

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
const COL_PCT = 70;
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

export default function OverallResultsModal({ courseId, classId, type, term, academicYear, typeLabel, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(null);

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

          {n > 2 && (
            <p className="text-xs flex items-center gap-1.5 sm:hidden" style={{ color: 'var(--text-secondary)' }}>
              <MoveHorizontal className="w-3.5 h-3.5" /> Scroll sideways to see every assessment
            </p>
          )}

          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--card-border)' }}>
            <div style={{ minWidth }}>
              {/* Header row */}
              <div
                className="results-header-row grid text-xs uppercase tracking-wide"
                style={{ gridTemplateColumns: gridCols, color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)' }}
              >
                <div className="results-sticky-col py-2.5 px-2 flex items-center" style={{ left: 0 }}>No.</div>
                <div className="results-sticky-col py-2.5 px-3 flex items-center" style={{ left: COL_NO }}>Student</div>
                {data.assessments.map(a => (
                  <div key={a.id} className="py-2.5 px-3 flex items-center" title={a.title} style={clampStyle}>{a.title}</div>
                ))}
                <div className="py-2.5 px-3 flex items-center">Total</div>
                <div className="py-2.5 px-3 flex items-center">%</div>
                <div className="py-2.5 px-3 flex items-center">MW</div>
                <div className="py-2.5 px-3 flex items-center">Decision</div>
              </div>

              {data.rows.map((row, i) => {
                const st = STATUS_STYLE[row.status] || STATUS_STYLE.not_attempted;
                return (
                  <div
                    key={row.student_id}
                    className="results-row grid items-center"
                    style={{ gridTemplateColumns: gridCols, borderTop: i === 0 ? 'none' : '1px solid var(--card-border)', '--i': i }}
                  >
                    <div className="results-sticky-col py-2.5 px-2" style={{ left: 0, color: 'var(--text-secondary)' }}>{i + 1}</div>
                    <div className="results-sticky-col py-2.5 px-3 font-medium truncate" style={{ left: COL_NO, color: 'var(--text-primary)' }} title={row.student_name}>
                      {row.student_name}
                    </div>
                    {row.per_assessment.map(pa => (
                      <div key={pa.assessment_id} className="py-2.5 px-3 min-w-0 truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {pa.best_score != null ? `${pa.best_score}/${pa.max_marks}` : '—'}
                      </div>
                    ))}
                    <div className="py-2.5 px-3 min-w-0 truncate font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {row.total_obtained != null ? `${row.total_obtained}/${row.combined_max}` : '—'}
                    </div>
                    <div className="py-2.5 px-3 min-w-0 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {row.percentage != null ? `${row.percentage}%` : '—'}
                    </div>
                    <div className="py-2.5 px-3 min-w-0 truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {row.marks_on_mw != null ? `${row.marks_on_mw}/${row.module_weight}` : '—'}
                    </div>
                    <div className="py-2.5 px-3 min-w-0 flex items-center gap-2">
                      {row.decision ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: row.decision === 'C' ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)', color: row.decision === 'C' ? '#10b981' : '#ef4444' }}>
                          {row.decision}
                        </span>
                      ) : (
                        <span className="badge text-xs whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {data.rows.length === 0 && (
                <div className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>No students in this class yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}