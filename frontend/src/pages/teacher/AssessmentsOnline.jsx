/**
 * AssessmentsOnline.jsx  ("Assessments" menu — independent from Marks Recording)
 *
 * Flow: pick a class you're assigned to → pick a module assigned in that
 * class → see every online assessment created for that module in that
 * class, with actions to create a new one, build its questions, share it
 * with the class, and view results/mark sheet.
 *
 * These records are mode:'quiz' Assessment documents — a completely
 * separate set from the mode:'marks' records used by the Marks Recording
 * page, even when they share the same module/class/type/term/year.
 *
 * A module/class/term/year can now hold MULTIPLE assessments of the same
 * type (e.g. two or more Formative Assessments in one term) — each one just
 * needs its own title, which is auto-numbered by the backend when left blank.
 *
 * Editing (type/term/year/class/title) is only allowed before an assessment
 * is shared; once shared, "Add attempt" and "Update sharing" are the ways to
 * adjust it further.
 *
 * API contract:
 *   GET  /assessment/teacher/courses                                   -> modules + their assigned classes
 *   GET  /assessment/teacher/assessments?course_id=&class_id=&mode=quiz -> assessments for one module+class
 *   POST /assessment/teacher/assessments            (mode: 'quiz')     -> create
 *   PUT  /assessment/teacher/assessments/:id                            -> edit (pre-share only)
 *   DELETE /assessment/teacher/assessments/:id                          -> delete
 *   POST /assessment/teacher/assessments/:id/attempts/add               -> add attempt(s) to a shared assessment
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import QuizBuilderModal from '../../components/common/QuizBuilderModal';
import ShareAssessmentModal from '../../components/common/ShareAssessmentModal';
import AddAttemptModal from '../../components/common/AddAttemptModal';
import AssessmentAttemptsModal from '../../components/common/AssessmentAttemptsModal';
import {
  ClipboardCheck, School, BookOpen, ChevronRight, Plus, Loader2,
  ListChecks, Share2, BarChart3, Edit2, Trash2, ArrowLeft, Inbox,
  Lock, PlusCircle, Sparkles,
} from 'lucide-react';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [`${CURRENT_YEAR - 1}-${CURRENT_YEAR}`, `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`, `${CURRENT_YEAR + 1}-${CURRENT_YEAR + 2}`];
const ASSESSMENT_TYPES = [
  { key: 'FA', label: 'Formative Assessment' },
  { key: 'IA', label: 'Integrated Assessment' },
  { key: 'CA', label: 'Comprehensive Assessment' },
];

function courseClasses(course) {
  return (Array.isArray(course.class_ids) && course.class_ids.length > 0)
    ? course.class_ids
    : (course.class_id ? [course.class_id] : []);
}

/* ── Create / edit an assessment (type, term, year, title, max marks) ──
   Multiple assessments of the same type/term/year are allowed now, so the
   title is what tells them apart — left blank, the backend auto-numbers it
   ("Formative Assessment 2", "…3", …). Only reachable pre-share for edits;
   the parent never opens this for an already-shared assessment. */
function AssessmentFormModal({ course, cls, editing, existingAssessments, onClose, onSaved }) {
  const [type, setType] = useState(editing?.type || 'FA');
  const [term, setTerm] = useState(editing?.term || TERMS[0]);
  const [academicYear, setAcademicYear] = useState(editing?.academic_year || YEARS[1]);
  const [maxMarks, setMaxMarks] = useState(editing?.max_marks || course.total_marks || 100);
  const [title, setTitle] = useState(editing?.title || '');
  const [saving, setSaving] = useState(false);

  const typeLabel = ASSESSMENT_TYPES.find(t => t.key === type)?.label || 'Assessment';
  const siblingCount = useMemo(() => {
    if (editing) return 0;
    return existingAssessments.filter(a => a.type === type && a.term === term && a.academic_year === academicYear).length;
  }, [editing, existingAssessments, type, term, academicYear]);
  const suggestedTitle = siblingCount > 0 ? `${typeLabel} ${siblingCount + 1}` : typeLabel;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/assessment/teacher/assessments/${editing.id}`, {
          type, term, academic_year: academicYear, title: title.trim() || undefined,
        });
      } else {
        await api.post('/assessment/teacher/assessments', {
          course_id: course.id, class_id: cls.id || cls._id, type, term, academic_year: academicYear,
          max_marks: maxMarks, mode: 'quiz', title: title.trim() || undefined,
        });
      }
      toast.success(editing ? 'Assessment updated' : 'Assessment created');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={editing ? 'Edit Assessment' : 'Create Assessment'}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{course.name} · {cls.name}</p>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Assessment type</label>
          <div className="grid grid-cols-1 gap-2">
            {ASSESSMENT_TYPES.map(t => (
              <button key={t.key} onClick={() => setType(t.key)}
                className="text-left px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all duration-150"
                style={{ borderColor: type === t.key ? '#6366f1' : 'var(--card-border)', background: type === t.key ? 'rgba(99,102,241,0.1)' : 'transparent', color: 'var(--text-primary)' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Term</label>
            <select value={term} onChange={e => setTerm(e.target.value)} className="chat-form-field w-full text-sm">
              {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Academic year</label>
            <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="chat-form-field w-full text-sm">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={suggestedTitle}
            className="chat-form-field w-full text-sm"
          />
          {!editing && siblingCount > 0 && (
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#6366f1' }}>
              <Sparkles className="w-3.5 h-3.5" />
              You already have {siblingCount} {typeLabel.toLowerCase()}{siblingCount > 1 ? 's' : ''} in {term} — leave blank to auto-name this "{suggestedTitle}".
            </p>
          )}
        </div>

        {!editing && (
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Maximum marks</label>
            <input type="number" min="1" max={course.total_marks || 100} value={maxMarks} onChange={e => setMaxMarks(e.target.value)} className="chat-form-field w-full text-sm" />
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Cannot exceed the module weight ({course.total_marks || 100} marks).</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary assessment-cta flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {editing ? 'Save Changes' : 'Create Assessment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function AssessmentsOnline() {
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courses, setCourses] = useState([]);

  const [selectedClass, setSelectedClass] = useState(null);   // { _id/id, name }
  const [selectedCourse, setSelectedCourse] = useState(null); // module

  const [assessments, setAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  const [formModal, setFormModal] = useState(null);   // { editing } | null when creating fresh (use {} sentinel)
  const [questionsModal, setQuestionsModal] = useState(null);
  const [shareModal, setShareModal] = useState(null);
  const [addAttemptModal, setAddAttemptModal] = useState(null);
  const [attemptsModal, setAttemptsModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false });

  useEffect(() => {
    (async () => {
      setLoadingCourses(true);
      try {
        const { data } = await api.get('/assessment/teacher/courses');
        setCourses(data.courses);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load your modules');
      } finally {
        setLoadingCourses(false);
      }
    })();
  }, []);

  /* Unique classes derived from every module assigned to this teacher */
  const classes = useMemo(() => {
    const map = new Map();
    courses.forEach(c => courseClasses(c).forEach(cl => { if (cl?._id) map.set(String(cl._id), cl); }));
    return Array.from(map.values());
  }, [courses]);

  /* Modules assigned in the selected class */
  const modulesInClass = useMemo(() => {
    if (!selectedClass) return [];
    return courses.filter(c => courseClasses(c).some(cl => String(cl._id) === String(selectedClass._id)));
  }, [courses, selectedClass]);

  const loadAssessments = useCallback(async () => {
    if (!selectedClass || !selectedCourse) return;
    setLoadingAssessments(true);
    try {
      const { data } = await api.get('/assessment/teacher/assessments', {
        params: { course_id: selectedCourse.id, class_id: selectedClass._id, mode: 'quiz' },
      });
      setAssessments(data.assessments);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load assessments');
    } finally {
      setLoadingAssessments(false);
    }
  }, [selectedClass, selectedCourse]);

  useEffect(() => { loadAssessments(); }, [loadAssessments]);

  const handleDelete = (a) => {
    setConfirmModal({
      open: true,
      variant: 'danger',
      title: 'Delete Assessment',
      message: `Delete "${a.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmModal(cm => ({ ...cm, loading: true }));
        try {
          await api.delete(`/assessment/teacher/assessments/${a.id}`);
          toast.success('Assessment deleted');
          loadAssessments();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to delete assessment');
        } finally {
          setConfirmModal({ open: false });
        }
      },
    });
  };

  const handleEditClick = (a) => {
    if (a.is_shared) {
      toast.error('This assessment has already been shared. Unshare it first if you need to change its type, term, year or title.');
      return;
    }
    setFormModal({ editing: a });
  };

  const step = !selectedClass ? 'classes' : !selectedCourse ? 'modules' : 'assessments';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40">
          <ClipboardCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 assessment-icon-float" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Assessments</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Build and share online assessments students attempt digitally</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm mb-6 flex-wrap">
        <button onClick={() => { setSelectedClass(null); setSelectedCourse(null); }}
          className="font-semibold transition-colors duration-150" style={{ color: selectedClass ? 'var(--text-secondary)' : '#6366f1' }}>Classes</button>
        {selectedClass && (
          <>
            <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            <button onClick={() => setSelectedCourse(null)} className="font-semibold transition-colors duration-150" style={{ color: selectedCourse ? 'var(--text-secondary)' : '#6366f1' }}>{selectedClass.name}</button>
          </>
        )}
        {selectedCourse && (
          <>
            <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            <span className="font-semibold" style={{ color: '#6366f1' }}>{selectedCourse.name}</span>
          </>
        )}
      </div>

      {loadingCourses ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>
      ) : step === 'classes' ? (
        classes.length === 0 ? (
          <div className="card p-10 text-center">
            <Inbox className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>No classes assigned to you yet — ask an admin to assign a module to one of your classes first.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 assessment-stagger">
            {classes.map((cl, i) => (
              <button key={cl._id} style={{ '--i': i }} onClick={() => setSelectedClass(cl)} className="card assessment-tile p-5 text-left">
                <School className="w-6 h-6 mb-2 text-indigo-500 assessment-tile-icon" />
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cl.name}</p>
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  View modules <ChevronRight className="w-3.5 h-3.5" />
                </p>
              </button>
            ))}
          </div>
        )
      ) : step === 'modules' ? (
        <>
          <button onClick={() => setSelectedClass(null)} className="text-sm font-semibold flex items-center gap-1 mb-4 transition-colors duration-150 hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft className="w-4 h-4" /> Back to classes
          </button>
          {modulesInClass.length === 0 ? (
            <div className="card p-10 text-center">
              <Inbox className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No modules assigned to you in this class yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 assessment-stagger">
              {modulesInClass.map((c, i) => (
                <button key={c.id} style={{ '--i': i }} onClick={() => setSelectedCourse(c)} className="card assessment-tile p-5 text-left">
                  <BookOpen className="w-6 h-6 mb-2 text-violet-500 assessment-tile-icon" />
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                  {c.code && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.code}</p>}
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    View assessments <ChevronRight className="w-3.5 h-3.5" />
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setSelectedCourse(null)} className="text-sm font-semibold flex items-center gap-1 transition-colors duration-150 hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
              <ArrowLeft className="w-4 h-4" /> Back to modules
            </button>
            <button onClick={() => setFormModal({})} className="btn-primary assessment-cta text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Create New Assessment
            </button>
          </div>

          {loadingAssessments ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-secondary)' }} /></div>
          ) : assessments.length === 0 ? (
            <div className="card p-10 text-center">
              <Inbox className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No assessments yet for this module in {selectedClass.name}.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>You can create several formative assessments in the same term — each just needs its own title.</p>
            </div>
          ) : (
            <div className="space-y-3 assessment-stagger">
              {assessments.map((a, i) => (
                <div key={a.id} style={{ '--i': i }} className="card assessment-card p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                      <span className={`badge text-xs ${a.is_shared ? 'assessment-badge-live' : ''}`} style={{ background: a.is_shared ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.15)', color: a.is_shared ? '#10b981' : '#9ca3af' }}>
                        {a.is_shared ? 'Shared' : 'Draft'}
                      </span>
                      {a.is_shared && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>· {a.max_attempts} attempt{a.max_attempts > 1 ? 's' : ''} allowed</span>}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a.term} · {a.academic_year} · Max {a.max_marks} marks</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setQuestionsModal(a)} className="btn-secondary text-xs flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" /> Questions</button>
                    <button onClick={() => setShareModal(a)} className="btn-secondary text-xs flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" /> {a.is_shared ? 'Update Sharing' : 'Share'}</button>
                    {a.is_shared && <button onClick={() => setAddAttemptModal(a)} className="btn-secondary text-xs flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5" /> Add Attempt</button>}
                    {a.is_shared && <button onClick={() => setAttemptsModal(a)} className="btn-secondary text-xs flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Results</button>}
                    <button
                      onClick={() => handleEditClick(a)}
                      title={a.is_shared ? 'Unshare to edit type/term/year/title' : 'Edit'}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                      style={a.is_shared ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                    >
                      {a.is_shared ? <Lock className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />} Edit
                    </button>
                    <button onClick={() => handleDelete(a)} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 transition-all duration-150 hover:bg-red-500/10" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)' }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {formModal && selectedCourse && selectedClass && (
        <AssessmentFormModal
          course={selectedCourse}
          cls={selectedClass}
          editing={formModal.editing}
          existingAssessments={assessments}
          onClose={() => setFormModal(null)}
          onSaved={loadAssessments}
        />
      )}
      {questionsModal && (
        <QuizBuilderModal assessment={questionsModal} onClose={() => setQuestionsModal(null)} onSaved={loadAssessments} />
      )}
      {shareModal && (
        <ShareAssessmentModal assessment={shareModal} onClose={() => setShareModal(null)} onShared={loadAssessments} />
      )}
      {addAttemptModal && (
        <AddAttemptModal assessment={addAttemptModal} onClose={() => setAddAttemptModal(null)} onAdded={loadAssessments} />
      )}
      {attemptsModal && (
        <AssessmentAttemptsModal assessment={attemptsModal} onClose={() => setAttemptsModal(null)} />
      )}

      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false })}
        onConfirm={confirmModal.onConfirm}
        loading={confirmModal.loading}
        variant={confirmModal.variant}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText="Cancel"
      />
    </div>
  );
}
