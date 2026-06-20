/**
 * TeacherAssessments.jsx
 *
 * CHANGES:
 * 1. Assessment title is auto-generated from type — no title field in form.
 * 2. Class picker first, then module filtered by class.
 * 3. Duplicate prevention: same course+type+term+year combo is blocked
 *    both at save time (toast) and visually (type button grayed + "Used").
 * 4. Marks modal now shows a marking-progress bar (X / Y students marked)
 *    at the top, and blocks Save Draft / Submit for Review with an error
 *    modal until every student has a mark entered.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/common/ConfirmModal';
import {
  Plus, Edit2, Trash2, X, BookOpen, FileText, Users,
  ChevronRight, Send, Save, Clock, CheckCircle, XCircle,
  AlertCircle, School, GraduationCap, RefreshCw,
} from 'lucide-react';

/* ─────────── Constants ─────────── */
const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [
  `${CURRENT_YEAR - 1}-${CURRENT_YEAR}`,
  `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR + 1}-${CURRENT_YEAR + 2}`,
];

const ASSESSMENT_TYPES = [
  { key: 'FA', label: 'Formative Assessment',    color: '#3b82f6', desc: 'Ongoing evaluation during the learning process' },
  { key: 'IA', label: 'Integrated Assessment',   color: '#10b981', desc: 'Holistic evaluation across multiple competencies' },
  { key: 'CA', label: 'Comprehensive Assessment',color: '#8b5cf6', desc: 'End-of-term summative evaluation' },
];

/* ─────────── Tiny helpers ─────────── */
function pctColor(pct) {
  if (pct == null) return '#374151';
  if (pct >= 70) return '#059669';
  if (pct >= 50) return '#b45309';
  return '#dc2626';
}

function TypeBadge({ type }) {
  const found = ASSESSMENT_TYPES.find(t => t.key === type);
  const color = found?.color || '#9ca3af';
  return (
    <span title={found?.label || type} style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
      background: color + '20', color, border: '1px solid ' + color + '40',
    }}>{type}</span>
  );
}

function StatusBadge({ status }) {
  const map = {
    draft:     { label: 'Draft',     color: '#9ca3af', Icon: Clock },
    submitted: { label: 'Submitted', color: '#f59e0b', Icon: Clock },
    approved:  { label: 'Approved',  color: '#10b981', Icon: CheckCircle },
    rejected:  { label: 'Rejected',  color: '#ef4444', Icon: XCircle },
  };
  const { label, color, Icon } = map[status] || map.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 7,
      background: color + '18', color, border: `1px solid ${color}40`,
    }}>
      <Icon size={11} /> {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function TeacherAssessments() {
  const { dark } = useTheme();
  const { user } = useAuth();

  const [courses, setCourses]         = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading]         = useState(false);

  /* ── Unique classes derived from teacher's courses ── */
  /* Supports both new class_ids[] array and legacy class_id field.  */
  const teacherClasses = (() => {
    const seen = new Set();
    const result = [];
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
        if (!seen.has(id)) {
          seen.add(id);
          result.push({ _id: id, name: cls.name || 'Class' });
        }
      });
    });
    return result;
  })();

  /* ── Modal state ── */
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    selectedClassId: '',
    course_id: '',
    type: '',
    term: '',
    academic_year: YEARS[1],
  });

  /* ── Marks modal state ── */
  const [marksModal, setMarksModal]   = useState(null);
  const [marksData, setMarksData]     = useState({});
  const [marksLoading, setMarksLoading]   = useState(false);
  const [marksSaving, setMarksSaving]     = useState(false);

  /* ── Confirm modal ── */
  const [confirmModal, setConfirmModal] = useState({ open: false });

  /* ── Styles ── */
  const card = {
    background: dark ? '#13161f' : '#fff',
    border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
    borderRadius: 16, padding: 20,
  };
  const inp = {
    width: '100%', padding: '9px 12px', borderRadius: 10, boxSizing: 'border-box',
    border: `1px solid ${dark ? '#2a3042' : '#d1d5db'}`,
    background: dark ? '#1a1f2e' : '#f9fafb',
    color: dark ? '#e2e8f0' : '#111827', fontSize: 13, outline: 'none',
  };
  const lbl = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
    color: dark ? '#7b839a' : '#6b7280', marginBottom: 4, display: 'block',
  };

  function openConfirm(opts) { setConfirmModal({ open: true, loading: false, ...opts }); }
  function closeConfirm()    { setConfirmModal(prev => ({ ...prev, open: false, loading: false })); }

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([
        api.get('/assessment/teacher/courses'),
        api.get('/assessment/teacher/assessments'),
      ]);
      setCourses(cRes.data.courses || []);
      setAssessments(aRes.data.assessments || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Modules filtered by selected class ── */
  /* Checks both new class_ids[] array and legacy class_id field.    */
  const classModules = form.selectedClassId
    ? courses.filter(c => {
        const target = String(form.selectedClassId);
        if (Array.isArray(c.class_ids) && c.class_ids.length > 0) {
          if (c.class_ids.some(x => String(x._id || x) === target)) return true;
        }
        const cid = c.class_id?._id || c.class_id;
        return cid && String(cid) === target;
      })
    : [];

  /* ── Duplicate checker: returns true if this type is already used ──
     Checks course_id + type + term + academic_year, excluding current editingId */
  function isTypeUsed(typeKey) {
    if (!form.course_id || !form.term || !form.academic_year) return false;
    return assessments.some(a =>
      String(a.course_id?._id || a.course_id) === String(form.course_id) &&
      a.type === typeKey &&
      a.term === form.term &&
      a.academic_year === form.academic_year &&
      (a._id || a.id) !== editingId
    );
  }

  /* ── Open create modal ── */
  function openCreate() {
    setEditingId(null);
    setForm({ selectedClassId: '', course_id: '', type: '', term: '', academic_year: YEARS[1] });
    setShowModal(true);
  }

  /* ── Open edit modal ── */
  function openEdit(a) {
    setEditingId(a._id || a.id);
    const course = courses.find(c => String(c._id || c.id) === String(a.course_id?._id || a.course_id));
    const classId = course?.class_id?._id || course?.class_id || '';
    setForm({
      selectedClassId: String(classId),
      course_id: String(a.course_id?._id || a.course_id || ''),
      type: a.type || '',
      term: a.term || '',
      academic_year: a.academic_year || YEARS[1],
    });
    setShowModal(true);
  }

  /* ── Save assessment ── */
  async function saveAssessment() {
    if (!form.course_id)      { toast.error('Please select a module'); return; }
    if (!form.type)           { toast.error('Please select an assessment type'); return; }
    if (!form.term)           { toast.error('Please select a term'); return; }
    if (!form.academic_year)  { toast.error('Please select an academic year'); return; }

    /* ── Duplicate guard ── */
    const duplicate = assessments.find(a =>
      String(a.course_id?._id || a.course_id) === String(form.course_id) &&
      a.type === form.type &&
      a.term === form.term &&
      a.academic_year === form.academic_year &&
      (a._id || a.id) !== editingId
    );
    if (duplicate) {
      toast.error(
        `A "${ASSESSMENT_TYPES.find(t => t.key === form.type)?.label || form.type}" already exists for this module in ${form.term} ${form.academic_year}.`
      );
      return;
    }

    const autoTitle = ASSESSMENT_TYPES.find(t => t.key === form.type)?.label || form.type;
    const payload = {
      title: autoTitle,
      course_id: form.course_id,
      type: form.type,
      term: form.term,
      academic_year: form.academic_year,
    };

    try {
      if (editingId) {
        await api.put('/assessment/teacher/assessments/' + editingId, payload);
        toast.success('Assessment updated');
      } else {
        await api.post('/assessment/teacher/assessments', payload);
        toast.success('Assessment created');
      }
      setShowModal(false);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.message || 'Error saving'); }
  }

  /* ── Delete assessment ── */
  function confirmDelete(a) {
    openConfirm({
      variant: 'danger',
      title: 'Delete Assessment',
      message: `Delete "${a.title}"? This cannot be undone.`,
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.delete('/assessment/teacher/assessments/' + (a._id || a.id));
          toast.success('Assessment deleted');
          fetchData();
          closeConfirm();
        } catch (e) {
          toast.error(e.response?.data?.message || 'Error deleting');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  }

  /* ── Open marks modal ── */
  async function openMarks(a) {
    setMarksLoading(true);
    setMarksModal(null);
    try {
      const res = await api.get('/assessment/teacher/assessments/' + (a._id || a.id) + '/marks');
      const { assessment, students, submission } = res.data;
      const initMarks = {};
      students.forEach(s => { initMarks[s.student_id] = s.marks ?? ''; });
      setMarksData(initMarks);
      setMarksModal({ assessment, students, submission });
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to load marks'); }
    finally { setMarksLoading(false); }
  }

  const marksLocked = marksModal?.submission?.status === 'submitted' || marksModal?.submission?.status === 'approved';

  /* ── Marking progress: how many of the loaded students currently have
     a non-blank mark entered in marksData. Drives the progress bar at
     the top of the marks modal and the save/submit guard below. ── */
  const markingProgress = (() => {
    const students = marksModal?.students || [];
    const total = students.length;
    const markedCount = students.filter(s => {
      const v = marksData[s.student_id];
      return v !== '' && v != null;
    }).length;
    const pct = total > 0 ? Math.round((markedCount / total) * 100) : 0;
    const missingStudents = students.filter(s => {
      const v = marksData[s.student_id];
      return v === '' || v == null;
    });
    return { total, markedCount, pct, missingStudents, complete: total > 0 && markedCount === total };
  })();

  /* ── Guard: blocks save/submit until every student has a mark.
     Shows an error modal (reusing ConfirmModal as a single-button alert)
     listing how many / which students are missing marks.
     Returns true if blocked (caller should stop), false if OK to proceed. ── */
  function blockIfIncomplete() {
    if (markingProgress.complete) return false;
    const names = markingProgress.missingStudents.map(s => s.name);
    const preview = names.slice(0, 6).join(', ') + (names.length > 6 ? `, and ${names.length - 6} more` : '');
    openConfirm({
      variant: 'danger',
      title: 'Marks Incomplete',
      message: `${markingProgress.missingStudents.length} of ${markingProgress.total} student${markingProgress.total === 1 ? '' : 's'} still need marks entered before you can save or submit: ${preview}.`,
      confirmText: 'Got it',
      onConfirm: closeConfirm,
    });
    return true;
  }

  /* ── Save marks as draft ── */
  async function saveDraft() {
    if (blockIfIncomplete()) return;
    setMarksSaving(true);
    try {
      const marks = Object.entries(marksData).map(([student_id, marks]) => ({
        student_id, marks: marks === '' ? null : Number(marks),
      }));
      await api.post('/assessment/teacher/assessments/' + marksModal.assessment._id + '/marks', { marks });
      toast.success('Marks saved as draft');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.message || 'Error saving'); }
    finally { setMarksSaving(false); }
  }

  /* ── Submit marks ── */
  async function submitMarks() {
    if (blockIfIncomplete()) return;
    openConfirm({
      variant: 'warning',
      title: 'Submit Marks for Review',
      message: 'Once submitted, marks will be locked until an admin reviews them. Are you sure?',
      confirmText: 'Submit for Review',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const marks = Object.entries(marksData).map(([student_id, marks]) => ({
            student_id, marks: marks === '' ? null : Number(marks),
          }));
          await api.post('/assessment/teacher/assessments/' + marksModal.assessment._id + '/submit', { marks });
          toast.success('Marks submitted for review');
          closeConfirm();
          setMarksModal(null);
          fetchData();
        } catch (e) {
          toast.error(e.response?.data?.message || 'Error submitting');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>My Assessments</h1>
            <p style={{ margin: 0, fontSize: 13, color: dark ? '#7b839a' : '#6b7280' }}>Create and manage assessments for your assigned modules</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#7b839a' : '#6b7280', fontSize: 13, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,58,107,0.35)' }}>
            <Plus size={14} /> New Assessment
          </button>
        </div>
      </div>

      {/* ── Stats pills ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Total',     val: assessments.length,                                              color: '#1a3a6b' },
          { label: 'Draft',     val: assessments.filter(a => a.submission_status === 'draft').length,     color: '#9ca3af' },
          { label: 'Submitted', val: assessments.filter(a => a.submission_status === 'submitted').length, color: '#f59e0b' },
          { label: 'Approved',  val: assessments.filter(a => a.submission_status === 'approved').length,  color: '#10b981' },
          { label: 'Rejected',  val: assessments.filter(a => a.submission_status === 'rejected').length,  color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ padding: '7px 16px', borderRadius: 10, background: s.color + '15', border: `1px solid ${s.color}30`, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: dark ? '#7b839a' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Assessment list ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #1a3a6b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: dark ? '#7b839a' : '#9ca3af' }}>Loading…</p>
        </div>
      ) : assessments.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><FileText size={28} color="#fff" /></div>
          <p style={{ color: dark ? '#e8ecf4' : '#111827', fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>No Assessments Yet</p>
          <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: '0 0 20px' }}>Create your first assessment to start recording marks.</p>
          <button onClick={openCreate} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />New Assessment
          </button>
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Assessment', 'Module', 'Type', 'Term', 'Year', 'Progress', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assessments.map((a, i) => {
                  const isLocked = a.submission_status === 'submitted' || a.submission_status === 'approved';
                  const progressPct = a.student_count > 0 ? Math.round((a.marked_count / a.student_count) * 100) : 0;
                  return (
                    <tr key={a._id || a.id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'), borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}` }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: dark ? '#e8ecf4' : '#111827' }}>{a.title}</div>
                        {a.review_note && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <AlertCircle size={10} color="#ef4444" />
                            <span style={{ fontSize: 11, color: '#ef4444' }}>{a.review_note}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>
                        <div>{a.course_id?.name || '—'}</div>
                        {a.course_id?.class_id && <div style={{ fontSize: 10, color: dark ? '#7b839a' : '#9ca3af', marginTop: 2 }}>Class assigned</div>}
                      </td>
                      <td style={{ padding: '11px 14px' }}><TypeBadge type={a.type} /></td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.term}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.academic_year}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: dark ? '#2a3042' : '#e5e7eb', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: progressPct + '%', background: progressPct === 100 ? '#10b981' : '#1a3a6b', borderRadius: 3, transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: dark ? '#7b839a' : '#6b7280', whiteSpace: 'nowrap' }}>{a.marked_count}/{a.student_count}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px' }}><StatusBadge status={a.submission_status} /></td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => openMarks(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <Users size={11} /> Marks
                          </button>
                          {!isLocked && (
                            <>
                              <button onClick={() => openEdit(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                <Edit2 size={11} /> Edit
                              </button>
                              <button onClick={() => confirmDelete(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                <Trash2 size={11} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          CREATE / EDIT ASSESSMENT MODAL
          Steps: (1) class → (2) module → (3) type → (4) term/year
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ width: 540, borderRadius: 22, background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`, padding: 30, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>
                  {editingId ? 'Edit Assessment' : 'New Assessment'}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>
                  {editingId ? 'Update assessment details' : 'Select a class and module, then configure the assessment'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: dark ? '#1e2130' : '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color={dark ? '#94a3b8' : '#6b7280'} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* STEP 1: Class picker */}
              <div>
                <label style={lbl}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <School size={11} /> Step 1 — Select Class *
                  </span>
                </label>
                {teacherClasses.length === 0 ? (
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: dark ? '#1a1f2e' : '#fef3c7', border: `1px solid ${dark ? '#2a3042' : '#fcd34d'}`, fontSize: 13, color: dark ? '#f59e0b' : '#92400e' }}>
                    No classes found. Ask your admin to assign modules to you.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                    {teacherClasses.map(cls => {
                      const selected = form.selectedClassId === cls._id;
                      return (
                        <button
                          key={cls._id}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, selectedClassId: cls._id, course_id: '', type: '' }))}
                          style={{
                            padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                            border: `2px solid ${selected ? '#1a3a6b' : (dark ? '#2a3042' : '#e5e7eb')}`,
                            background: selected ? 'rgba(26,58,107,0.1)' : 'transparent',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <School size={13} color={selected ? '#1a3a6b' : (dark ? '#7b839a' : '#9ca3af')} />
                            <span style={{ fontSize: 12, fontWeight: selected ? 800 : 500, color: selected ? '#1a3a6b' : (dark ? '#e2e8f0' : '#374151') }}>{cls.name}</span>
                          </div>
                          {selected && <div style={{ marginTop: 4, fontSize: 10, color: '#1a3a6b', fontWeight: 700 }}>✓ Selected</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 2: Module picker */}
              {form.selectedClassId && (
                <div style={{ animation: 'fadeUp 0.2s ease' }}>
                  <label style={lbl}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <BookOpen size={11} /> Step 2 — Select Module *
                    </span>
                  </label>
                  {classModules.length === 0 ? (
                    <div style={{ padding: '12px 14px', borderRadius: 10, background: dark ? '#1a1f2e' : '#f9fafb', border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, fontSize: 13, color: dark ? '#7b839a' : '#6b7280' }}>
                      No modules found for this class.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {classModules.map(c => {
                        const selected = form.course_id === String(c._id || c.id);
                        return (
                          <button
                            key={c._id || c.id}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, course_id: String(c._id || c.id), type: '' }))}
                            style={{
                              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                              border: `2px solid ${selected ? '#1a3a6b' : (dark ? '#2a3042' : '#e5e7eb')}`,
                              background: selected ? 'rgba(26,58,107,0.08)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              transition: 'all 0.15s',
                            }}
                          >
                            <div>
                              {c.code && <div style={{ fontSize: 10, fontWeight: 800, color: selected ? '#1a3a6b' : (dark ? '#7b839a' : '#9ca3af'), letterSpacing: '0.07em', marginBottom: 2 }}>{c.code}</div>}
                              <div style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? '#1a3a6b' : (dark ? '#e2e8f0' : '#374151') }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af', marginTop: 2 }}>
                                {c.category} · Max: {c.total_marks || 100} marks
                              </div>
                            </div>
                            {selected && <CheckCircle size={16} color="#1a3a6b" style={{ flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Term + Year (needed before type so duplicate check works) */}
              {form.course_id && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, animation: 'fadeUp 0.2s ease' }}>
                  <div>
                    <label style={lbl}>Step 3 — Term *</label>
                    <select value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value, type: '' }))} style={inp}>
                      <option value="">Select term…</option>
                      {TERMS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Academic Year *</label>
                    <select value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value, type: '' }))} style={inp}>
                      {YEARS.map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 4: Assessment type — with duplicate guard */}
              {form.course_id && form.term && (
                <div style={{ animation: 'fadeUp 0.2s ease' }}>
                  <label style={lbl}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FileText size={11} /> Step 4 — Assessment Type *
                      <span style={{ fontSize: 10, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(sets title automatically)</span>
                    </span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ASSESSMENT_TYPES.map(t => {
                      const selected   = form.type === t.key;
                      const alreadyUsed = isTypeUsed(t.key);
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => !alreadyUsed && setForm(f => ({ ...f, type: t.key }))}
                          disabled={alreadyUsed}
                          style={{
                            padding: '11px 14px', borderRadius: 10,
                            cursor: alreadyUsed ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            border: `2px solid ${selected ? t.color : (dark ? '#2a3042' : '#e5e7eb')}`,
                            background: selected ? t.color + '12' : alreadyUsed ? (dark ? '#0f1117' : '#f3f4f6') : 'transparent',
                            display: 'flex', alignItems: 'center', gap: 12,
                            opacity: alreadyUsed ? 0.55 : 1,
                            transition: 'all 0.15s',
                          }}
                        >
                          <span style={{ minWidth: 30, textAlign: 'center', fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 6, background: t.color + '20', color: t.color, border: `1px solid ${t.color}40`, flexShrink: 0 }}>{t.key}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: selected ? 800 : 500, color: selected ? t.color : (dark ? '#e2e8f0' : '#374151') }}>{t.label}</div>
                            <div style={{ fontSize: 11, color: alreadyUsed ? '#ef4444' : (dark ? '#7b839a' : '#9ca3af'), marginTop: 1 }}>
                              {alreadyUsed
                                ? `⚠ Already created for this module · ${form.term} · ${form.academic_year}`
                                : t.desc}
                            </div>
                          </div>
                          {selected    && <CheckCircle size={16} color={t.color} style={{ flexShrink: 0 }} />}
                          {alreadyUsed && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', flexShrink: 0, whiteSpace: 'nowrap' }}>Used</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Auto-title preview */}
                  {form.type && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 9, background: dark ? '#1a1f2e' : '#f0f9ff', border: `1px solid ${dark ? '#2a3042' : '#bae6fd'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={12} color="#0369a1" />
                      <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#0369a1' }}>
                        Title will be: <strong style={{ color: dark ? '#e2e8f0' : '#0c4a6e' }}>{ASSESSMENT_TYPES.find(t => t.key === form.type)?.label}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#94a3b8' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={saveAssessment}
                disabled={!form.course_id || !form.type || !form.term}
                style={{
                  flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                  background: (!form.course_id || !form.type || !form.term)
                    ? (dark ? '#2a3042' : '#e5e7eb')
                    : 'linear-gradient(135deg,#1a3a6b,#1565c0)',
                  color: (!form.course_id || !form.type || !form.term)
                    ? (dark ? '#4a5568' : '#9ca3af')
                    : '#fff',
                  fontSize: 13, fontWeight: 700,
                  cursor: (!form.course_id || !form.type || !form.term) ? 'not-allowed' : 'pointer',
                  boxShadow: (!form.course_id || !form.type || !form.term) ? 'none' : '0 4px 14px rgba(26,58,107,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                {editingId ? 'Save Changes' : 'Create Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MARKS MODAL
      ══════════════════════════════════════════════════════════ */}
      {(marksModal || marksLoading) && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setMarksModal(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ width: 700, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: 20, background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`, padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
            {marksLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ width: 36, height: 36, border: '3px solid #1a3a6b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: dark ? '#7b839a' : '#9ca3af' }}>Loading marks…</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>{marksModal.assessment?.title}</h3>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Module: <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{marksModal.assessment?.course_id?.name}</strong></span>
                      <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{marksModal.assessment?.term} · {marksModal.assessment?.academic_year}</span>
                      <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Max: <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{marksModal.assessment?.max_marks}</strong></span>
                      <StatusBadge status={marksModal.submission?.status} />
                    </div>
                    {marksModal.submission?.review_note && (
                      <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 12, color: '#ef4444' }}><strong>Admin note:</strong> {marksModal.submission.review_note}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setMarksModal(null)} style={{ border: 'none', background: dark ? '#1e2130' : '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={16} color={dark ? '#94a3b8' : '#6b7280'} />
                  </button>
                </div>

                {/* ── Marking progress bar ── */}
                {!marksLocked && (
                  <div style={{
                    marginBottom: 16, padding: '12px 14px', borderRadius: 12,
                    background: markingProgress.complete ? 'rgba(16,185,129,0.07)' : (dark ? '#1a1f2e' : '#f9fafb'),
                    border: `1px solid ${markingProgress.complete ? 'rgba(16,185,129,0.3)' : (dark ? '#2a3042' : '#e5e7eb')}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: markingProgress.complete ? '#10b981' : (dark ? '#e2e8f0' : '#374151') }}>
                        {markingProgress.complete ? <CheckCircle size={13} /> : <Users size={13} />}
                        Marking Progress
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: markingProgress.complete ? '#10b981' : (dark ? '#7b839a' : '#6b7280') }}>
                        {markingProgress.markedCount}/{markingProgress.total} students · {markingProgress.pct}%
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: dark ? '#2a3042' : '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: markingProgress.pct + '%',
                        background: markingProgress.complete ? '#10b981' : '#1a3a6b',
                        borderRadius: 4, transition: 'width 0.4s',
                      }} />
                    </div>
                    {!markingProgress.complete && (
                      <div style={{ marginTop: 8, fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>
                        {markingProgress.total - markingProgress.markedCount} student{markingProgress.total - markingProgress.markedCount === 1 ? '' : 's'} still need a mark before you can save or submit.
                      </div>
                    )}
                  </div>
                )}

                {marksLocked && (
                  <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={14} color="#f59e0b" />
                    <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                      Marks are locked — this assessment has been {marksModal.submission?.status}. Contact admin to unlock.
                    </span>
                  </div>
                )}

                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#', 'Student', 'Marks', `Out of ${marksModal.assessment?.max_marks}`, '%'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textAlign: 'left', borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(marksModal.students || []).map((s, i) => {
                        const raw = marksData[s.student_id];
                        const num = raw === '' || raw == null ? null : Number(raw);
                        const max = marksModal.assessment?.max_marks || 100;
                        const pct = num != null ? Math.min(Math.round((num / max) * 100), 100) : null;
                        const missing = raw === '' || raw == null;
                        return (
                          <tr key={s.student_id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'), borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}` }}>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{i + 1}</td>
                            <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: dark ? '#e2e8f0' : '#374151' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {s.name}
                                {!marksLocked && missing && (
                                  <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '1px 6px', borderRadius: 5 }}>Missing</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <input
                                type="number"
                                min={0}
                                max={max}
                                value={raw ?? ''}
                                disabled={marksLocked}
                                onChange={e => setMarksData(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                                style={{
                                  width: 80, padding: '6px 10px', borderRadius: 8,
                                  border: `1px solid ${num != null && num > max ? '#ef4444' : (missing && !marksLocked ? '#f59e0b' : (dark ? '#2a3042' : '#d1d5db'))}`,
                                  background: marksLocked ? (dark ? '#0f1117' : '#f3f4f6') : (dark ? '#1a1f2e' : '#fff'),
                                  color: dark ? '#e2e8f0' : '#111827', fontSize: 13, outline: 'none',
                                  opacity: marksLocked ? 0.6 : 1,
                                }}
                              />
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{max}</td>
                            <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: pctColor(pct) }}>{pct != null ? pct + '%' : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {!marksLocked && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={saveDraft} disabled={marksSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <Save size={14} /> {marksSaving ? 'Saving…' : 'Save Draft'}
                    </button>
                    <button onClick={submitMarks} disabled={marksSaving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(26,58,107,0.35)' }}>
                      <Send size={14} /> Submit for Review
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmModal.open}
        onClose={closeConfirm}
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