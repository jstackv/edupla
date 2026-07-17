/**
 * TeacherAssessments.jsx
 *
 * VISUAL / UX PASS — same data flow, same API contract, same business rules.
 * Nothing about how assessments are created, validated, saved, or submitted
 * has changed. What changed:
 *
 * 1. Design system — a small "gradebook" token set (deep navy + warm gold
 *    "mastery" accent + teal/violet utility accents), Sora for display type,
 *    Inter for body, JetBrains Mono for marks/numbers.
 * 2. Signature element — a circular "mastery ring" used everywhere progress
 *    is shown (table rows + the marks modal), instead of a generic bar.
 * 3. The create/edit flow is now an explicit connected step-wizard with a
 *    fill-in progress rail, so "step 1 of 4" is something you can *see*.
 * 4. Table gains client-side search + sortable columns + class/status
 *    filter chips — additive, no backend changes, nothing here can produce
 *    a different server request than before.
 * 5. Micro-interactions throughout: staggered row entrance, hover lift,
 *    focus-visible rings, animated counters on the stat pills, a small
 *    "mastery" celebration state when every student has a mark.
 * 6. prefers-reduced-motion is respected — every animation collapses to an
 *    instant state change for people who've asked for that.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/common/ConfirmModal';
import {
  Plus, Edit2, Trash2, X, BookOpen, FileText, Users,
  ChevronRight, Send, Save, Clock, CheckCircle, XCircle,
  AlertCircle, School, GraduationCap, RefreshCw,
  Download, Upload, TrendingUp, Search, ArrowUp, ArrowDown,
  ArrowUpDown, Sparkles, Filter, X as XSmall, Eraser,
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
  { key: 'FA', label: 'Formative Assessment',     color: '#2563eb', desc: 'Ongoing evaluation during the learning process' },
  { key: 'IA', label: 'Integrated Assessment',    color: '#0d9488', desc: 'Holistic evaluation across multiple competencies' },
  { key: 'CA', label: 'Comprehensive Assessment', color: '#7c3aed', desc: 'End-of-term summative evaluation' },
];

/* ─────────── Design tokens ("gradebook" system) ───────────
   Deep navy stays the anchor (it's the school brand), a warm gold
   "mastery" accent stands in for anything achievement/completion related
   (rings, celebration states), teal + violet stay as the two bulk-action
   accents already established by the download/upload buttons.          */
const T = {
  navyDeep:  '#0c1f3d',
  navy:      '#1a3a6b',
  blue:      '#1565c0',
  blueBright:'#2563eb',
  teal:      '#0d9488',
  tealBright:'#14b8a6',
  violet:    '#7c3aed',
  violetBright:'#a855f7',
  gold:      '#c9910a',
  goldBright:'#f0b429',
  green:     '#10b981',
  amber:     '#f59e0b',
  red:       '#ef4444',
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');`;

const GLOBAL_KEYFRAMES = `
  ${FONT_IMPORT}
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
  @keyframes popCheck { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  @keyframes ringDraw { from { stroke-dashoffset: var(--ring-start); } to { stroke-dashoffset: var(--ring-end); } }
  @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(201,145,10,0.35); } 50% { box-shadow: 0 0 0 8px rgba(201,145,10,0); } }
  @keyframes sparklePulse { 0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; } 50% { transform: scale(1.2) rotate(12deg); opacity: 0.7; } }
  @keyframes slideInRight { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes floatIcon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes underlineGrow { from { width: 0; } to { width: 100%; } }

  .ta-root, .ta-root * { font-family: 'Inter', system-ui, sans-serif; }
  .ta-display { font-family: 'Sora', 'Inter', system-ui, sans-serif; }
  .ta-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

  .ta-row-enter { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .ta-card-enter { animation: scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) both; }
  .ta-step-enter { animation: fadeUp 0.28s cubic-bezier(0.16,1,0.3,1) both; }
  .ta-check-pop { animation: popCheck 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
  .ta-slide-in { animation: slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) both; }

  .ta-btn { transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease, background 0.16s ease, border-color 0.16s ease, opacity 0.16s ease; }
  .ta-btn:hover:not(:disabled) { transform: translateY(-1.5px); filter: brightness(1.04); }
  .ta-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(0.97); }

  .ta-row { transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
  .ta-icon-btn { transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
  .ta-icon-btn:hover:not(:disabled) { transform: translateY(-1px); }

  .ta-option-card { transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease; }
  .ta-option-card:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(15,23,42,0.08); }

  .ta-input-focus:focus { transform: translateY(-1px); }

  .ta-skel { background-image: linear-gradient(90deg, rgba(148,163,184,0.10) 0px, rgba(148,163,184,0.22) 40px, rgba(148,163,184,0.10) 80px); background-size: 600px 100%; animation: shimmer 1.5s infinite linear; }

  .ta-root *:focus-visible { outline: 2.5px solid #2563eb; outline-offset: 2px; border-radius: 6px; }

  .ta-mastery-badge { animation: pulseGlow 2.2s ease-in-out infinite; }
  .ta-sparkle { animation: sparklePulse 1.6s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    .ta-root, .ta-root * { animation-duration: 0.001s !important; animation-iteration-count: 1 !important; transition-duration: 0.001s !important; }
  }
`;

/* ─────────── Tiny helpers ─────────── */
function pctColor(pct) {
  if (pct == null) return '#374151';
  if (pct >= 70) return T.green;
  if (pct >= 50) return T.amber;
  return T.red;
}

function ringColor(pct) {
  if (pct >= 100) return T.gold;
  if (pct >= 50) return T.blueBright;
  return '#94a3b8';
}

/* Animated count-up number — purely presentational, no data implications. */
function AnimatedNumber({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) { setDisplay(to); return; }
    let raf;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display}</>;
}

/* Signature element: circular "mastery ring" — used for per-row progress
   in the table and, larger, at the top of the marks modal.             */
function ProgressRing({ pct = 0, size = 34, stroke = 4, color, dark, showLabel = false }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const ringCol = color || ringColor(clamped);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? '#232a3d' : '#eef0f4'} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={ringCol} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          style={{
            '--ring-start': c, '--ring-end': offset,
            strokeDashoffset: offset,
            animation: 'ringDraw 0.8s cubic-bezier(0.16,1,0.3,1) both',
            transition: 'stroke 0.3s ease',
          }}
        />
      </svg>
      {showLabel && (
        <div className="ta-mono" style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size > 60 ? 16 : 9.5, fontWeight: 700, color: dark ? '#e2e8f0' : '#1f2937',
        }}>
          {clamped}%
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }) {
  const found = ASSESSMENT_TYPES.find(t => t.key === type);
  const color = found?.color || '#9ca3af';
  return (
    <span title={found?.label || type} style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
      background: color + '20', color, border: '1px solid ' + color + '40',
      letterSpacing: '0.03em',
    }}>{type}</span>
  );
}

function StatusBadge({ status }) {
  const map = {
    draft:     { label: 'Draft',     color: '#9ca3af', Icon: Clock },
    submitted: { label: 'Submitted', color: T.amber,   Icon: Clock },
    approved:  { label: 'Approved',  color: T.green,   Icon: CheckCircle },
    rejected:  { label: 'Rejected',  color: T.red,     Icon: XCircle },
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

/* Skeleton row used while the table is loading — replaces the plain
   full-page spinner with something that mirrors the eventual layout. */
function SkeletonRow({ dark, i }) {
  const cellStyle = { padding: '13px 14px' };
  const bar = (w, h = 12) => (
    <div className="ta-skel" style={{ width: w, height: h, borderRadius: 6, background: dark ? '#1c2233' : '#eef0f4' }} />
  );
  return (
    <tr style={{ borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}`, opacity: 1 - i * 0.08 }}>
      <td style={cellStyle}>{bar(140)}</td>
      <td style={cellStyle}>{bar(90)}</td>
      <td style={cellStyle}>{bar(110)}</td>
      <td style={cellStyle}>{bar(34)}</td>
      <td style={cellStyle}>{bar(60)}</td>
      <td style={cellStyle}>{bar(70)}</td>
      <td style={cellStyle}>{bar(90)}</td>
      <td style={cellStyle}>{bar(80)}</td>
      <td style={cellStyle}>{bar(120)}</td>
    </tr>
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
  const [refreshSpin, setRefreshSpin] = useState(false);

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
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [marksUploading, setMarksUploading]           = useState(false);
  const [sortedByPerformance, setSortedByPerformance] = useState(false);
  const fileInputRef = useRef(null);

  /* ── Confirm modal ── */
  const [confirmModal, setConfirmModal] = useState({ open: false });

  /* ── NEW: table search / sort / filter (client-side only — the API
     request made by fetchData() never changes because of these). ── */
  const [searchQuery, setSearchQuery]   = useState('');
  const [classFilter, setClassFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig]     = useState({ key: null, dir: 'asc' });

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
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
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

  function handleRefreshClick() {
    setRefreshSpin(true);
    fetchData().finally(() => setTimeout(() => setRefreshSpin(false), 500));
  }

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
     Checks course_id + class_id + type + term + academic_year, excluding
     the current editingId. A module assigned to several classes can have
     its own independent assessment per class, so the class is part of the
     duplicate check — an assessment created for one class never blocks the
     same type from being created for a different class. */
  function isTypeUsed(typeKey) {
    if (!form.selectedClassId || !form.course_id || !form.term || !form.academic_year) return false;
    return assessments.some(a =>
      String(a.course_id?._id || a.course_id) === String(form.course_id) &&
      String(a.class_id?._id || a.class_id) === String(form.selectedClassId) &&
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
    const classId = a.class_id?._id || a.class_id || '';
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
    if (!form.selectedClassId) { toast.error('Please select a class'); return; }
    if (!form.course_id)      { toast.error('Please select a module'); return; }
    if (!form.type)           { toast.error('Please select an assessment type'); return; }
    if (!form.term)           { toast.error('Please select a term'); return; }
    if (!form.academic_year)  { toast.error('Please select an academic year'); return; }

    /* ── Duplicate guard — scoped to the selected class. An assessment
       created for one class never blocks the same module/type/term/year
       combo from being created for a different class. ── */
    const duplicate = assessments.find(a =>
      String(a.course_id?._id || a.course_id) === String(form.course_id) &&
      String(a.class_id?._id || a.class_id) === String(form.selectedClassId) &&
      a.type === form.type &&
      a.term === form.term &&
      a.academic_year === form.academic_year &&
      (a._id || a.id) !== editingId
    );
    if (duplicate) {
      toast.error(
        `A "${ASSESSMENT_TYPES.find(t => t.key === form.type)?.label || form.type}" already exists for this module/class in ${form.term} ${form.academic_year}.`
      );
      return;
    }

    const autoTitle = ASSESSMENT_TYPES.find(t => t.key === form.type)?.label || form.type;
    const payload = {
      title: autoTitle,
      course_id: form.course_id,
      class_id: form.selectedClassId,
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
    setSortedByPerformance(false);
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
     a non-blank mark entered in marksData. Drives the progress ring at
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
      message: `${markingProgress.missingStudents.length} of ${markingProgress.total} student${markingProgress.total === 1 ? '' : 's'} still need marks entered before you can submit for review: ${preview}.`,
      confirmText: 'Got it',
      onConfirm: closeConfirm,
    });
    return true;
  }

  /* ── Save marks as draft.
     Saving is always allowed — even with no marks recorded at all — so a
     teacher can clear marks back out (e.g. to delete the assessment, which
     requires zero marks recorded). Only Submit for Review requires every
     student to have a mark (see blockIfIncomplete() in submitMarks below). ── */
  async function saveDraft() {
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

  /* ── Clear all marks (with confirmation).
     Blanks out every student's mark in local state only — nothing is sent
     to the server until the teacher clicks Save Draft or Submit, exactly
     like typing over a mark by hand. Lets a teacher wipe a fully-filled
     sheet in one action instead of clearing each field individually. ── */
  function confirmClearAllMarks() {
    if (!marksModal) return;
    const total = markingProgress.total;
    const filledCount = markingProgress.markedCount;
    if (filledCount === 0) return;
    openConfirm({
      variant: 'danger',
      title: 'Clear All Marks',
      message: `This will clear all ${filledCount} entered mark${filledCount === 1 ? '' : 's'} out of ${total} student${total === 1 ? '' : 's'}. Nothing is saved until you click "Save Draft" afterward, but any unsaved marks currently on screen will be lost. Continue?`,
      confirmText: 'Yes, Clear All',
      onConfirm: () => {
        const cleared = {};
        (marksModal.students || []).forEach(s => { cleared[s.student_id] = ''; });
        setMarksData(cleared);
        toast.success('All marks cleared — click "Save Draft" to make this permanent');
        closeConfirm();
      },
    });
  }

  /* ── Download the fillable Excel template for this assessment.
     Students are listed ascending by name (server-side), with any marks
     already recorded pre-filled in. ── */
  async function downloadTemplate() {
    if (!marksModal?.assessment?._id) return;
    setTemplateDownloading(true);
    try {
      const res = await api.get(
        '/assessment/teacher/assessments/' + marksModal.assessment._id + '/marks/template',
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cls = (marksModal.assessment?.class_id?.name || 'class').replace(/[^a-z0-9]+/gi, '-');
      a.download = `marks-template-${marksModal.assessment.type}-${cls}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // The blob response may contain a JSON error — try to read it.
      let message = 'Failed to download template';
      if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          message = JSON.parse(text)?.message || message;
        } catch { /* ignore parse failure, use default message */ }
      } else {
        message = e.response?.data?.message || message;
      }
      toast.error(message);
    } finally { setTemplateDownloading(false); }
  }

  /* ── Upload a filled-in Excel template. On success, the marks table is
     refilled with the uploaded values and re-sorted by performance (marks
     obtained, highest first) as required — the ascending-by-name order is
     only the default before marks are recorded. ── */
  async function handleUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!marksModal?.assessment?._id) return;

    setMarksUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(
        '/assessment/teacher/assessments/' + marksModal.assessment._id + '/marks/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const { students, errors, updated, message } = res.data;

      const newMarks = {};
      students.forEach(s => { newMarks[s.student_id] = s.marks ?? ''; });
      setMarksData(newMarks);
      setMarksModal(prev => ({ ...prev, students }));
      setSortedByPerformance(true);

      if (errors && errors.length > 0) {
        toast.error(`${message} (${updated} mark${updated === 1 ? '' : 's'} applied)`, { duration: 6000 });
        console.warn('Marks upload issues:', errors);
      } else {
        toast.success(`${message} — ${updated} mark${updated === 1 ? '' : 's'} applied`);
      }
    } catch (e2) {
      toast.error(e2.response?.data?.message || 'Failed to upload marks');
    } finally {
      setMarksUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  /* ── NEW: derived, client-side-only table view. Search / class filter /
     status filter / column sort. This never touches the API — it only
     narrows or reorders what's already in `assessments`. ── */
  const visibleAssessments = useMemo(() => {
    let rows = [...assessments];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.course_id?.name || '').toLowerCase().includes(q) ||
        (a.class_id?.name || '').toLowerCase().includes(q) ||
        (a.type || '').toLowerCase().includes(q)
      );
    }
    if (classFilter !== 'all') {
      rows = rows.filter(a => String(a.class_id?._id || a.class_id) === classFilter);
    }
    if (statusFilter !== 'all') {
      rows = rows.filter(a => a.submission_status === statusFilter);
    }
    if (sortConfig.key) {
      const dir = sortConfig.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        let av, bv;
        switch (sortConfig.key) {
          case 'title':    av = a.title || '';                 bv = b.title || ''; break;
          case 'class':    av = a.class_id?.name || '';         bv = b.class_id?.name || ''; break;
          case 'module':   av = a.course_id?.name || '';        bv = b.course_id?.name || ''; break;
          case 'type':     av = a.type || '';                   bv = b.type || ''; break;
          case 'term':     av = a.term || '';                   bv = b.term || ''; break;
          case 'year':     av = a.academic_year || '';          bv = b.academic_year || ''; break;
          case 'progress': av = a.student_count ? a.marked_count / a.student_count : 0;
                            bv = b.student_count ? b.marked_count / b.student_count : 0; break;
          case 'status':   av = a.submission_status || '';      bv = b.submission_status || ''; break;
          default: av = ''; bv = '';
        }
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    }
    return rows;
  }, [assessments, searchQuery, classFilter, statusFilter, sortConfig]);

  function toggleSort(key) {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: 'asc' };
    });
  }

  function SortHeader({ label, sortKey, align = 'left' }) {
    const active = sortConfig.key === sortKey;
    const Icon = !active ? ArrowUpDown : (sortConfig.dir === 'asc' ? ArrowUp : ArrowDown);
    return (
      <th
        onClick={() => toggleSort(sortKey)}
        tabIndex={0}
        role="button"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleSort(sortKey); }}
        style={{
          padding: '11px 14px', background: dark ? '#1a1f2e' : '#f9fafb',
          color: active ? T.blueBright : (dark ? '#7b839a' : '#6b7280'),
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
          textAlign: align, borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
          cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {label} <Icon size={11} style={{ opacity: active ? 1 : 0.5 }} />
        </span>
      </th>
    );
  }

  const hasActiveFilters = searchQuery.trim() || classFilter !== 'all' || statusFilter !== 'all';

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="ta-root">
      <style>{GLOBAL_KEYFRAMES}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 18px ${T.navy}55`,
            animation: 'floatIcon 4s ease-in-out infinite',
          }}>
            <FileText size={21} color="#fff" />
          </div>
          <div>
            <h1 className="ta-display" style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em', color: dark ? '#f1f5f9' : '#111827' }}>
              My Assessments
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: dark ? '#7b839a' : '#6b7280' }}>
              Create and manage assessments for your assigned modules
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="ta-btn ta-icon-btn"
            onClick={handleRefreshClick}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#7b839a' : '#6b7280', fontSize: 13, cursor: 'pointer' }}
          >
            <RefreshCw size={13} style={{ animation: refreshSpin ? 'spin 0.6s linear' : 'none' }} /> Refresh
          </button>
          <button
            className="ta-btn"
            onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 16px ${T.navy}59` }}
          >
            <Plus size={14} /> New Assessment
          </button>
        </div>
      </div>

      {/* ── Stats pills ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Total',     val: assessments.length,                                              color: T.navy },
          { label: 'Draft',     val: assessments.filter(a => a.submission_status === 'draft').length,     color: '#9ca3af' },
          { label: 'Submitted', val: assessments.filter(a => a.submission_status === 'submitted').length, color: T.amber },
          { label: 'Approved',  val: assessments.filter(a => a.submission_status === 'approved').length,  color: T.green },
          { label: 'Rejected',  val: assessments.filter(a => a.submission_status === 'rejected').length,  color: T.red },
        ].map((s, i) => (
          <div key={s.label} className="ta-card-enter ta-btn" style={{ animationDelay: `${i * 0.05}s`, padding: '9px 16px', borderRadius: 12, background: s.color + '13', border: `1px solid ${s.color}30`, display: 'flex', gap: 9, alignItems: 'center', cursor: 'default' }}>
            <span className="ta-mono" style={{ fontSize: 17, fontWeight: 700, color: s.color }}><AnimatedNumber value={s.val} /></span>
            <span style={{ fontSize: 11, fontWeight: 600, color: dark ? '#7b839a' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Search + filters ── */}
      {!loading && assessments.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200, maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: dark ? '#5b6377' : '#9ca3af' }} />
            <input
              className="ta-input-focus"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search title, module, class, type…"
              style={{ ...inp, paddingLeft: 32, paddingRight: searchQuery ? 30 : 12 }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: dark ? '#7b839a' : '#9ca3af', display: 'flex' }}>
                <XSmall size={14} />
              </button>
            )}
          </div>

          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 140 }}>
            <option value="all">All classes</option>
            {teacherClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 140 }}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearchQuery(''); setClassFilter('all'); setStatusFilter('all'); }}
              className="ta-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 9, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#7b839a' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <Filter size={12} /> Clear filters
            </button>
          )}

          <span style={{ fontSize: 12, color: dark ? '#5b6377' : '#9ca3af', marginLeft: 'auto' }}>
            {visibleAssessments.length} of {assessments.length}
          </span>
        </div>
      )}

      {/* ── Assessment list ── */}
      {loading ? (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Assessment', 'Class', 'Module', 'Type', 'Term', 'Year', 'Progress', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} dark={dark} i={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : assessments.length === 0 ? (
        <div className="ta-card-enter" style={{ ...card, textAlign: 'center', padding: 60 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'floatIcon 3.5s ease-in-out infinite' }}><FileText size={28} color="#fff" /></div>
          <p className="ta-display" style={{ color: dark ? '#e8ecf4' : '#111827', fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>No Assessments Yet</p>
          <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: '0 0 20px' }}>Create your first assessment to start recording marks.</p>
          <button className="ta-btn" onClick={openCreate} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />New Assessment
          </button>
        </div>
      ) : visibleAssessments.length === 0 ? (
        <div className="ta-card-enter" style={{ ...card, textAlign: 'center', padding: 50 }}>
          <Search size={30} color={dark ? '#3a4258' : '#d1d5db'} style={{ marginBottom: 12 }} />
          <p style={{ color: dark ? '#e8ecf4' : '#111827', fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>No matches</p>
          <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: '0 0 16px', fontSize: 13 }}>Try a different search term or clear your filters.</p>
          <button onClick={() => { setSearchQuery(''); setClassFilter('all'); setStatusFilter('all'); }} className="ta-btn" style={{ padding: '8px 16px', borderRadius: 9, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#e2e8f0' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <SortHeader label="Assessment" sortKey="title" />
                  <SortHeader label="Class" sortKey="class" />
                  <SortHeader label="Module" sortKey="module" />
                  <SortHeader label="Type" sortKey="type" />
                  <SortHeader label="Term" sortKey="term" />
                  <SortHeader label="Year" sortKey="year" />
                  <SortHeader label="Progress" sortKey="progress" />
                  <SortHeader label="Status" sortKey="status" />
                  <th style={{ padding: '11px 14px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAssessments.map((a, i) => {
                  const isLocked = a.submission_status === 'submitted' || a.submission_status === 'approved';
                  const progressPct = a.student_count > 0 ? Math.round((a.marked_count / a.student_count) * 100) : 0;
                  return (
                    <tr
                      key={a._id || a.id}
                      className="ta-row-enter ta-row"
                      style={{ animationDelay: `${Math.min(i, 10) * 0.035}s`, background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'), borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}` }}
                      onMouseEnter={e => { e.currentTarget.style.background = dark ? '#1a1f2e88' : '#f4f7ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'); }}
                    >
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: dark ? '#e8ecf4' : '#111827' }}>{a.title}</div>
                        {a.review_note && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <AlertCircle size={10} color={T.red} />
                            <span style={{ fontSize: 11, color: T.red }}>{a.review_note}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: `${T.navy}14`, border: `1px solid ${T.navy}33`, color: T.navy }}>
                          <School size={10} />
                          {a.class_id?.name || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>
                        <div>{a.course_id?.name || '—'}</div>
                      </td>
                      <td style={{ padding: '11px 14px' }}><TypeBadge type={a.type} /></td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.term}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.academic_year}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <ProgressRing pct={progressPct} size={30} stroke={3.5} dark={dark} />
                          <span className="ta-mono" style={{ fontSize: 11, fontWeight: 600, color: dark ? '#7b839a' : '#6b7280', whiteSpace: 'nowrap' }}>{a.marked_count}/{a.student_count}</span>
                          {progressPct === 100 && <Sparkles size={12} color={T.gold} className="ta-sparkle" />}
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px' }}><StatusBadge status={a.submission_status} /></td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="ta-btn ta-icon-btn" onClick={() => openMarks(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <Users size={11} /> Marks
                          </button>
                          {!isLocked && (
                            <>
                              <button className="ta-btn ta-icon-btn" onClick={() => openEdit(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                <Edit2 size={11} /> Edit
                              </button>
                              <button className="ta-btn ta-icon-btn" onClick={() => confirmDelete(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: T.red, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
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
          CREATE / EDIT ASSESSMENT MODAL — step wizard
          Steps: (1) class → (2) module → (3) term/year → (4) type
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,11,20,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.18s ease' }}
        >
          <div className="ta-card-enter" style={{ width: 560, borderRadius: 22, background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`, padding: 30, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 className="ta-display" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>
                  {editingId ? 'Edit Assessment' : 'New Assessment'}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>
                  {editingId ? 'Update assessment details' : 'Select a class and module, then configure the assessment'}
                </p>
              </div>
              <button className="ta-btn" onClick={() => setShowModal(false)} style={{ border: 'none', background: dark ? '#1e2130' : '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={16} color={dark ? '#94a3b8' : '#6b7280'} />
              </button>
            </div>

            {/* Step rail */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, padding: '0 4px' }}>
              {[
                { n: 1, label: 'Class',    done: !!form.selectedClassId },
                { n: 2, label: 'Module',   done: !!form.course_id },
                { n: 3, label: 'Term',     done: !!form.term && !!form.academic_year },
                { n: 4, label: 'Type',     done: !!form.type },
              ].map((step, idx, arr) => (
                <div key={step.n} style={{ display: 'flex', alignItems: 'center', flex: idx < arr.length - 1 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, flexShrink: 0, transition: 'all 0.25s ease',
                      background: step.done ? T.blueBright : (dark ? '#1e2130' : '#f1f5f9'),
                      color: step.done ? '#fff' : (dark ? '#7b839a' : '#9ca3af'),
                      border: step.done ? 'none' : `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                    }}>
                      {step.done ? <CheckCircle size={14} className="ta-check-pop" /> : step.n}
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: step.done ? T.blueBright : (dark ? '#5b6377' : '#9ca3af'), whiteSpace: 'nowrap' }}>{step.label}</span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ flex: 1, height: 2, margin: '0 6px 15px', borderRadius: 1, background: dark ? '#1e2130' : '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: step.done ? '100%' : '0%', background: T.blueBright, transition: 'width 0.35s ease' }} />
                    </div>
                  )}
                </div>
              ))}
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
                          className="ta-option-card"
                          onClick={() => setForm(f => ({ ...f, selectedClassId: cls._id, course_id: '', type: '' }))}
                          style={{
                            padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                            border: `2px solid ${selected ? T.navy : (dark ? '#2a3042' : '#e5e7eb')}`,
                            background: selected ? `${T.navy}18` : 'transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <School size={13} color={selected ? T.navy : (dark ? '#7b839a' : '#9ca3af')} />
                            <span style={{ fontSize: 12, fontWeight: selected ? 800 : 500, color: selected ? T.navy : (dark ? '#e2e8f0' : '#374151') }}>{cls.name}</span>
                          </div>
                          {selected && <div className="ta-check-pop" style={{ marginTop: 4, fontSize: 10, color: T.navy, fontWeight: 700 }}>✓ Selected</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 2: Module picker */}
              {form.selectedClassId && (
                <div className="ta-step-enter">
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
                            className="ta-option-card"
                            onClick={() => setForm(f => ({ ...f, course_id: String(c._id || c.id), type: '' }))}
                            style={{
                              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                              border: `2px solid ${selected ? T.navy : (dark ? '#2a3042' : '#e5e7eb')}`,
                              background: selected ? `${T.navy}14` : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              {c.code && <div style={{ fontSize: 10, fontWeight: 800, color: selected ? T.navy : (dark ? '#7b839a' : '#9ca3af'), letterSpacing: '0.07em', marginBottom: 2 }}>{c.code}</div>}
                              <div style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? T.navy : (dark ? '#e2e8f0' : '#374151') }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af', marginTop: 2 }}>
                                {c.category} · Max: {c.total_marks || 100} marks
                              </div>
                            </div>
                            {selected && <CheckCircle size={16} color={T.navy} className="ta-check-pop" style={{ flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Term + Year (needed before type so duplicate check works) */}
              {form.course_id && (
                <div className="ta-step-enter" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Step 3 — Term *</label>
                    <select className="ta-input-focus" value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value, type: '' }))} style={inp}>
                      <option value="">Select term…</option>
                      {TERMS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Academic Year *</label>
                    <select className="ta-input-focus" value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value, type: '' }))} style={inp}>
                      {YEARS.map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 4: Assessment type — with duplicate guard */}
              {form.course_id && form.term && (
                <div className="ta-step-enter">
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
                          className="ta-option-card"
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
                          }}
                        >
                          <span style={{ minWidth: 30, textAlign: 'center', fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 6, background: t.color + '20', color: t.color, border: `1px solid ${t.color}40`, flexShrink: 0 }}>{t.key}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: selected ? 800 : 500, color: selected ? t.color : (dark ? '#e2e8f0' : '#374151') }}>{t.label}</div>
                            <div style={{ fontSize: 11, color: alreadyUsed ? T.red : (dark ? '#7b839a' : '#9ca3af'), marginTop: 1 }}>
                              {alreadyUsed
                                ? `⚠ Already created for this module · ${form.term} · ${form.academic_year}`
                                : t.desc}
                            </div>
                          </div>
                          {selected    && <CheckCircle size={16} color={t.color} className="ta-check-pop" style={{ flexShrink: 0 }} />}
                          {alreadyUsed && <span style={{ fontSize: 10, fontWeight: 800, color: T.red, flexShrink: 0, whiteSpace: 'nowrap' }}>Used</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Auto-title preview */}
                  {form.type && (
                    <div className="ta-step-enter" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 9, background: dark ? '#1a1f2e' : '#f0f9ff', border: `1px solid ${dark ? '#2a3042' : '#bae6fd'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <button className="ta-btn" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#94a3b8' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                className="ta-btn"
                onClick={saveAssessment}
                disabled={!form.course_id || !form.type || !form.term}
                style={{
                  flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                  background: (!form.course_id || !form.type || !form.term)
                    ? (dark ? '#2a3042' : '#e5e7eb')
                    : `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`,
                  color: (!form.course_id || !form.type || !form.term)
                    ? (dark ? '#4a5568' : '#9ca3af')
                    : '#fff',
                  fontSize: 13, fontWeight: 700,
                  cursor: (!form.course_id || !form.type || !form.term) ? 'not-allowed' : 'pointer',
                  boxShadow: (!form.course_id || !form.type || !form.term) ? 'none' : `0 4px 14px ${T.navy}59`,
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
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,11,20,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.18s ease' }}
        >
          <div className="ta-card-enter" style={{ width: 720, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 20, background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            {marksLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ width: 36, height: 36, border: `3px solid ${T.navy}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: dark ? '#7b839a' : '#9ca3af' }}>Loading marks…</p>
              </div>
            ) : (
              <>
                {/* ── Fixed top section: title/ring, bulk-entry, marking
                    progress. Stays in place while the roster below scrolls,
                    so you never lose track of who's still missing a mark. ── */}
                <div style={{ flexShrink: 0, padding: '28px 28px 16px', borderBottom: `1px solid ${dark ? '#1e2130' : '#eef0f4'}`, boxShadow: dark ? '0 4px 14px rgba(0,0,0,0.25)' : '0 4px 14px rgba(15,23,42,0.04)', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                    {!marksLocked && (
                      <ProgressRing pct={markingProgress.pct} size={56} stroke={5} dark={dark} showLabel />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <h3 className="ta-display" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>{marksModal.assessment?.title}</h3>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Module: <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{marksModal.assessment?.course_id?.name}</strong></span>
                        <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{marksModal.assessment?.term} · {marksModal.assessment?.academic_year}</span>
                        <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Max: <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{marksModal.assessment?.max_marks}</strong></span>
                        <StatusBadge status={marksModal.submission?.status} />
                      </div>
                      {marksModal.submission?.review_note && (
                        <div style={{ marginTop: 8, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <AlertCircle size={13} color={T.red} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span style={{ fontSize: 12, color: T.red }}><strong>Admin note:</strong> {marksModal.submission.review_note}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button className="ta-btn" onClick={() => setMarksModal(null)} style={{ border: 'none', background: dark ? '#1e2130' : '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={16} color={dark ? '#94a3b8' : '#6b7280'} />
                  </button>
                </div>

                {/* ── Excel template download / upload ── */}
                {!marksLocked && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    marginBottom: 16, padding: '12px 14px', borderRadius: 12,
                    background: dark
                      ? `linear-gradient(135deg, ${T.teal}1a, ${T.violet}1a)`
                      : `linear-gradient(135deg, ${T.teal}0f, ${T.violet}0f)`,
                    border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: dark ? '#7b839a' : '#6b7280', whiteSpace: 'nowrap' }}>
                      Bulk entry:
                    </span>
                    <button
                      className="ta-btn"
                      onClick={downloadTemplate}
                      disabled={templateDownloading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10,
                        border: 'none',
                        background: templateDownloading
                          ? (dark ? '#2a3042' : '#e5e7eb')
                          : `linear-gradient(135deg, ${T.teal}, ${T.tealBright})`,
                        color: templateDownloading ? (dark ? '#7b839a' : '#9ca3af') : '#fff',
                        fontSize: 12.5, fontWeight: 700,
                        cursor: templateDownloading ? 'default' : 'pointer',
                        boxShadow: templateDownloading ? 'none' : `0 4px 14px ${T.teal}59`,
                      }}
                    >
                      <Download size={14} /> {templateDownloading ? 'Preparing…' : 'Download Excel Template'}
                    </button>
                    <button
                      className="ta-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={marksUploading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10,
                        border: 'none',
                        background: marksUploading
                          ? (dark ? '#2a3042' : '#e5e7eb')
                          : `linear-gradient(135deg, ${T.violet}, ${T.violetBright})`,
                        color: marksUploading ? (dark ? '#7b839a' : '#9ca3af') : '#fff',
                        fontSize: 12.5, fontWeight: 700,
                        cursor: marksUploading ? 'default' : 'pointer',
                        boxShadow: marksUploading ? 'none' : `0 4px 14px ${T.violet}59`,
                      }}
                    >
                      <Upload size={14} /> {marksUploading ? 'Uploading…' : 'Upload Filled Sheet'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleUploadFile}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>
                      Download, fill in marks, then re-upload — the table below refills automatically.
                    </span>
                  </div>
                )}

                {sortedByPerformance && (
                  <div className="ta-slide-in" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
                    padding: '4px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700, color: T.violet,
                    background: `${T.violet}1a`, border: `1px solid ${T.violet}40`,
                  }}>
                    <TrendingUp size={13} /> Sorted by performance (highest marks first) after upload
                  </div>
                )}

                {/* ── Marking progress summary ── */}
                {!marksLocked && (
                  <div className={markingProgress.complete ? 'ta-mastery-badge' : ''} style={{
                    marginBottom: 0, padding: '12px 14px', borderRadius: 12,
                    background: markingProgress.complete ? `${T.gold}12` : (dark ? '#1a1f2e' : '#f9fafb'),
                    border: `1px solid ${markingProgress.complete ? `${T.gold}55` : (dark ? '#2a3042' : '#e5e7eb')}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: markingProgress.complete ? 0 : 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: markingProgress.complete ? T.gold : (dark ? '#e2e8f0' : '#374151') }}>
                        {markingProgress.complete ? <Sparkles size={13} className="ta-sparkle" /> : <Users size={13} />}
                        {markingProgress.complete ? 'All students marked — ready to submit' : 'Marking Progress'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="ta-mono" style={{ fontSize: 12, fontWeight: 800, color: markingProgress.complete ? T.gold : (dark ? '#7b839a' : '#6b7280') }}>
                          {markingProgress.markedCount}/{markingProgress.total} · {markingProgress.pct}%
                        </span>
                        <button
                          className="ta-btn"
                          onClick={confirmClearAllMarks}
                          disabled={markingProgress.markedCount === 0}
                          title="Clear every mark entered for this assessment"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7,
                            border: `1px solid ${markingProgress.markedCount === 0 ? (dark ? '#232a3d' : '#e5e7eb') : 'rgba(239,68,68,0.35)'}`,
                            background: markingProgress.markedCount === 0 ? 'transparent' : 'rgba(239,68,68,0.08)',
                            color: markingProgress.markedCount === 0 ? (dark ? '#3a4258' : '#c1c7d2') : T.red,
                            fontSize: 10.5, fontWeight: 700, cursor: markingProgress.markedCount === 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <Eraser size={11} /> Clear All
                        </button>
                      </span>
                    </div>
                    {!markingProgress.complete && (
                      <>
                        <div style={{ height: 8, borderRadius: 4, background: dark ? '#2a3042' : '#e5e7eb', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: markingProgress.pct + '%',
                            background: `linear-gradient(90deg, ${T.navy}, ${T.blueBright})`,
                            borderRadius: 4, transition: 'width 0.4s',
                          }} />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>
                          {markingProgress.total - markingProgress.markedCount} student{markingProgress.total - markingProgress.markedCount === 1 ? '' : 's'} still need a mark before you can submit for review. You can still save your progress as a draft.
                        </div>
                      </>
                    )}
                  </div>
                )}

                {marksLocked && (
                  <div style={{ marginBottom: 0, padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={14} color={T.amber} />
                    <span style={{ fontSize: 12, color: T.amber, fontWeight: 600 }}>
                      Marks are locked — this assessment has been {marksModal.submission?.status}. Contact admin to unlock.
                    </span>
                  </div>
                )}
                </div>

                {/* ── Scrollable middle section: only the roster scrolls.
                    Everything above (title, ring, bulk entry, progress)
                    and everything below (Save/Submit) stays fixed in view. ── */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 28px' }}>
                <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${dark ? '#1e2130' : '#eef0f4'}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#', 'Student', 'Marks', `Out of ${marksModal.assessment?.max_marks}`, '%'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textAlign: 'left', borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`, position: 'sticky', top: 0 }}>{h}</th>
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
                          <tr
                            key={s.student_id}
                            className="ta-row"
                            style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'), borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}` }}
                            onMouseEnter={e => { e.currentTarget.style.background = dark ? '#1a1f2e88' : '#f4f7ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'); }}
                          >
                            <td style={{ padding: '9px 12px', fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{i + 1}</td>
                            <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: dark ? '#e2e8f0' : '#374151' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {s.name}
                                {!marksLocked && missing && (
                                  <span style={{ fontSize: 9, fontWeight: 800, color: T.red, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '1px 6px', borderRadius: 5 }}>Missing</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <input
                                className="ta-input-focus ta-mono"
                                type="number"
                                min={0}
                                max={max}
                                value={raw ?? ''}
                                disabled={marksLocked}
                                onChange={e => setMarksData(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                                style={{
                                  width: 80, padding: '6px 10px', borderRadius: 8,
                                  border: `1px solid ${num != null && num > max ? T.red : (missing && !marksLocked ? T.amber : (dark ? '#2a3042' : '#d1d5db'))}`,
                                  background: marksLocked ? (dark ? '#0f1117' : '#f3f4f6') : (dark ? '#1a1f2e' : '#fff'),
                                  color: dark ? '#e2e8f0' : '#111827', fontSize: 13, outline: 'none',
                                  opacity: marksLocked ? 0.6 : 1,
                                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                                }}
                              />
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{max}</td>
                            <td className="ta-mono" style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: pctColor(pct) }}>{pct != null ? pct + '%' : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </div>

                {/* ── Fixed bottom section: Save/Submit always reachable,
                    never pushed off-screen by a long roster. ── */}
                {!marksLocked && (
                  <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '16px 28px 28px', borderTop: `1px solid ${dark ? '#1e2130' : '#eef0f4'}` }}>
                    <button className="ta-btn" onClick={saveDraft} disabled={marksSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <Save size={14} /> {marksSaving ? 'Saving…' : 'Save Draft'}
                    </button>
                    <button className="ta-btn" onClick={submitMarks} disabled={marksSaving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${T.navy}59` }}>
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