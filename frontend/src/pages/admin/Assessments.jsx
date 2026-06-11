import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, Edit2, Trash2, UserCheck, ChevronDown,
  BarChart2, X, Check, Search, GraduationCap, FileText,
  Users, Award, Printer, ChevronRight, TrendingUp, Star,
  Filter, Download, Eye, Clock, Target, BookMarked,
  LayoutGrid, List, Medal, AlertCircle, CheckCircle,
  ChevronUp, Layers, Activity,
} from 'lucide-react';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [
  `${CURRENT_YEAR - 1}-${CURRENT_YEAR}`,
  `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR + 1}-${CURRENT_YEAR + 2}`,
];

/* ── Grade / colour helpers ─────────────────────────────────────── */
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
  if (pct == null) return '#64748b';
  if (pct >= 80) return '#10b981';
  if (pct >= 60) return '#6366f1';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}
function gradeToGPA(grade) {
  const map = { 'A+': 4.0, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0 };
  return map[grade] ?? null;
}

/* ─────────────────────────────────────────────────────────────────
   Mini bar for sparkline-style visual in course cards
──────────────────────────────────────────────────────────────────*/
function MiniBar({ value, max = 100, color = '#6366f1', height = 4 }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ height, borderRadius: 99, background: 'rgba(99,102,241,0.12)', overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 99, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Animated counter
──────────────────────────────────────────────────────────────────*/
function AnimCount({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) return;
    let start = 0;
    const step = Math.ceil(value / 30);
    const t = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(t);
    }, 20);
    return () => clearInterval(t);
  }, [value]);
  return <>{display}{suffix}</>;
}

/* ─────────────────────────────────────────────────────────────────
   MAIN COMPONENT
──────────────────────────────────────────────────────────────────*/
export default function AdminAssessments() {
  const { dark } = useTheme();
  const { user } = useAuth();

  const [tab, setTab] = useState('courses');
  const [reportType, setReportType] = useState('student');
  const [courseView, setCourseView] = useState('grid'); // grid | list

  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [courseSearch, setCourseSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  const [reportFilter, setReportFilter] = useState({ term: '', year: '', studentId: '', assessmentId: '', classId: '' });
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ name: '', code: '', description: '', class_id: '', teacher_id: '' });

  /* ── tokens ─────────────────────────────────────────────── */
  const C = {
    bg: dark ? '#080b14' : '#f0f2f8',
    surface: dark ? '#0e1120' : '#ffffff',
    surfaceAlt: dark ? '#121624' : '#f8faff',
    border: dark ? '#1c2035' : '#e2e8f3',
    borderLight: dark ? '#161928' : '#eef1f8',
    text: dark ? '#e8edf8' : '#111827',
    textMuted: dark ? '#64748b' : '#6b7280',
    textDim: dark ? '#3d4a60' : '#c4cad8',
    accent: '#6366f1',
    accentSoft: dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
    gold: '#f59e0b',
    goldSoft: dark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
    emerald: '#10b981',
    emeraldSoft: dark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.07)',
  };

  const card = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 20,
    transition: 'box-shadow 0.2s',
  };

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.surfaceAlt,
    color: C.text,
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
    color: C.textMuted,
    marginBottom: 5,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  /* ── fetch ──────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, tRes, clRes, sRes, aRes] = await Promise.all([
        api.get('/assessment/admin/courses'),
        api.get('/admin/teachers'),
        api.get('/admin/classes'),
        api.get('/admin/students'),
        api.get('/assessment/admin/assessments'),
      ]);
      setCourses(cRes.data.courses || []);
      setTeachers(tRes.data.teachers || []);
      setClasses(clRes.data.classes || []);
      setStudents(sRes.data.students || []);
      setAssessments(aRes.data.assessments || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── course CRUD ────────────────────────────────────────── */
  function openCreateCourse() {
    setEditingCourse(null);
    setCourseForm({ name: '', code: '', description: '', class_id: '', teacher_id: '' });
    setShowCourseModal(true);
  }
  function openEditCourse(c) {
    setEditingCourse(c);
    setCourseForm({
      name: c.name || '',
      code: c.code || '',
      description: c.description || '',
      class_id: c.class_id?._id || c.class_id || '',
      teacher_id: c.teacher_id?._id || c.teacher_id || '',
    });
    setShowCourseModal(true);
  }
  async function saveCourse() {
    if (!courseForm.name.trim()) { toast.error('Course name is required'); return; }
    try {
      if (editingCourse) {
        await api.put('/assessment/admin/courses/' + editingCourse._id, courseForm);
        toast.success('Course updated');
      } else {
        await api.post('/assessment/admin/courses', courseForm);
        toast.success('Course created');
      }
      setShowCourseModal(false);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Error saving course'); }
  }
  async function deleteCourse(id) {
    if (!confirm('Delete this course? All associated assessments will also be removed.')) return;
    try {
      await api.delete('/assessment/admin/courses/' + id);
      toast.success('Course deleted');
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  }

  /* ── reports ────────────────────────────────────────────── */
  async function fetchReport() {
    setReportLoading(true);
    setReportData(null);
    try {
      let res;
      if (reportType === 'student') {
        if (!reportFilter.studentId) { toast.error('Select a student'); setReportLoading(false); return; }
        res = await api.get('/assessment/admin/reports/student/' + reportFilter.studentId, {
          params: { term: reportFilter.term || undefined, year: reportFilter.year || undefined },
        });
      } else if (reportType === 'assessment') {
        if (!reportFilter.assessmentId) { toast.error('Select an assessment'); setReportLoading(false); return; }
        res = await api.get('/assessment/admin/reports/assessment/' + reportFilter.assessmentId);
      } else {
        if (!reportFilter.classId) { toast.error('Select a class'); setReportLoading(false); return; }
        res = await api.get('/assessment/admin/reports/class/' + reportFilter.classId, {
          params: { term: reportFilter.term || undefined, year: reportFilter.year || undefined },
        });
      }
      setReportData({ type: reportType, ...res.data });
    } catch (e) { toast.error(e.response?.data?.message || 'Error loading report'); }
    finally { setReportLoading(false); }
  }

  /* ── filtered courses ───────────────────────────────────── */
  const filteredCourses = courses.filter(c => {
    const q = courseSearch.toLowerCase();
    const matchQ = !q || c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q);
    const matchF = !courseFilter || (c.class_id?._id || c.class_id) === courseFilter;
    return matchQ && matchF;
  });

  /* ── summary stats ──────────────────────────────────────── */
  const stats = [
    { label: 'Active Courses', value: courses.length, icon: BookMarked, color: C.accent, bg: C.accentSoft },
    { label: 'Assessments', value: assessments.length, icon: FileText, color: C.gold, bg: C.goldSoft },
    { label: 'Students', value: students.length, icon: GraduationCap, color: C.emerald, bg: C.emeraldSoft },
    { label: 'Classes', value: classes.length, icon: Layers, color: '#a78bfa', bg: dark ? 'rgba(167,139,250,0.1)' : 'rgba(167,139,250,0.08)' },
  ];

  /* ────────────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", minHeight: '100vh', background: C.bg }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.35s ease both; }
        .course-card:hover { box-shadow: 0 8px 32px rgba(99,102,241,0.13) !important; }
        .action-btn:hover { opacity: 0.8; }
        input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
      `}</style>

      {/* ═══ HEADER ═══════════════════════════════════════════ */}
      <div className="no-print" style={{ marginBottom: 28 }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            {/* Academic eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 3, height: 18, background: 'linear-gradient(#6366f1,#a78bfa)', borderRadius: 99 }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accent }}>
                Academic Administration
              </span>
            </div>
            <h1 style={{
              fontSize: 24, fontWeight: 800, color: C.text,
              margin: 0, fontFamily: "'Sora',sans-serif", letterSpacing: '-0.3px',
            }}>
              Assessment Management
            </h1>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '5px 0 0', lineHeight: 1.5 }}>
              Manage courses, assign faculty, and generate academic performance reports
            </p>
          </div>

          {/* Quick stats strip */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {stats.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 12,
                background: C.surface, border: `1px solid ${C.border}`,
                minWidth: 110,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1, fontFamily: "'Sora',sans-serif" }}>
                    <AnimCount value={value} />
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'inline-flex', gap: 2, padding: 4,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12,
        }}>
          {[
            { key: 'courses', label: 'Course Catalogue', icon: BookOpen },
            { key: 'reports', label: 'Academic Reports', icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', border: 'none', borderRadius: 9,
              background: tab === key ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'transparent',
              color: tab === key ? '#ffffff' : C.textMuted,
              fontWeight: tab === key ? 700 : 500, fontSize: 13, cursor: 'pointer',
              boxShadow: tab === key ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
              transition: 'all 0.2s',
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ COURSES TAB ══════════════════════════════════════ */}
      {tab === 'courses' && (
        <div className="no-print fade-up">

          {/* Toolbar */}
          <div style={{
            ...card, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.textMuted }} />
              <input
                value={courseSearch}
                onChange={e => setCourseSearch(e.target.value)}
                placeholder="Search courses by name or code…"
                style={{ ...inputStyle, paddingLeft: 32 }}
              />
            </div>

            {/* Filter by class */}
            <div style={{ position: 'relative', minWidth: 160 }}>
              <Filter size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, pointerEvents: 'none' }} />
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 30, width: 'auto', minWidth: 160 }}
              >
                <option value="">All Classes</option>
                {classes.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* View toggle */}
            <div style={{ display: 'flex', gap: 2, background: C.surfaceAlt, padding: 3, borderRadius: 9, border: `1px solid ${C.border}` }}>
              {[['grid', LayoutGrid], ['list', List]].map(([v, Icon]) => (
                <button key={v} onClick={() => setCourseView(v)} style={{
                  width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: courseView === v ? C.accent : 'transparent',
                  color: courseView === v ? '#fff' : C.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {/* Add button */}
            <button onClick={openCreateCourse} className="action-btn" style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              transition: 'opacity 0.15s',
            }}>
              <Plus size={14} /> New Course
            </button>
          </div>

          {/* Count label */}
          {!loading && (
            <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 12px', fontWeight: 500 }}>
              {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'} found
              {(courseSearch || courseFilter) && <span style={{ color: C.accent, marginLeft: 6, cursor: 'pointer', fontWeight: 700 }} onClick={() => { setCourseSearch(''); setCourseFilter(''); }}>Clear filters ×</span>}
            </p>
          )}

          {loading ? (
            <div style={{ ...card, textAlign: 'center', padding: 60 }}>
              <Activity size={28} color={C.accent} style={{ marginBottom: 10, opacity: 0.6 }} />
              <p style={{ color: C.textMuted, margin: 0, fontSize: 13 }}>Loading courses…</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 60 }}>
              <BookOpen size={36} color={C.textDim} style={{ marginBottom: 12 }} />
              <p style={{ color: C.textMuted, margin: '0 0 6px', fontWeight: 600 }}>No courses found</p>
              <p style={{ color: C.textDim, margin: 0, fontSize: 12 }}>
                {courseSearch || courseFilter ? 'Try adjusting your filters' : 'Add a course to get started'}
              </p>
            </div>
          ) : courseView === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
              {filteredCourses.map((c, idx) => <CourseCard key={c._id} c={c} dark={dark} C={C} idx={idx} onEdit={openEditCourse} onDelete={deleteCourse} assessments={assessments} />)}
            </div>
          ) : (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Course', 'Code', 'Class', 'Teacher', 'Assessments', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '11px 16px',
                        background: C.surfaceAlt,
                        color: C.textMuted,
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                        textAlign: 'left', borderBottom: `1px solid ${C.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((c, i) => {
                    const aCount = assessments.filter(a => (a.course_id?._id || a.course_id) === c._id).length;
                    return (
                      <tr key={c._id} style={{ borderBottom: `1px solid ${C.borderLight}`, transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', color: C.text, fontWeight: 700, fontSize: 13 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BookOpen size={13} color={C.accent} />
                            </div>
                            {c.name}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {c.code ? <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accentSoft, padding: '2px 8px', borderRadius: 6 }}>{c.code}</span> : <span style={{ color: C.textDim, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px', color: C.textMuted, fontSize: 13 }}>{c.class_id?.name || '—'}</td>
                        <td style={{ padding: '12px 16px', color: C.textMuted, fontSize: 13 }}>{c.teacher_id?.name || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: aCount > 0 ? C.emerald : C.textDim, background: aCount > 0 ? C.emeraldSoft : C.borderLight, padding: '2px 8px', borderRadius: 6 }}>{aCount}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEditCourse(c)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Edit2 size={12} color={C.textMuted} />
                            </button>
                            <button onClick={() => deleteCourse(c._id)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        </div>
      )}

      {/* ═══ REPORTS TAB ══════════════════════════════════════ */}
      {tab === 'reports' && (
        <div className="fade-up">

          {/* Report type selector */}
          <div className="no-print" style={{ ...card, marginBottom: 20 }}>

            {/* Section heading */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Award size={15} color={C.gold} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
                Generate Academic Report
              </span>
            </div>

            {/* Report type cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginBottom: 20 }}>
              {[
                { key: 'student', label: 'Student Transcript', icon: GraduationCap, desc: 'Individual performance across all courses', color: C.accent, soft: C.accentSoft },
                { key: 'assessment', label: 'Assessment Report', icon: Target, desc: 'All student results for one assessment', color: C.gold, soft: C.goldSoft },
                { key: 'class', label: 'Class Report', icon: Users, desc: 'Ranked class summary across all courses', color: C.emerald, soft: C.emeraldSoft },
              ].map(({ key, label, icon: Icon, desc, color, soft }) => (
                <button key={key} onClick={() => { setReportType(key); setReportData(null); }} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                  padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${reportType === key ? color : C.border}`,
                  background: reportType === key ? soft : C.surfaceAlt,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: reportType === key ? color + '22' : C.border + '60', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={reportType === key ? color : C.textMuted} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: reportType === key ? color : C.text, fontFamily: "'Sora',sans-serif" }}>{label}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textMuted, lineHeight: 1.45 }}>{desc}</p>
                  </div>
                  {reportType === key && <div style={{ width: '100%', height: 2, background: `linear-gradient(90deg,${color},transparent)`, borderRadius: 99, marginTop: 4 }} />}
                </button>
              ))}
            </div>

            {/* Filters row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, padding: '16px 0 0', borderTop: `1px solid ${C.border}` }}>
              {reportType === 'student' && (
                <div>
                  <label style={labelStyle}>Student</label>
                  <select value={reportFilter.studentId} onChange={e => setReportFilter(f => ({ ...f, studentId: e.target.value }))} style={inputStyle}>
                    <option value="">Select student…</option>
                    {students.map(s => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {reportType === 'assessment' && (
                <div>
                  <label style={labelStyle}>Assessment</label>
                  <select value={reportFilter.assessmentId} onChange={e => setReportFilter(f => ({ ...f, assessmentId: e.target.value }))} style={inputStyle}>
                    <option value="">Select assessment…</option>
                    {assessments.map(a => <option key={a._id || a.id} value={a._id || a.id}>{a.title} — {a.course_id?.name}</option>)}
                  </select>
                </div>
              )}
              {reportType === 'class' && (
                <div>
                  <label style={labelStyle}>Class</label>
                  <select value={reportFilter.classId} onChange={e => setReportFilter(f => ({ ...f, classId: e.target.value }))} style={inputStyle}>
                    <option value="">Select class…</option>
                    {classes.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {(reportType === 'student' || reportType === 'class') && (
                <>
                  <div>
                    <label style={labelStyle}>Academic Term</label>
                    <select value={reportFilter.term} onChange={e => setReportFilter(f => ({ ...f, term: e.target.value }))} style={inputStyle}>
                      <option value="">All Terms</option>
                      {TERMS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Academic Year</label>
                    <select value={reportFilter.year} onChange={e => setReportFilter(f => ({ ...f, year: e.target.value }))} style={inputStyle}>
                      <option value="">All Years</option>
                      {YEARS.map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
              <button onClick={fetchReport} disabled={reportLoading} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 22px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                opacity: reportLoading ? 0.7 : 1, transition: 'opacity 0.15s',
              }}>
                <BarChart2 size={14} />
                {reportLoading ? 'Generating…' : 'Generate Report'}
              </button>
              {reportData && (
                <button onClick={() => window.print()} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10,
                  border: `1px solid ${C.border}`, background: C.surfaceAlt,
                  color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  <Printer size={14} /> Print Report
                </button>
              )}
              {reportLoading && (
                <span style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>Compiling academic data…</span>
              )}
            </div>
          </div>

          {reportData && <ReportView data={reportData} dark={dark} C={C} />}
        </div>
      )}

      {/* ═══ COURSE MODAL ══════════════════════════════════════ */}
      {showCourseModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowCourseModal(false); }} style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 500, borderRadius: 20,
            background: dark ? '#0e1120' : '#ffffff',
            border: `1px solid ${C.border}`,
            padding: 28,
            boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
            animation: 'fadeUp 0.25s ease',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={17} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Sora',sans-serif" }}>
                  {editingCourse ? 'Edit Course' : 'Add New Course'}
                </h2>
                <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>
                  {editingCourse ? 'Update course information' : 'Create a new course in the curriculum'}
                </p>
              </div>
              <button onClick={() => setShowCourseModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.textMuted, padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: C.border, marginBottom: 20 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Course Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Advanced Mathematics" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Course Code</label>
                  <input value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. MATH401" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Assign to Class</label>
                  <select value={courseForm.class_id} onChange={e => setCourseForm(f => ({ ...f, class_id: e.target.value }))} style={inputStyle}>
                    <option value="">No class</option>
                    {classes.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Assign Faculty</label>
                <select value={courseForm.teacher_id} onChange={e => setCourseForm(f => ({ ...f, teacher_id: e.target.value }))} style={inputStyle}>
                  <option value="">No teacher assigned</option>
                  {teachers.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of course objectives…" rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            </div>

            <div style={{ height: 1, background: C.border, margin: '20px 0' }} />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCourseModal(false)} style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: `1px solid ${C.border}`, background: C.surfaceAlt,
                color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={saveCourse} style={{
                flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
              }}>
                {editingCourse ? 'Save Changes' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   COURSE CARD
──────────────────────────────────────────────────────────────────*/
function CourseCard({ c, dark, C, idx, onEdit, onDelete, assessments }) {
  const aCount = assessments.filter(a => (a.course_id?._id || a.course_id) === c._id).length;
  const hues = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
  const accent = hues[idx % hues.length];

  return (
    <div className="course-card" style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s, transform 0.2s',
      cursor: 'default',
    }}>
      {/* Accent stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${accent},${accent}44)` }} />

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, paddingTop: 4 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BookOpen size={19} color={accent} />
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => onEdit(c)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Edit2 size={12} color={C.textMuted} />
          </button>
          <button onClick={() => onDelete(c._id)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={12} color="#ef4444" />
          </button>
        </div>
      </div>

      {/* Name & code */}
      <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: '0 0 3px', fontFamily: "'Sora',sans-serif", lineHeight: 1.3 }}>{c.name}</p>
      {c.code && (
        <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: accent + '18', padding: '2px 8px', borderRadius: 6, letterSpacing: '0.06em' }}>{c.code}</span>
      )}
      {c.description && <p style={{ fontSize: 12, color: C.textMuted, margin: '8px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</p>}

      {/* Divider */}
      <div style={{ height: 1, background: C.border, margin: '12px 0' }} />

      {/* Meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {c.class_id?.name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={10} color={C.textMuted} />
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Class: <strong style={{ color: C.text }}>{c.class_id.name}</strong></span>
          </div>
        )}
        {c.teacher_id?.name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={10} color={C.textMuted} />
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Faculty: <strong style={{ color: C.text }}>{c.teacher_id.name}</strong></span>
          </div>
        )}
      </div>

      {/* Assessment count bar */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assessments</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: aCount > 0 ? accent : C.textDim }}>{aCount}</span>
        </div>
        <MiniBar value={aCount} max={Math.max(...(assessments.length ? [10] : [1]))} color={accent} height={4} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   REPORT VIEW
──────────────────────────────────────────────────────────────────*/
function ReportView({ data, dark, C }) {
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 };
  const th = {
    padding: '10px 14px',
    background: C.surfaceAlt,
    color: C.textMuted,
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
    textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: `1px solid ${C.border}`,
  };
  const td = {
    padding: '10px 14px',
    borderBottom: `1px solid ${C.borderLight}`,
    color: C.text,
    fontSize: 13,
  };

  /* ── Student transcript ── */
  if (data.type === 'student') {
    const { student, report } = data;
    const scored = (report || []).filter(r => r.marks_obtained != null);
    const totalObt = scored.reduce((s, r) => s + r.marks_obtained, 0);
    const totalMax = scored.reduce((s, r) => s + r.max_marks, 0);
    const pct = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : null;
    const overallGrade = pct != null ? getGrade(totalObt, totalMax) : 'N/A';
    const gpa = overallGrade !== 'N/A' ? gradeToGPA(overallGrade) : null;

    // per-course summary
    const byCourse = {};
    scored.forEach(r => {
      if (!byCourse[r.course]) byCourse[r.course] = { obt: 0, max: 0 };
      byCourse[r.course].obt += r.marks_obtained;
      byCourse[r.course].max += r.max_marks;
    });
    const courseCount = Object.keys(byCourse).length;

    return (
      <div style={{ ...card }} className="fade-up">
        {/* Transcript header — formal document style */}
        <div style={{
          borderBottom: `2px solid ${C.border}`,
          paddingBottom: 20, marginBottom: 20,
          background: dark ? 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(167,139,250,0.04))' : 'linear-gradient(135deg,rgba(99,102,241,0.04),rgba(167,139,250,0.02))',
          borderRadius: 12, padding: 20, margin: '-4px -4px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(99,102,241,0.3)' }}>
                <GraduationCap size={24} color="#fff" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.accent }}>Academic Transcript</p>
                <h2 style={{ margin: '3px 0 1px', fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "'Sora',sans-serif" }}>{student?.name}</h2>
                <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{student?.email}</p>
              </div>
            </div>

            {/* Grade summary boxes */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Score', value: pct != null ? `${pct}%` : '—', color: pctColor(pct) },
                { label: 'Grade', value: overallGrade, color: pctColor(pct) },
                { label: 'GPA', value: gpa != null ? gpa.toFixed(1) : '—', color: '#a78bfa' },
                { label: 'Courses', value: courseCount, color: C.textMuted },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '10px 14px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, minWidth: 58 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-course progress bars */}
          {courseCount > 0 && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
              {Object.entries(byCourse).map(([course, { obt, max }]) => {
                const cp = Math.round((obt / max) * 100);
                return (
                  <div key={course} style={{ padding: '10px 12px', background: C.surface, borderRadius: 9, border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.text, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: pctColor(cp) }}>{cp}%</span>
                    </div>
                    <MiniBar value={cp} max={100} color={pctColor(cp)} height={5} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {report.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <AlertCircle size={28} color={C.textDim} style={{ marginBottom: 8 }} />
            <p style={{ color: C.textMuted, margin: 0, fontSize: 13 }}>No assessments found for the selected filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Course', 'Assessment', 'Type', 'Term', 'Marks', 'Max', 'Score', 'Grade', 'Remarks'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.map((r, i) => {
                  const pctR = r.marks_obtained != null ? Math.round((r.marks_obtained / r.max_marks) * 100) : null;
                  return (
                    <tr key={i}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      style={{ transition: 'background 0.1s' }}
                    >
                      <td style={{ ...td, fontWeight: 600, color: C.accent }}>{r.course}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.title}</td>
                      <td style={td}><TypeBadge type={r.type} dark={dark} /></td>
                      <td style={{ ...td, fontSize: 12, color: C.textMuted }}>{r.term}</td>
                      <td style={{ ...td, fontWeight: 800, color: pctColor(pctR), fontFamily: 'monospace' }}>{r.marks_obtained ?? '—'}</td>
                      <td style={{ ...td, color: C.textMuted, fontFamily: 'monospace' }}>{r.max_marks}</td>
                      <td style={{ ...td }}>
                        {pctR != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                            <div style={{ flex: 1 }}><MiniBar value={pctR} color={pctColor(pctR)} /></div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(pctR) }}>{pctR}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={td}><GradeBadge grade={pctR != null ? getGrade(r.marks_obtained, r.max_marks) : 'N/A'} /></td>
                      <td style={{ ...td, color: C.textMuted, fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.remarks || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ── Assessment report ── */
  if (data.type === 'assessment') {
    const { assessment, students } = data;
    const gradedStudents = students.filter(s => s.percentage != null);
    const avg = gradedStudents.length ? Math.round(gradedStudents.reduce((s, x) => s + x.percentage, 0) / gradedStudents.length) : null;
    const highest = gradedStudents.length ? Math.max(...gradedStudents.map(s => s.percentage)) : null;
    const lowest = gradedStudents.length ? Math.min(...gradedStudents.map(s => s.percentage)) : null;
    const passRate = gradedStudents.length ? Math.round((gradedStudents.filter(s => s.percentage >= 50).length / gradedStudents.length) * 100) : null;

    return (
      <div style={{ ...card }} className="fade-up">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={21} color={C.gold} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gold }}>Assessment Report</p>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "'Sora',sans-serif" }}>{assessment?.title}</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>📚 {assessment?.course_id?.name}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>📅 {assessment?.term}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>🗓️ {assessment?.academic_year}</span>
              <TypeBadge type={assessment?.type} dark={dark} />
            </div>
          </div>
        </div>

        {/* Analytics strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Class Average', value: avg != null ? avg + '%' : '—', color: pctColor(avg), icon: BarChart2 },
            { label: 'Highest Score', value: highest != null ? highest + '%' : '—', color: '#10b981', icon: TrendingUp },
            { label: 'Lowest Score', value: lowest != null ? lowest + '%' : '—', color: '#ef4444', icon: ChevronDown },
            { label: 'Pass Rate', value: passRate != null ? passRate + '%' : '—', color: '#6366f1', icon: CheckCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ padding: '12px 14px', background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}`, textAlign: 'center' }}>
              <Icon size={14} color={color} style={{ marginBottom: 5 }} />
              <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'Sora',sans-serif" }}>{value}</div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Rank', 'Student', 'Email', 'Marks', 'Max', 'Score', 'Grade', 'Remarks'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {[...students].sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)).map((s, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ transition: 'background 0.1s' }}
                >
                  <td style={{ ...td, width: 48 }}>
                    {i < 3 ? (
                      <span style={{ fontSize: 14 }}>{['🥇', '🥈', '🥉'][i]}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace', fontWeight: 600 }}>#{i + 1}</span>
                    )}
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{s.student_name}</td>
                  <td style={{ ...td, fontSize: 12, color: C.textMuted }}>{s.student_email}</td>
                  <td style={{ ...td, fontWeight: 800, color: pctColor(s.percentage), fontFamily: 'monospace' }}>{s.marks_obtained ?? '—'}</td>
                  <td style={{ ...td, color: C.textMuted, fontFamily: 'monospace' }}>{s.max_marks}</td>
                  <td style={{ ...td }}>
                    {s.percentage != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                        <div style={{ flex: 1 }}><MiniBar value={s.percentage} color={pctColor(s.percentage)} /></div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(s.percentage) }}>{s.percentage}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={td}><GradeBadge grade={s.grade} /></td>
                  <td style={{ ...td, color: C.textMuted, fontSize: 12 }}>{s.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ── Class report ── */
  if (data.type === 'class') {
    const { class: cls, assessments: aList, students: sList } = data;
    const sorted = [...(sList || [])].sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));
    const graded = sorted.filter(s => s.percentage != null);
    const classAvg = graded.length ? Math.round(graded.reduce((s, x) => s + x.percentage, 0) / graded.length) : null;
    const passCount = graded.filter(s => s.percentage >= 50).length;

    return (
      <div style={{ ...card }} className="fade-up">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.emeraldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={21} color={C.emerald} />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.emerald }}>Class Report</p>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "'Sora',sans-serif" }}>{cls?.name}</h2>
            <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{sList?.length} enrolled · {aList?.length} assessments</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Class Average', value: classAvg != null ? classAvg + '%' : '—', color: pctColor(classAvg) },
            { label: 'Students Passing', value: `${passCount}/${graded.length}`, color: '#10b981' },
            { label: 'Assessments', value: aList?.length ?? 0, color: '#6366f1' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '12px', background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Sora',sans-serif" }}>{value}</div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Rank', 'Student', 'Total Marks', 'Score', 'Grade'].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ transition: 'background 0.1s' }}
                >
                  <td style={{ ...td, width: 52 }}>
                    {i < 3 ? (
                      <span style={{ fontSize: 14 }}>{['🥇', '🥈', '🥉'][i]}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace' }}>#{i + 1}</span>
                    )}
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.accent, flexShrink: 0 }}>
                        {(s.name || '?')[0].toUpperCase()}
                      </div>
                      {s.name}
                    </div>
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{s.total_obtained} / {s.total_max}</td>
                  <td style={{ ...td }}>
                    {s.percentage != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                        <div style={{ flex: 1 }}><MiniBar value={s.percentage} color={pctColor(s.percentage)} /></div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(s.percentage) }}>{s.percentage}%</span>
                      </div>
                    ) : <span style={{ color: C.textDim, fontSize: 12 }}>—</span>}
                  </td>
                  <td style={td}><GradeBadge grade={s.grade} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────
   Badges
──────────────────────────────────────────────────────────────────*/
function TypeBadge({ type, dark }) {
  const isFA = type === 'FA';
  const color = isFA ? '#3b82f6' : '#8b5cf6';
  const label = isFA ? 'Formative' : 'Continuous';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: color + '18', color, border: `1px solid ${color}30`,
      letterSpacing: '0.04em',
    }}>{label}</span>
  );
}

function GradeBadge({ grade }) {
  const color = grade === 'A+' || grade === 'A' ? '#10b981'
    : grade === 'B' ? '#6366f1'
    : grade === 'C' ? '#f59e0b'
    : grade === 'D' ? '#f97316'
    : grade === 'F' ? '#ef4444'
    : '#64748b';
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 7,
      background: color + '18', color, border: `1px solid ${color}30`,
      fontFamily: "'Sora',sans-serif",
    }}>{grade}</span>
  );
}