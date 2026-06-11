import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, Edit2, Trash2, ChevronDown, BarChart2,
  X, Save, GraduationCap, ClipboardList, Award, Printer,
  ArrowLeft, Users, Check,
} from 'lucide-react';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [`${CURRENT_YEAR - 1}-${CURRENT_YEAR}`, `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`];

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

export default function TeacherAssessments() {
  const { dark } = useTheme();

  const [view, setView] = useState('list'); // list | marks | report
  const [courses, setCourses] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [marksData, setMarksData] = useState(null);
  const [marksEdits, setMarksEdits] = useState({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Assessment modal
  const [showModal, setShowModal] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [form, setForm] = useState({ title: '', course_id: '', type: 'FA', term: 'Term 1', academic_year: YEARS[1], max_marks: 100 });

  const card = {
    background: dark ? '#13161f' : '#ffffff',
    border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
    borderRadius: 16,
    padding: 20,
  };

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 10,
    border: `1px solid ${dark ? '#2a3042' : '#d1d5db'}`,
    background: dark ? '#1a1f2e' : '#f9fafb',
    color: dark ? '#e2e8f0' : '#111827',
    fontSize: 13,
    outline: 'none',
  };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: dark ? '#7b839a' : '#6b7280', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' };

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

  function openCreate() {
    setEditingAssessment(null);
    setForm({ title: '', course_id: courses[0]?._id || '', type: 'FA', term: 'Term 1', academic_year: YEARS[1], max_marks: 100 });
    setShowModal(true);
  }

  function openEdit(a) {
    setEditingAssessment(a);
    setForm({ title: a.title, course_id: a.course_id?._id || a.course_id, type: a.type, term: a.term, academic_year: a.academic_year, max_marks: a.max_marks });
    setShowModal(true);
  }

  async function saveAssessment() {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    if (!form.course_id) { toast.error('Select a course'); return; }
    try {
      if (editingAssessment) {
        await api.put('/assessment/teacher/assessments/' + editingAssessment._id, form);
        toast.success('Assessment updated');
      } else {
        await api.post('/assessment/teacher/assessments', form);
        toast.success('Assessment created');
      }
      setShowModal(false);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  }

  async function deleteAssessment(id) {
    if (!confirm('Delete this assessment and all its marks?')) return;
    try {
      await api.delete('/assessment/teacher/assessments/' + id);
      toast.success('Deleted');
      fetchData();
    } catch (e) { toast.error('Error deleting'); }
  }

  async function openMarks(assessment) {
    setActiveAssessment(assessment);
    setView('marks');
    try {
      const res = await api.get('/assessment/teacher/assessments/' + assessment._id + '/marks');
      setMarksData(res.data);
      const edits = {};
      res.data.students.forEach(s => { edits[s.student_id] = { marks: s.marks ?? '', remarks: s.remarks || '' }; });
      setMarksEdits(edits);
    } catch (e) { toast.error('Failed to load marks'); }
  }

  async function saveMarks() {
    setSavingMarks(true);
    try {
      const marks = Object.entries(marksEdits).map(([student_id, v]) => ({
        student_id,
        marks: v.marks !== '' ? Number(v.marks) : null,
        remarks: v.remarks,
      }));
      await api.post('/assessment/teacher/assessments/' + activeAssessment._id + '/marks', { marks });
      toast.success('Marks saved!');
    } catch (e) { toast.error('Error saving marks'); }
    finally { setSavingMarks(false); }
  }

  async function openReport(assessment) {
    setActiveAssessment(assessment);
    setView('report');
    setReportLoading(true);
    setReportData(null);
    try {
      const res = await api.get('/assessment/teacher/reports/' + assessment._id);
      setReportData(res.data);
    } catch (e) { toast.error('Failed to load report'); }
    finally { setReportLoading(false); }
  }

  const th = { padding: '10px 14px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' };
  const td = { padding: '10px 14px', borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}`, color: dark ? '#e2e8f0' : '#374151', fontSize: 13 };

  /* ── MARKS VIEW ─────────────────────────────────────────────────── */
  if (view === 'marks' && marksData) {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => { setView('list'); setMarksData(null); }} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: dark ? '#7b839a' : '#6b7280', fontSize: 13, fontWeight: 500,
          }}>
            <ArrowLeft size={14} /> Back to Assessments
          </button>
        </div>
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', fontFamily: "'Sora',sans-serif" }}>{activeAssessment?.title}</h2>
              <p style={{ margin: 0, fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>
                {activeAssessment?.course_id?.name} · {activeAssessment?.term} · {activeAssessment?.academic_year}
                {' · '}<TypeBadge type={activeAssessment?.type} />
              </p>
            </div>
            <button onClick={saveMarks} disabled={savingMarks} style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#10b981,#059669)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: savingMarks ? 0.7 : 1,
            }}>
              <Save size={14} />{savingMarks ? 'Saving…' : 'Save Marks'}
            </button>
          </div>
        </div>
        <div style={{ ...card }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Student</th>
                  <th style={{ ...th, width: 120 }}>Marks (/{activeAssessment?.max_marks})</th>
                  <th style={th}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {marksData.students.map((s, i) => {
                  const edit = marksEdits[s.student_id] || {};
                  const pct = edit.marks !== '' && edit.marks != null ? Math.round((Number(edit.marks) / activeAssessment.max_marks) * 100) : null;
                  return (
                    <tr key={s.student_id}>
                      <td style={{ ...td, color: dark ? '#7b839a' : '#9ca3af', width: 36 }}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <div>{s.name}</div>
                        <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>{s.email}</div>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number"
                            min={0}
                            max={activeAssessment?.max_marks}
                            value={edit.marks ?? ''}
                            onChange={e => setMarksEdits(prev => ({ ...prev, [s.student_id]: { ...prev[s.student_id], marks: e.target.value } }))}
                            style={{ ...inputStyle, width: 70, textAlign: 'center' }}
                          />
                          {pct != null && <span style={{ fontSize: 11, fontWeight: 700, color: pctColor(pct) }}>{pct}%</span>}
                        </div>
                      </td>
                      <td style={td}>
                        <input
                          type="text"
                          value={edit.remarks || ''}
                          onChange={e => setMarksEdits(prev => ({ ...prev, [s.student_id]: { ...prev[s.student_id], remarks: e.target.value } }))}
                          placeholder="Optional remark…"
                          style={{ ...inputStyle, width: '100%' }}
                        />
                      </td>
                    </tr>
                  );
                })}
                {marksData.students.length === 0 && (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: dark ? '#7b839a' : '#9ca3af', padding: 32 }}>No students in this class yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ── REPORT VIEW ─────────────────────────────────────────────────── */
  if (view === 'report') {
    return (
      <div>
        <style>{`@media print { .no-print { display: none !important; } }`}</style>
        <div className="no-print" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setView('list'); setReportData(null); }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: dark ? '#7b839a' : '#6b7280', fontSize: 13, fontWeight: 500,
            }}>
              <ArrowLeft size={14} /> Back
            </button>
            {reportData && (
              <button onClick={() => window.print()} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 16px', borderRadius: 10,
                border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                background: dark ? '#1a1f2e' : '#f9fafb',
                color: dark ? '#e2e8f0' : '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                <Printer size={14} /> Print
              </button>
            )}
          </div>
        </div>
        {reportLoading && <div style={{ textAlign: 'center', padding: 60, color: dark ? '#7b839a' : '#9ca3af' }}>Loading report…</div>}
        {reportData && (
          <div style={{ ...card }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', fontFamily: "'Sora',sans-serif" }}>
                {reportData.assessment?.title}
              </h2>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Course: {reportData.assessment?.course_id?.name}</span>
                <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Term: {reportData.assessment?.term}</span>
                <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Year: {reportData.assessment?.academic_year}</span>
                <TypeBadge type={reportData.assessment?.type} />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['#', 'Student', 'Marks', 'Max', '%', 'Grade', 'Remarks'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(reportData.students || []).sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)).map((s, i) => (
                    <tr key={s.student_id}>
                      <td style={{ ...td, color: dark ? '#7b839a' : '#9ca3af' }}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <div>{s.student_name}</div>
                        <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>{s.student_email}</div>
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: pctColor(s.percentage) }}>{s.marks_obtained ?? '—'}</td>
                      <td style={td}>{s.max_marks}</td>
                      <td style={{ ...td, color: pctColor(s.percentage) }}>{s.percentage != null ? s.percentage + '%' : '—'}</td>
                      <td style={td}><GradeBadge grade={s.grade} /></td>
                      <td style={{ ...td, fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{s.remarks || '—'}</td>
                    </tr>
                  ))}
                  {(!reportData.students || reportData.students.length === 0) && (
                    <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 32 }}>No marks entered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── LIST VIEW ──────────────────────────────────────────────────── */
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', margin: 0, fontFamily: "'Sora',sans-serif" }}>Assessments</h1>
            <p style={{ fontSize: 13, color: dark ? '#7b839a' : '#6b7280', margin: '4px 0 0' }}>Create assessments and record marks for your courses</p>
          </div>
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={14} /> New Assessment
          </button>
        </div>
      </div>

      {/* Course filter */}
      {courses.length > 0 && (
        <div style={{ ...card, marginBottom: 16, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#6b7280', fontWeight: 600 }}>Filter by course:</span>
            <button onClick={() => setSelectedCourse('')} style={{
              padding: '5px 12px', borderRadius: 8, border: `1px solid ${!selectedCourse ? '#6366f1' : (dark ? '#2a3042' : '#e5e7eb')}`,
              background: !selectedCourse ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: !selectedCourse ? '#6366f1' : (dark ? '#7b839a' : '#6b7280'),
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>All</button>
            {courses.map(c => (
              <button key={c._id} onClick={() => setSelectedCourse(c._id)} style={{
                padding: '5px 12px', borderRadius: 8, border: `1px solid ${selectedCourse === c._id ? '#6366f1' : (dark ? '#2a3042' : '#e5e7eb')}`,
                background: selectedCourse === c._id ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: selectedCourse === c._id ? '#6366f1' : (dark ? '#7b839a' : '#6b7280'),
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{c.name}</button>
            ))}
          </div>
        </div>
      )}

      {courses.length === 0 && !loading && (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <BookOpen size={36} color={dark ? '#7b839a' : '#9ca3af'} style={{ marginBottom: 12 }} />
          <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: 0 }}>No courses assigned to you yet. Contact your admin.</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: dark ? '#7b839a' : '#9ca3af' }}>Loading…</div>
      ) : assessments.length === 0 && courses.length > 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60 }}>
          <ClipboardList size={36} color={dark ? '#7b839a' : '#9ca3af'} style={{ marginBottom: 12 }} />
          <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: 0 }}>No assessments yet. Click "New Assessment" to create one.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {assessments.map(a => (
            <div key={a._id} style={{ ...card, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: a.type === 'FA' ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ClipboardList size={17} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: dark ? '#e8ecf4' : '#111827' }}>{a.title}</span>
                    <TypeBadge type={a.type} />
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>
                    {a.course_id?.name} · {a.term} · {a.academic_year} · Max: {a.max_marks}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => openMarks(a)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 9, border: 'none',
                    background: 'linear-gradient(135deg,#10b981,#059669)',
                    color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <Users size={12} /> Enter Marks
                  </button>
                  <button onClick={() => openReport(a)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 9, border: 'none',
                    background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                    color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <BarChart2 size={12} /> View Report
                  </button>
                  <button onClick={() => openEdit(a)} style={{
                    width: 32, height: 32, borderRadius: 9, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                    background: dark ? '#1a1f2e' : '#f9fafb', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Edit2 size={13} color={dark ? '#7b839a' : '#6b7280'} />
                  </button>
                  <button onClick={() => deleteAssessment(a._id)} style={{
                    width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.06)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Trash2 size={13} color="#ef4444" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }} style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 460, borderRadius: 20,
            background: dark ? '#13161f' : '#ffffff',
            border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`,
            padding: 28,
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', fontFamily: "'Sora',sans-serif" }}>
                {editingAssessment ? 'Edit Assessment' : 'New Assessment'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: dark ? '#7b839a' : '#6b7280' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Mid-term Test 1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Course *</label>
                <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select course…</option>
                  {courses.map(c => <option key={c._id} value={c._id}>{c.name}{c.class_id?.name ? ' (' + c.class_id.name + ')' : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Type *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                    <option value="FA">FA — Formative</option>
                    <option value="CA">CA — Continuous</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Max Marks</label>
                  <input type="number" min={1} value={form.max_marks} onChange={e => setForm(f => ({ ...f, max_marks: Number(e.target.value) }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Term *</label>
                  <select value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} style={inputStyle}>
                    {TERMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Academic Year *</label>
                  <select value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))} style={inputStyle}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                background: dark ? '#1a1f2e' : '#f9fafb',
                color: dark ? '#94a3b8' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={saveAssessment} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {editingAssessment ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }) {
  const color = type === 'FA' ? '#3b82f6' : '#8b5cf6';
  const label = type === 'FA' ? 'Formative' : 'Continuous';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: color + '20', color, border: '1px solid ' + color + '40' }}>
      {label}
    </span>
  );
}

function GradeBadge({ grade }) {
  const color = grade === 'A+' || grade === 'A' ? '#10b981' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#f59e0b' : grade === 'D' ? '#f97316' : grade === 'F' ? '#ef4444' : '#9ca3af';
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: color + '20', color }}>{grade}</span>;
}
