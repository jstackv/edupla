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
 * is shared; once shared, "Unshare" is how a teacher gets back into editing
 * the question paper — it voids every submission recorded so far (they no
 * longer count towards results/marks) and re-shared attempts start fresh.
 * "Add attempt" and "Update sharing" are the ways to adjust a still-shared
 * assessment further without unsharing it.
 *
 * API contract:
 *   GET  /assessment/teacher/courses                                   -> modules + their assigned classes
 *   GET  /assessment/teacher/assessments?course_id=&class_id=&mode=quiz -> assessments for one module+class
 *   POST /assessment/teacher/assessments            (mode: 'quiz')     -> create
 *   PUT  /assessment/teacher/assessments/:id                            -> edit (pre-share only)
 *   DELETE /assessment/teacher/assessments/:id                          -> delete
 *   POST /assessment/teacher/assessments/:id/unshare                    -> unshare + void submissions, unlocks questions
 *   POST /assessment/teacher/assessments/:id/attempts/add               -> add attempt(s), optionally with new duration/expiry
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
import ResultsPickerModal from '../../components/common/ResultsPickerModal';
import OverallResultsModal from '../../components/common/OverallResultsModal';
import {
  ClipboardCheck, School, BookOpen, ChevronRight, Plus, Loader2,
  ListChecks, Share2, BarChart3, Edit2, Trash2, ArrowLeft, Inbox,
  Lock, PlusCircle, Sparkles, Award, FileEdit, Users, Scale, Undo2,
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

/* Glance-and-go summary strip above the assessment list — same pattern as
   the student Assessments page's OverviewStrip, so the teacher-facing
   screen reads with the same polish. */
function AssessmentOverviewStrip({ assessments }) {
  const total = assessments.length;
  const shared = assessments.filter(a => a.is_shared).length;
  const draft = total - shared;
  const marked = assessments.reduce((s, a) => s + (a.marked_count || 0), 0);

  if (total === 0) return null;

  const items = [
    { label: 'Assessments', value: total, color: '#6366f1', icon: ClipboardCheck },
    { label: 'Shared', value: shared, color: '#10b981', icon: Share2 },
    { label: 'Drafts', value: draft, color: '#9ca3af', icon: FileEdit },
    { label: 'Marks recorded', value: marked, color: '#f59e0b', icon: Award },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 assessment-stagger">
      {items.map((it, i) => (
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
  );
}

/* One assessment's card — ambient status glow + a clear read on where its
   marks currently stand (auto-computed max, capped by the module weight). */
function AssessmentCard({ a, i, onQuestions, onShare, onAddAttempt, onEdit, onDelete, onUnshare }) {
  const statusColor = a.is_shared ? '#10b981' : '#9ca3af';
  const hasQuestions = (a.max_marks || 0) > 0;

  return (
    <div
      style={{ '--i': i, borderColor: `color-mix(in srgb, ${statusColor} 18%, var(--card-border))` }}
      className="card assessment-card p-4 flex flex-col gap-3 relative"
    >
      <div
        className="pointer-events-none absolute top-0 right-0 w-24 h-24 rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${statusColor}18 0%, transparent 70%)` }}
      />

      <div className="flex items-start justify-between gap-2 relative flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
            <span className={`badge text-xs ${a.is_shared ? 'assessment-badge-live' : ''}`} style={{ background: a.is_shared ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.15)', color: statusColor }}>
              {a.is_shared ? 'Shared' : 'Draft'}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{a.term} · {a.academic_year}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs relative">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
            <Scale className="w-3 h-3" />
            {hasQuestions ? `${a.max_marks} / ${a.course_id?.total_marks || 100} MW` : `Awaiting questions (MW ${a.course_id?.total_marks || 100})`}
          </span>
          {a.is_shared && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
              <Users className="w-3 h-3" /> {a.max_attempts} attempt{a.max_attempts > 1 ? 's' : ''}
            </span>
          )}
          {a.student_count > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
              <Award className="w-3 h-3" /> {a.marked_count}/{a.student_count} marked
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 relative">
        <button onClick={() => onQuestions(a)} className="btn-secondary text-xs flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" /> Questions</button>
        <button onClick={() => onShare(a)} className="btn-secondary text-xs flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" /> {a.is_shared ? 'Update Sharing' : 'Share'}</button>
        {a.is_shared && <button onClick={() => onAddAttempt(a)} className="btn-secondary text-xs flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5" /> Add Attempt</button>}
        {a.is_shared && (
          <button
            onClick={() => onUnshare(a)}
            title="Unshare to edit questions — voids current student submissions"
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 hover:bg-amber-500/10"
            style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: '#d97706' }}
          >
            <Undo2 className="w-3.5 h-3.5" /> Unshare
          </button>
        )}
        <button
          onClick={() => onEdit(a)}
          title={a.is_shared ? 'Unshare to edit type/term/year/title' : 'Edit'}
          className="btn-secondary text-xs flex items-center gap-1.5"
          style={a.is_shared ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
        >
          {a.is_shared ? <Lock className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />} Edit
        </button>
        <button onClick={() => onDelete(a)} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 transition-all duration-150 hover:bg-red-500/10 ml-auto" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)' }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
      </div>
    </div>
  );
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
          mode: 'quiz', title: title.trim() || undefined,
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
          <div className="p-3 rounded-xl text-sm flex items-start gap-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#6366f1' }} />
            <p style={{ color: 'var(--text-secondary)' }}>
              No need to set a maximum here — once you build the question paper, the total is calculated automatically from each question's marks. It doesn't need to match the module weight ({course.total_marks || 100} marks) exactly — results are scaled onto it automatically.
            </p>
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
  const [resultsPickerOpen, setResultsPickerOpen] = useState(false);
  const [attemptsModal, setAttemptsModal] = useState(null);   // single-assessment results
  const [overallModal, setOverallModal] = useState(null);     // combined ("Overall") results for a type/term/year group
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
      message: `Delete "${a.title}"? Any student attempts and results recorded for it will be removed as well. This cannot be undone.`,
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

  const handleUnshare = (a) => {
    setConfirmModal({
      open: true,
      variant: 'danger',
      title: 'Unshare Assessment',
      message: `Unshare "${a.title}"? Students will no longer be able to start or continue it, and every submission recorded so far will be voided — it won't count towards results or marks anymore. You'll then be able to edit the questions freely. This can't be undone, though you can re-share it again afterwards with fresh attempts.`,
      confirmText: 'Unshare',
      onConfirm: async () => {
        setConfirmModal(cm => ({ ...cm, loading: true }));
        try {
          const { data } = await api.post(`/assessment/teacher/assessments/${a.id}/unshare`);
          toast.success(data.message || 'Assessment unshared');
          loadAssessments();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to unshare assessment');
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
            <div className="flex items-center gap-2">
              {assessments.some(a => a.is_shared) && (
                <button onClick={() => setResultsPickerOpen(true)} className="btn-secondary text-sm flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" /> View Results
                </button>
              )}
              <button onClick={() => setFormModal({})} className="btn-primary assessment-cta text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Create New Assessment
              </button>
            </div>
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
            <>
              <AssessmentOverviewStrip assessments={assessments} />
              <div className="space-y-3 assessment-stagger">
                {assessments.map((a, i) => (
                  <AssessmentCard
                    key={a.id} a={a} i={i}
                    onQuestions={setQuestionsModal}
                    onShare={setShareModal}
                    onAddAttempt={setAddAttemptModal}
                    onEdit={handleEditClick}
                    onDelete={handleDelete}
                    onUnshare={handleUnshare}
                  />
                ))}
              </div>
            </>
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
      {resultsPickerOpen && (
        <ResultsPickerModal
          assessments={assessments}
          onClose={() => setResultsPickerOpen(false)}
          onSelectAssessment={(a) => { setResultsPickerOpen(false); setAttemptsModal(a); }}
          onSelectOverall={(g) => { setResultsPickerOpen(false); setOverallModal(g); }}
        />
      )}
      {attemptsModal && (
        <AssessmentAttemptsModal assessment={attemptsModal} onClose={() => setAttemptsModal(null)} />
      )}
      {overallModal && selectedCourse && selectedClass && (
        <OverallResultsModal
          courseId={selectedCourse.id}
          classId={selectedClass._id}
          type={overallModal.type}
          term={overallModal.term}
          academicYear={overallModal.academic_year}
          typeLabel={ASSESSMENT_TYPES.find(t => t.key === overallModal.type)?.label || overallModal.type}
          onClose={() => setOverallModal(null)}
        />
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