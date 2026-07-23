/**
 * ResultsPickerModal.jsx
 *
 * Entry point for "View Results" on the teacher's online-Assessments page.
 * Rather than a Results button on every individual assessment card, all
 * shared assessments for the current module+class are grouped here by
 * type/term/academic-year (e.g. "Formative Assessment · Term 1 · 2025-2026")
 * so the teacher can pick a single assessment (FA1, FA2, ...) to view its
 * own mark sheet, or — whenever a group holds more than one assessment —
 * "Overall" to see them combined into one result scaled onto the module
 * weight.
 */
import { useMemo } from 'react';
import Modal from './Modal';
import { Inbox, ChevronRight, Layers } from 'lucide-react';

const ASSESSMENT_TYPE_LABELS = { FA: 'Formative Assessment', IA: 'Integrated Assessment', CA: 'Comprehensive Assessment' };
const TERM_ORDER = { 'Term 1': 0, 'Term 2': 1, 'Term 3': 2 };

export default function ResultsPickerModal({ assessments, onClose, onSelectAssessment, onSelectOverall }) {
  const groups = useMemo(() => {
    const map = new Map();
    assessments.filter(a => a.is_shared).forEach(a => {
      const key = `${a.academic_year}|${a.term}|${a.type}`;
      if (!map.has(key)) map.set(key, { academic_year: a.academic_year, term: a.term, type: a.type, items: [] });
      map.get(key).items.push(a);
    });
    return Array.from(map.values()).sort((x, y) =>
      y.academic_year.localeCompare(x.academic_year) ||
      (TERM_ORDER[x.term] ?? 0) - (TERM_ORDER[y.term] ?? 0) ||
      x.type.localeCompare(y.type)
    );
  }, [assessments]);

  return (
    <Modal isOpen={true} onClose={onClose} title="View Results" size="lg">
      {groups.length === 0 ? (
        <div className="text-center py-10">
          <Inbox className="w-9 h-9 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No shared assessments yet — share an assessment to see its results here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => {
            const typeLabel = ASSESSMENT_TYPE_LABELS[g.type] || g.type;
            return (
              <div key={`${g.academic_year}-${g.term}-${g.type}`}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {typeLabel} · {g.term} · {g.academic_year}
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map(a => (
                    <button
                      key={a.id}
                      onClick={() => onSelectAssessment(a)}
                      className="btn-secondary text-xs flex items-center gap-1"
                    >
                      {a.title} <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ))}
                  {g.items.length > 1 && (
                    <button
                      onClick={() => onSelectOverall(g)}
                      title={`Combine ${g.items.length} assessments into one scaled result`}
                      className="btn-primary text-xs flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" /> Overall
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}