import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/common/ConfirmModal';
import {
  BookOpen, Plus, Edit2, Trash2, BarChart2, X, Save,
  ClipboardList, Award, Printer, ArrowLeft, Users, Check,
  AlertCircle, Clock, CheckCircle, TrendingUp, Hash, Target,
  ChevronRight, Filter, Lock,
} from 'lucide-react';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [`${CURRENT_YEAR-1}-${CURRENT_YEAR}`, `${CURRENT_YEAR}-${CURRENT_YEAR+1}`];

function getGrade(obtained, max) {
  const pct = (obtained / max) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}
function pctColor(pct) {
  if (pct == null) return '#9ca3af';
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#3b82f6';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

function TypeBadge({ type }) {
  const color = type === 'FA' ? '#3b82f6' : '#8b5cf6';
  const label = type === 'FA' ? 'Formative' : 'Continuous';
  return <span title={label} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: color + '20', color, border: '1px solid ' + color + '40' }}>{type}</span>;
}
function GradeBadge({ grade }) {
  const color = grade === 'A+' || grade === 'A' ? '#10b981' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#f59e0b' : grade === 'D' ? '#f97316' : grade === 'F' ? '#ef4444' : '#9ca3af';
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: color + '20', color }}>{grade}</span>;
}

function SubmissionStatusBadge({ status }) {
  const info = {
    draft:     { label: 'Draft',     color: '#9ca3af' },
    submitted: { label: 'Submitted', color: '#f59e0b' },
    approved:  { label: 'Approved',  color: '#10b981' },
    rejected:  { label: 'Rejected',  color: '#ef4444' },
  }[status] || { label: status, color: '#9ca3af' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: info.color + '18', color: info.color, border: `1px solid ${info.color}40` }}>
      {info.label}
    </span>
  );
}

// Progress indicator with color-coded status
function ProgressIndicator({ marked, total, dark }) {
  if (total === 0) return <span style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>No students</span>;
  const pct = Math.round((marked / total) * 100);
  const isComplete = marked === total;
  const hasNone = marked === 0;
  const color = isComplete ? '#10b981' : hasNone ? '#ef4444' : '#f59e0b';
  const bg = isComplete ? '#f0fdf4' : hasNone ? '#fef2f2' : '#fffbeb';
  const border = isComplete ? '#bbf7d0' : hasNone ? '#fecaca' : '#fde68a';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: dark ? '#2a3042' : '#e5e7eb', overflow: 'hidden', minWidth: 60 }}>
        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: bg, color, border: '1px solid ' + border, whiteSpace: 'nowrap' }}>
        {isComplete ? <><Check size={9} style={{ display: 'inline', marginRight: 3 }} />Done</> : `${marked}/${total}`}
      </span>
    </div>
  );
}

export default function TeacherAssessments() {
  const { dark } = useTheme();

  const [view, setView] = useState('list');
  const [courses, setCourses] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [marksData, setMarksData] = useState(null);
  const [marksEdits, setMarksEdits] = useState({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [submittingMarks, setSubmittingMarks] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [form, setForm] = useState({ title: '', course_id: '', type: 'FA', term: 'Term 1', academic_year: YEARS[1], max_marks: 100 });

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, variant: 'warning', title: '', message: '', onConfirm: null, loading: false, confirmText: 'Confirm' });

  const card = { background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`, borderRadius: 16, padding: 20 };
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#d1d5db'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#111827', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: dark ? '#7b839a' : '#6b7280', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' };
  const th = { padding: '10px 14px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' };
  const td = { padding: '10px 14px', borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}`, color: dark ? '#e2e8f0' : '#374151', fontSize: 13 };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([
        api.get('/assessment/teacher/courses'),
        api.get('/assessment/teacher/assessments', { params: selectedCourse ? { course_id: selectedCourse } : {} }),
      ]);
      setCourses(cRes.data.courses || []);
      setAssessments(aRes.data.assessments || []);
    } catch (e) { toast.error('Failed to load assessments'); }
    finally { setLoading(false); }
  }, [selectedCourse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openConfirm(opts) {
    setConfirmModal({ open: true, loading: false, confirmText: 'Confirm', cancelText: 'Cancel', ...opts });
  }
  function closeConfirm() {
    setConfirmModal(prev => ({ ...prev, open: false, loading: false }));
  }

  function openCreate() {
    setEditingAssessment(null);
    const firstCourse = courses[0];
    setForm({ title: 'FA', course_id: firstCourse?._id || '', type: 'FA', term: 'Term 1', academic_year: YEARS[1], max_marks: firstCourse?.total_marks || 100 });
    setShowModal(true);
  }
  function openEdit(a) {
    setEditingAssessment(a);
    setForm({ title: a.title, course_id: a.course_id?._id || a.course_id, type: a.type, term: a.term, academic_year: a.academic_year, max_marks: a.max_marks });
    setShowModal(true);
  }

  function handleCourseSelect(courseId) {
    const c = courses.find(c => c._id === courseId);
    setForm(f => ({ ...f, course_id: courseId, max_marks: c?.total_marks || f.max_marks }));
  }

  async function saveAssessment() {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    if (!form.course_id) { toast.error('Select a course'); return; }

    if (editingAssessment) {
      openConfirm({
        variant: 'info',
        title: 'Save Changes',
        message: 'Update this assessment with the new details?',
        confirmText: 'Save Changes',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          try {
            await api.put('/assessment/teacher/assessments/' + editingAssessment._id, form);
            toast.success('Assessment updated');
            setShowModal(false);
            fetchData();
            closeConfirm();
          } catch (e) {
            toast.error(e.response?.data?.message || 'Error');
            setConfirmModal(prev => ({ ...prev, loading: false }));
          }
        },
      });
    } else {
      openConfirm({
        variant: 'info',
        title: 'Create Assessment',
        message: `Create a new ${form.title} assessment for this course?`,
        confirmText: 'Create Assessment',
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          try {
            await api.post('/assessment/teacher/assessments', form);
            toast.success('Assessment created');
            setShowModal(false);
            fetchData();
            closeConfirm();
          } catch (e) {
            toast.error(e.response?.data?.message || 'Error');
            setConfirmModal(prev => ({ ...prev, loading: false }));
          }
        },
      });
    }
  }

  async function deleteAssessment(id) {
    openConfirm({
      variant: 'danger',
      title: 'Delete Assessment',
      message: 'This will permanently delete the assessment and all its recorded marks. This action cannot be undone.',
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.delete('/assessment/teacher/assessments/' + id);
          toast.success('Assessment deleted');
          fetchData();
          closeConfirm();
        } catch (e) {
          toast.error('Error deleting');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  }

  async function openMarks(assessment) {
    setActiveAssessment(assessment); setView('marks');
    try {
      const res = await api.get('/assessment/teacher/assessments/' + assessment._id + '/marks');
      setMarksData(res.data);
      const edits = {};
      res.data.students.forEach(s => { edits[s.student_id] = { marks: s.marks ?? '' }; });
      setMarksEdits(edits);
    } catch (e) { toast.error('Failed to load marks'); }
  }

  async function saveMarks() {
    // Validate marks before confirming
    const courseMaxMarks = marksData?.assessment?.course_id?.total_marks || activeAssessment?.max_marks || 100;
    const overLimit = Object.entries(marksEdits).filter(([, v]) => v.marks !== '' && v.marks != null && Number(v.marks) > courseMaxMarks);
    if (overLimit.length > 0) {
      toast.error(`${overLimit.length} mark(s) exceed the maximum of ${courseMaxMarks}. Please correct before saving.`);
      return;
    }

    openConfirm({
      variant: 'save',
      title: 'Save Marks Draft',
      message: 'Marks will be saved as a draft. You can continue editing or submit for admin review later.',
      confirmText: 'Save Draft',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const marks = Object.entries(marksEdits).map(([student_id, v]) => ({
            student_id,
            marks: v.marks !== '' ? Number(v.marks) : null,
          }));
          await api.post('/assessment/teacher/assessments/' + activeAssessment._id + '/marks', { marks });
          toast.success('Marks saved as draft');
          fetchData();
          const res = await api.get('/assessment/teacher/assessments/' + activeAssessment._id + '/marks');
          setMarksData(res.data);
          closeConfirm();
        } catch (e) {
          toast.error(e.response?.data?.message || 'Error saving marks');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  }

  async function submitMarks() {
    // Validate marks before confirming
    const courseMaxMarks = marksData?.assessment?.course_id?.total_marks || activeAssessment?.max_marks || 100;
    const overLimit = Object.entries(marksEdits).filter(([, v]) => v.marks !== '' && v.marks != null && Number(v.marks) > courseMaxMarks);
    if (overLimit.length > 0) {
      toast.error(`${overLimit.length} mark(s) exceed the maximum of ${courseMaxMarks}. Please correct before submitting.`);
      return;
    }

    openConfirm({
      variant: 'submit',
      title: 'Submit Marks for Review',
      message: 'Marks will be submitted to the admin for approval. You will lose edit access until the admin approves or rejects this submission.',
      confirmText: 'Submit for Review',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const marks = Object.entries(marksEdits).map(([student_id, v]) => ({
            student_id,
            marks: v.marks !== '' ? Number(v.marks) : null,
          }));
          await api.post('/assessment/teacher/assessments/' + activeAssessment._id + '/submit', { marks });
          toast.success('Marks submitted for review');
          fetchData();
          const res = await api.get('/assessment/teacher/assessments/' + activeAssessment._id + '/marks');
          setMarksData(res.data);
          closeConfirm();
        } catch (e) {
          toast.error(e.response?.data?.message || 'Error submitting marks');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  }

  async function openReport(assessment) {
    setActiveAssessment(assessment); setView('report');
    setReportLoading(true); setReportData(null);
    try {
      const res = await api.get('/assessment/teacher/reports/' + assessment._id);
      setReportData(res.data);
    } catch (e) { toast.error('Failed to load report'); }
    finally { setReportLoading(false); }
  }

  /* ── MARKS VIEW ── */
  if (view === 'marks' && marksData) {
    const enteredCount = Object.values(marksEdits).filter(v => v.marks !== '' && v.marks != null).length;
    const totalStudents = marksData.students.length;
    const completePct = totalStudents > 0 ? Math.round((enteredCount / totalStudents) * 100) : 0;
    const courseMaxMarks = marksData.assessment?.course_id?.total_marks || activeAssessment?.course_id?.total_marks || activeAssessment?.max_marks || 100;
    const subStatus = marksData.submission?.status || 'draft';
    const isLocked = subStatus === 'submitted' || subStatus === 'approved';

    // Count marks exceeding the max
    const overLimitCount = Object.values(marksEdits).filter(v => v.marks !== '' && v.marks != null && Number(v.marks) > courseMaxMarks).length;

    const statusInfo = {
      draft:     { label: 'Draft — editable',          color: '#9ca3af', bg: '#9ca3af15' },
      submitted: { label: 'Submitted — pending review', color: '#f59e0b', bg: '#f59e0b15' },
      approved:  { label: 'Approved',                   color: '#10b981', bg: '#10b98115' },
      rejected:  { label: 'Rejected — editable',        color: '#ef4444', bg: '#ef444415' },
    }[subStatus] || { label: subStatus, color: '#9ca3af', bg: '#9ca3af15' };

    return (
      <>
      <div>
        <style>{`.mark-input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => { setView('list'); setMarksData(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: dark ? '#1a1f2e' : '#f3f4f6', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', color: dark ? '#94a3b8' : '#6b7280', fontSize: 13, fontWeight: 500 }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', fontFamily: "'Sora',sans-serif" }}>{activeAssessment?.title}</h2>
            <p style={{ margin: 0, fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>
              {activeAssessment?.course_id?.name} · {activeAssessment?.term} · {activeAssessment?.academic_year}
            </p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: statusInfo.bg, color: statusInfo.color, border: `1px solid ${statusInfo.color}40` }}>
            {statusInfo.label}
          </span>
          {!isLocked && (
            <>
              <button onClick={saveMarks} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}>
                <Save size={14} />Save Draft
              </button>
              <button onClick={submitMarks} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
              }}>
                <CheckCircle size={14} />Submit for Review
              </button>
            </>
          )}
        </div>

        {subStatus === 'rejected' && marksData.submission?.review_note && (
          <div style={{ ...card, marginBottom: 16, padding: '12px 18px', borderColor: '#ef444440', background: dark ? '#1a1112' : '#fef2f2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <AlertCircle size={14} color="#ef4444" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Rejected by admin — please review and resubmit</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{marksData.submission.review_note}</p>
          </div>
        )}

        {isLocked && (
          <div style={{ ...card, marginBottom: 16, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={14} color={statusInfo.color} />
            <span style={{ fontSize: 12, color: dark ? '#94a3b8' : '#6b7280' }}>
              {subStatus === 'approved'
                ? 'These marks have been approved and are reflected in reports.'
                : 'These marks are locked while pending admin review. The admin can reject this submission to give you edit access again.'}
            </span>
          </div>
        )}

        {/* Over-limit warning banner */}
        {!isLocked && overLimitCount > 0 && (
          <div style={{ ...card, marginBottom: 16, padding: '12px 18px', borderColor: '#ef444440', background: dark ? '#1a1112' : '#fef2f2', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} color="#ef4444" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
              {overLimitCount} student mark{overLimitCount > 1 ? 's exceed' : ' exceeds'} the maximum of <strong>{courseMaxMarks}</strong>. Correct the highlighted entries before saving.
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div style={{ ...card, marginBottom: 16, padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {completePct === 100
                ? <CheckCircle size={16} color="#10b981" />
                : enteredCount === 0
                  ? <AlertCircle size={16} color="#ef4444" />
                  : <Clock size={16} color="#f59e0b" />
              }
              <span style={{ fontSize: 13, fontWeight: 600, color: dark ? '#e8ecf4' : '#111827' }}>
                Recording Progress: {enteredCount} of {totalStudents} students
              </span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: completePct === 100 ? '#10b981' : completePct > 0 ? '#f59e0b' : '#ef4444' }}>{completePct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: dark ? '#2a3042' : '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: completePct + '%', background: completePct === 100 ? '#10b981' : completePct > 0 ? '#f59e0b' : '#ef4444', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Lock size={11} color={dark ? '#7b839a' : '#9ca3af'} />
              <span style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>
                Module weight (admin-set): <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{courseMaxMarks}</strong>
              </span>
            </div>
            <TypeBadge type={activeAssessment?.type} />
          </div>
        </div>

        {/* Marks table */}
        <div style={{ ...card }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36 }}>#</th>
                  <th style={th}>Student</th>
                  <th style={{ ...th, width: 160 }}>Marks (/{courseMaxMarks})</th>
                  <th style={{ ...th, width: 100 }}>%</th>
                  <th style={{ ...th, width: 80 }}>Grade</th>
                  <th style={{ ...th, width: 80 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                  {marksData.students.map((s, i) => {
                    const edit = marksEdits[s.student_id] || {};
                    const pct = edit.marks !== '' && edit.marks != null ? Math.round((Number(edit.marks) / courseMaxMarks) * 100) : null;
                    const grade = pct != null ? getGrade(Number(edit.marks), courseMaxMarks) : null;
                    const hasMarks = edit.marks !== '' && edit.marks != null;
                    const isOverLimit = hasMarks && Number(edit.marks) > courseMaxMarks;

                    return (
                      <tr key={s.student_id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#f9fafb40') }}>
                        <td style={{ ...td, color: dark ? '#7b839a' : '#9ca3af' }}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `hsl(${(i * 47) % 360},65%,55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {s.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                              <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>{s.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={td}>
                          <div>
                            <input
                              className="mark-input"
                              type="number" min={0} max={courseMaxMarks}
                              value={edit.marks ?? ''}
                              disabled={isLocked}
                              onChange={e => setMarksEdits(prev => ({ ...prev, [s.student_id]: { marks: e.target.value } }))}
                              placeholder="—"
                              style={{
                                ...inputStyle, width: 80, textAlign: 'center', padding: '7px 10px', borderRadius: 8, fontWeight: 600, transition: 'all 0.15s',
                                opacity: isLocked ? 0.6 : 1,
                                cursor: isLocked ? 'not-allowed' : 'text',
                                borderColor: isOverLimit ? '#ef4444' : undefined,
                                boxShadow: isOverLimit ? '0 0 0 3px rgba(239,68,68,0.18)' : undefined,
                                color: isOverLimit ? '#ef4444' : undefined,
                              }}
                            />
                            {isOverLimit && (
                              <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, marginTop: 3 }}>
                                Max: {courseMaxMarks}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ ...td, fontWeight: 700, color: isOverLimit ? '#ef4444' : pctColor(pct) }}>{pct != null ? (isOverLimit ? '>' + courseMaxMarks + '!' : pct + '%') : '—'}</td>
                        <td style={td}>{grade && !isOverLimit ? <GradeBadge grade={grade} /> : (isOverLimit ? <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>Error</span> : <span style={{ color: dark ? '#7b839a' : '#9ca3af', fontSize: 12 }}>—</span>)}</td>
                        <td style={td}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: isOverLimit ? '#ef444420' : (hasMarks ? '#10b98120' : '#ef444420'), color: isOverLimit ? '#ef4444' : (hasMarks ? '#10b981' : '#ef4444'), border: `1px solid ${isOverLimit ? '#ef444440' : (hasMarks ? '#10b98140' : '#ef444440')}` }}>
                            {isOverLimit ? 'Over Limit' : (hasMarks ? 'Entered' : 'Pending')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {marksData.students.length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: dark ? '#7b839a' : '#9ca3af', padding: 40 }}>No students in this class yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ConfirmModal
        open={confirmModal.open}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        loading={confirmModal.loading}
        variant={confirmModal.variant}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText || 'Cancel'}
      />
      </>
    );
  }

  /* ── REPORT VIEW ── */
  if (view === 'report') {
    return (
      <div>
        <style>{`@media print { .no-print { display: none !important; } }`}</style>
        <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          <button onClick={() => { setView('list'); setReportData(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: dark ? '#1a1f2e' : '#f3f4f6', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', color: dark ? '#94a3b8' : '#6b7280', fontSize: 13, fontWeight: 500 }}>
            <ArrowLeft size={14} /> Back
          </button>
          {reportData && (
            <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Printer size={14} /> Print
            </button>
          )}
          {reportData && (
            <div style={{ display: 'flex', gap: 14, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {[['Students', reportData.students?.length || 0, '#6366f1'],
                ['Class Avg', reportData.students?.filter(s => s.percentage != null).length > 0 ? Math.round(reportData.students.filter(s => s.percentage != null).reduce((a, s) => a + s.percentage, 0) / reportData.students.filter(s => s.percentage != null).length) + '%' : '—', '#10b981'],
              ].map(([k, v, c]) => (
                <div key={k} style={{ padding: '6px 14px', borderRadius: 10, background: c + '18', border: '1px solid ' + c + '33', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: dark ? '#7b839a' : '#9ca3af', fontWeight: 600 }}>{k}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {reportLoading && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: dark ? '#7b839a' : '#9ca3af' }}>Loading report…</p>
          </div>
        )}

        {reportData && (
          <div style={{ ...card }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', fontFamily: "'Sora',sans-serif" }}>{reportData.assessment?.title}</h2>
                <TypeBadge type={reportData.assessment?.type} />
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[['Course', reportData.assessment?.course_id?.name], ['Term', reportData.assessment?.term], ['Year', reportData.assessment?.academic_year]].map(([k, v]) => v && (
                  <span key={k} style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{k}: <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{v}</strong></span>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['#', 'Student', 'Marks', 'Max', '%', 'Grade', 'Rank'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(reportData.students || []).sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)).map((s, i) => (
                    <tr key={s.student_id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#f9fafb40') }}>
                      <td style={{ ...td, color: dark ? '#7b839a' : '#9ca3af' }}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <div>{s.student_name}</div>
                        <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>{s.student_email}</div>
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: pctColor(s.percentage) }}>{s.marks_obtained ?? '—'}</td>
                      <td style={td}>{s.max_marks}</td>
                      <td style={{ ...td, fontWeight: 700, color: pctColor(s.percentage) }}>{s.percentage != null ? s.percentage + '%' : '—'}</td>
                      <td style={td}><GradeBadge grade={s.grade} /></td>
                      <td style={td}>{s.rank ? <span style={{ fontWeight: 700, color: s.rank === 1 ? '#f59e0b' : (dark ? '#e2e8f0' : '#374151') }}>#{s.rank}</span> : '—'}</td>
                    </tr>
                  ))}
                  {(!reportData.students || reportData.students.length === 0) && (
                    <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 40, color: dark ? '#7b839a' : '#9ca3af' }}>No marks entered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── LIST VIEW ── */
  // Stats
  const totalAssessments = assessments.length;
  const complete = assessments.filter(a => a.student_count > 0 && a.marked_count >= a.student_count).length;
  const inProgress = assessments.filter(a => a.marked_count > 0 && a.marked_count < a.student_count).length;
  const notStarted = assessments.filter(a => a.marked_count === 0).length;

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .assessment-row:hover { background: ${dark ? '#1a1f2e' : '#f8faff'} !important; }
        .assessment-row { transition: background 0.15s; }
        .action-btn:hover { opacity: 0.85; transform: scale(1.05); }
        .action-btn { transition: all 0.15s; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', margin: 0, fontFamily: "'Sora',sans-serif" }}>Assessments</h1>
            <p style={{ fontSize: 13, color: dark ? '#7b839a' : '#6b7280', margin: '4px 0 0' }}>Create assessments and record marks for your courses</p>
          </div>
          {courses.length > 0 && (
            <button onClick={openCreate} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            }}>
              <Plus size={14} /> New Assessment
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {assessments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', val: totalAssessments, color: '#6366f1', icon: ClipboardList },
            { label: 'Complete', val: complete, color: '#10b981', icon: CheckCircle },
            { label: 'In Progress', val: inProgress, color: '#f59e0b', icon: Clock },
            { label: 'Not Started', val: notStarted, color: '#ef4444', icon: AlertCircle },
          ].map(({ label, val, color, icon: Icon }) => (
            <div key={label} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af', fontWeight: 600 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course filter */}
      {courses.length > 0 && (
        <div style={{ ...card, marginBottom: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Filter size={13} color={dark ? '#7b839a' : '#9ca3af'} />
            <label style={{ fontSize: 12, color: dark ? '#7b839a' : '#6b7280', fontWeight: 600 }}>Filter by course:</label>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              style={{
                padding: '7px 12px', borderRadius: 8, border: `1px solid ${selectedCourse ? '#6366f1' : (dark ? '#2a3042' : '#e5e7eb')}`,
                background: selectedCourse ? 'rgba(99,102,241,0.08)' : (dark ? '#1a1f2e' : '#f9fafb'),
                color: selectedCourse ? '#6366f1' : (dark ? '#e2e8f0' : '#374151'),
                fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none', minWidth: 200,
              }}
            >
              <option value="">All Courses</option>
              {courses.map(c => (
                <option key={c._id} value={c._id}>
                  {c.name}{c.class_id?.name ? ' (' + c.class_id.name + ')' : ''}
                </option>
              ))}
            </select>
            {selectedCourse && (
              <button onClick={() => setSelectedCourse('')} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#7b839a' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {courses.length === 0 && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={28} color="#6366f1" />
          </div>
          <p style={{ color: dark ? '#e8ecf4' : '#111827', fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>No Courses Assigned</p>
          <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: 0, fontSize: 13 }}>Contact your admin to get courses assigned to you.</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: dark ? '#7b839a' : '#9ca3af' }}>Loading…</p>
        </div>
      ) : assessments.length === 0 && courses.length > 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ClipboardList size={28} color="#8b5cf6" />
          </div>
          <p style={{ color: dark ? '#e8ecf4' : '#111827', fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>No Assessments Yet</p>
          <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: 0, fontSize: 13 }}>Click "New Assessment" to create your first one.</p>
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Assessment', 'Course', 'Type', 'Term', 'Max Marks', 'Progress', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ ...th, padding: '12px 16px', borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assessments.map((a, i) => {
                const isComplete = a.student_count > 0 && a.marked_count >= a.student_count;
                const noProgress = a.marked_count === 0;

                return (
                  <tr key={a._id} className="assessment-row" style={{ borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}` }}>
                    <td style={{ ...td, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: a.type === 'FA' ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ClipboardList size={16} color="#fff" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: dark ? '#e8ecf4' : '#111827', fontSize: 13 }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>{a.academic_year}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...td, padding: '12px 16px', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: dark ? '#c4c9d4' : '#374151' }}>{a.course_id?.name}</div>
                      {a.course_id?.class_id && <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>Class assigned</div>}
                    </td>
                    <td style={{ ...td, padding: '12px 16px' }}><TypeBadge type={a.type} /></td>
                    <td style={{ ...td, padding: '12px 16px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.term}</td>
                    <td style={{ ...td, padding: '12px 16px', fontWeight: 700, color: dark ? '#e2e8f0' : '#374151', fontSize: 13 }}>{a.max_marks}</td>
                    <td style={{ ...td, padding: '12px 16px', minWidth: 140 }}>
                      <ProgressIndicator marked={a.marked_count || 0} total={a.student_count || 0} dark={dark} />
                    </td>
                    <td style={{ ...td, padding: '12px 16px' }}>
                      <SubmissionStatusBadge status={a.submission_status || 'draft'} />
                    </td>
                    <td style={{ ...td, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="action-btn" onClick={() => openMarks(a)} title={a.submission_status === 'submitted' || a.submission_status === 'approved' ? 'View Marks' : 'Enter Marks'} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          <Users size={11} /> Marks
                        </button>
                        <button className="action-btn" onClick={() => openReport(a)} title="View Report" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          <BarChart2 size={11} /> Report
                        </button>
                        <button className="action-btn" onClick={() => openEdit(a)} title="Edit" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit2 size={12} color={dark ? '#7b839a' : '#6b7280'} />
                        </button>
                        <button className="action-btn" onClick={() => deleteAssessment(a._id)} title="Delete" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={12} color="#ef4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }} style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 480, borderRadius: 22, background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`, padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', fontFamily: "'Sora',sans-serif" }}>
                  {editingAssessment ? 'Edit Assessment' : 'New Assessment'}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Fill in assessment details</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: dark ? '#1e2130' : '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#7b839a' : '#6b7280' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Assessment Title *</label>
                <select value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value, type: e.target.value }))} style={inputStyle}>
                  <option value="FA">FA — Formative Assessment</option>
                  <option value="CA">CA — Continuous Assessment</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Course *</label>
                <select value={form.course_id} onChange={e => handleCourseSelect(e.target.value)} style={inputStyle}>
                  <option value="">Select course…</option>
                  {courses.map(c => <option key={c._id} value={c._id}>{c.name}{c.class_id?.name ? ' (' + c.class_id.name + ')' : ''} — {c.total_marks || 100} marks</option>)}
                </select>
                {form.course_id && (() => {
                  const c = courses.find(x => x._id === form.course_id);
                  return c?.total_marks ? <p style={{ margin: '4px 0 0', fontSize: 11, color: '#10b981' }}>Module weight: {c.total_marks} marks (will be used as default max marks)</p> : null;
                })()}
              </div>
              {/* Assessment type picker: show which types are already created for this course */}
              <div>
                <label style={labelStyle}>Assessment Type *</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['FA', 'CA'].map(t => {
                    const alreadyExists = !editingAssessment && form.course_id &&
                      assessments.some(a => (a.course_id?._id || a.course_id) === form.course_id && a.type === t);
                    const isSelected = form.type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={alreadyExists}
                        onClick={() => !alreadyExists && setForm(f => ({ ...f, type: t, title: t }))}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: 10, border: `2px solid ${alreadyExists ? (dark ? '#2a3042' : '#e5e7eb') : isSelected ? (t === 'FA' ? '#3b82f6' : '#8b5cf6') : (dark ? '#2a3042' : '#e5e7eb')}`,
                          background: alreadyExists ? (dark ? '#111318' : '#f3f4f6') : isSelected ? (t === 'FA' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)') : 'transparent',
                          color: alreadyExists ? (dark ? '#3a4055' : '#c4c9d4') : isSelected ? (t === 'FA' ? '#3b82f6' : '#8b5cf6') : (dark ? '#7b839a' : '#6b7280'),
                          cursor: alreadyExists ? 'not-allowed' : 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{t}</span>
                        <span style={{ fontSize: 10, fontWeight: 600 }}>{t === 'FA' ? 'Formative' : 'Continuous'}</span>
                        {alreadyExists && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Check size={8} /> Created
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!editingAssessment && form.course_id && assessments.some(a => (a.course_id?._id || a.course_id) === form.course_id && a.type === form.type) && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f59e0b' }}>
                    An assessment of this type already exists for this course. Select a different type.
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Max Marks <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 5, background: '#6366f120', color: '#6366f1', fontWeight: 700, marginLeft: 4 }}>Admin-set</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={form.max_marks}
                      readOnly
                      style={{ ...inputStyle, background: dark ? '#111318' : '#f3f4f6', color: dark ? '#7b839a' : '#6b7280', cursor: 'not-allowed', paddingRight: 36 }}
                    />
                    <Lock size={13} color={dark ? '#7b839a' : '#9ca3af'} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: '#f59e0b' }}>Locked to module weight set by admin</p>
                </div>
                <div>
                  <label style={labelStyle}>Term *</label>
                  <select value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} style={inputStyle}>
                    {TERMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Academic Year *</label>
                <select value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))} style={inputStyle}>
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#94a3b8' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveAssessment} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(139,92,246,0.35)' }}>
                {editingAssessment ? 'Save Changes' : 'Create Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        loading={confirmModal.loading}
        variant={confirmModal.variant}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText || 'Cancel'}
      />
    </div>
  );
}