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
import AssessmentAttemptsModal from '../../components/common/AssessmentAttemptsModal';
import {
  Plus, Edit2, Trash2, X, BookOpen, FileText, Users,
  ChevronRight, Send, Save, Clock, CheckCircle, XCircle,
  AlertCircle, School, GraduationCap, RefreshCw,
  Download, Upload, TrendingUp, Search, ArrowUp, ArrowDown,
  ArrowUpDown, Sparkles, Filter, X as XSmall, Eraser,
  BarChart3, CalendarDays, Inbox, Lock,
  ArrowRight, Home, Layers,
} from 'lucide-react';

/* ─────────── Constants ─────────── */
const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const ASSESSMENT_TYPES = [
  { key: 'FA', label: 'Formative Assessment',     color: '#2563eb', desc: 'Ongoing evaluation during the learning process' },
  { key: 'IA', label: 'Integrated Assessment',    color: '#0d9488', desc: 'Holistic evaluation across multiple competencies' },
  { key: 'CA', label: 'Comprehensive Assessment', color: '#ea580c', desc: 'End-of-term summative evaluation' },
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
  violet:    '#ea580c',
  violetBright:'#f97316',
  gold:      '#c9910a',
  goldBright:'#f0b429',
  green:     '#10b981',
  amber:     '#f59e0b',
  red:       '#ef4444',
};

/* ─────────── Class / module tile palette — cycled for visual variety
   across the drill-down cards, reusing the same design tokens as the
   rest of the page so nothing feels bolted on. ─────────── */
const TILE_PALETTE = [
  { grad: [T.navy, T.blueBright],     solid: T.blueBright,   soft: `${T.blueBright}16` },
  { grad: [T.teal, T.tealBright],     solid: T.tealBright,   soft: `${T.tealBright}16` },
  { grad: [T.violet, T.violetBright], solid: T.violetBright, soft: `${T.violetBright}16` },
  { grad: ['#a8720a', T.goldBright],  solid: T.goldBright,   soft: `${T.goldBright}1c` },
];

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

  /* ── NEW: drill-down tiles (classes → modules) — softer, smoother ── */
  @keyframes tileGlowIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 0.22; transform: scale(1); } }
  .ta-tile { transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), box-shadow 0.28s cubic-bezier(0.16,1,0.3,1), border-color 0.28s ease; cursor: pointer; text-align: left; }
  .ta-tile:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(15,23,42,0.10); }
  .ta-tile:active { transform: translateY(-1px); transition-duration: 0.12s; }
  .ta-tile-arrow { transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
  .ta-tile:hover .ta-tile-arrow { transform: translateX(3px); }
  .ta-tile-glow {
    position: absolute; inset: 6px; border-radius: inherit; opacity: 0;
    filter: blur(26px); pointer-events: none; z-index: -1;
    transition: opacity 0.4s cubic-bezier(0.16,1,0.3,1);
  }
  .ta-tile:hover .ta-tile-glow { opacity: 0.22; animation: tileGlowIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }

  /* ── NEW: term selector, next to the Academic Year badge ── */
  .ta-term-track { display: inline-flex; align-items: center; gap: 2px; padding: 3px; border-radius: 12px; }
  .ta-term-pill { transition: background 0.18s ease, color 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease; cursor: pointer; white-space: nowrap; }
  .ta-term-pill:hover { transform: translateY(-1px); }
  .ta-term-pill:active { transform: translateY(0); }

  .ta-crumb { transition: color 0.15s ease, background 0.15s ease; cursor: pointer; }
  .ta-crumb:hover { color: inherit; }

  .ta-stat-card { transition: transform 0.18s cubic-bezier(.22,1,.36,1), box-shadow 0.18s ease, border-color 0.18s ease; }
  .ta-stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.14); }
  .ta-stat-card:active { transform: translateY(0) scale(0.98); }

  @media (prefers-reduced-motion: reduce) {
    .ta-root, .ta-root * { animation-duration: 0.001s !important; animation-iteration-count: 1 !important; transition-duration: 0.001s !important; }
  }
`;

/* ─────────── Tiny helpers ─────────── */
function pctColor(pct) {
  if (pct == null) return '#404040';
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
          fontSize: size > 60 ? 16 : 9.5, fontWeight: 700, color: dark ? '#e2e8f0' : '#2e2e2e',
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
    <tr style={{ borderBottom: `1px solid ${dark ? '#262626' : '#f1f5f9'}`, opacity: 1 - i * 0.08 }}>
      <td style={cellStyle}>{bar(160)}</td>
      <td style={cellStyle}>{bar(70)}</td>
      <td style={cellStyle}>{bar(70)}</td>
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

  /* ── Academic Year: set by the School Manager, never by the teacher.
     Fetched once and used to stamp every new assessment automatically. ── */
  const [activeYear, setActiveYear] = useState(null); // { id, name }
  const currentYearName = activeYear?.name || '—';

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

  /* ── Modal state ──
     Class, module, and term are always already known by the time this
     modal opens — class + module from the drill-down browser the teacher
     is standing in (or fixed, if editing an existing assessment), and
     term from the term selector up in the header. The modal itself only
     ever asks for the one thing that's genuinely still undecided: type. */
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [savingAssessment, setSavingAssessment] = useState(false);

  const [form, setForm] = useState({
    selectedClassId: '',
    course_id: '',
    type: '',
    term: '',
    academic_year: '',
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

  /* ── Online-assessment (quiz) feature state ── */
  const [attemptsModal, setAttemptsModal]   = useState(null);

  /* ── NEW: table search / sort / filter (client-side only — the API
     request made by fetchData() never changes because of these). ── */
  const [searchQuery, setSearchQuery]   = useState('');
  const [classFilter, setClassFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig]     = useState({ key: null, dir: 'asc' });

  /* ── NEW: drill-down navigation — Classes → Modules → Assessments —
     plus a global term filter (next to the Academic Year badge) that
     narrows the counts and lists at every level at once. Purely a
     client-side view layer: fetchData() and the API contract are
     completely unaffected by any of this. ── */
  const [navClassId, setNavClassId]   = useState(null);
  const [navCourseId, setNavCourseId] = useState(null);
  /* NEW: there's always exactly one active term now — everything below
     (drill-down counts, the assessments table, and what "New Assessment"
     creates) is scoped to it. Defaults to the first term and hops off a
     term the School Manager has disabled once we know which those are. */
  const [termFilter, setTermFilter]   = useState(TERMS[0]);

  useEffect(() => {
    const disabled = activeYear?.disabled_terms || [];
    if (disabled.includes(termFilter)) {
      const nextOpen = TERMS.find(t => !disabled.includes(t));
      if (nextOpen) setTermFilter(nextOpen);
    }
  }, [activeYear]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Styles ── */
  const card = {
    background: dark ? '#171717' : '#fff',
    border: `1px solid ${dark ? '#262626' : '#e5e7eb'}`,
    borderRadius: 16, padding: 20,
  };
  const inp = {
    width: '100%', padding: '9px 12px', borderRadius: 10, boxSizing: 'border-box',
    border: `1px solid ${dark ? '#333333' : '#d1d5db'}`,
    background: dark ? '#1f1f1f' : '#f9fafb',
    color: dark ? '#e2e8f0' : '#131313', fontSize: 13, outline: 'none',
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
      const [cRes, aRes, yRes] = await Promise.all([
        api.get('/assessment/teacher/courses'),
        api.get('/assessment/teacher/assessments'),
        api.get('/academic-years/active').catch(() => null),
      ]);
      setCourses(cRes.data.courses || []);
      setAssessments(aRes.data.assessments || []);
      if (yRes?.data?.academicYear) setActiveYear(yRes.data.academicYear);
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

  /* ── NEW: generalized "modules assigned to a class" lookup, used by
     the drill-down browser below. Same matching rules as classModules
     above (new class_ids[] array or legacy class_id), just parameterized
     by an arbitrary class id instead of only the create-modal's form
     state, so browsing and the create wizard can't drift apart. ── */
  function modulesForClass(classId) {
    if (!classId) return [];
    const target = String(classId);
    return courses.filter(c => {
      if (Array.isArray(c.class_ids) && c.class_ids.length > 0) {
        if (c.class_ids.some(x => String(x._id || x) === target)) return true;
      }
      const cid = c.class_id?._id || c.class_id;
      return cid && String(cid) === target;
    });
  }

  /* ── NEW: term-filtered view of every assessment. 'all' means no
     narrowing — every level below falls back to showing everything. ── */
  const assessmentsInTerm = assessments.filter(a => a.term === termFilter);

  const navClass  = navClassId  ? teacherClasses.find(c => c._id === navClassId) || null : null;
  const navModules = navClassId ? modulesForClass(navClassId) : [];
  const navCourse = navCourseId ? navModules.find(c => String(c._id || c.id) === navCourseId) || null : null;

  /* ── Assessments scoped to whatever level of the drill-down we're
     currently at (class only, class + module, or neither = everything).
     This feeds the stat pills at every level and, once a module is
     selected, the search/sort/status table below. ── */
  const scopedAssessments = assessmentsInTerm.filter(a => {
    if (navClassId && String(a.class_id?._id || a.class_id) !== String(navClassId)) return false;
    if (navCourseId && String(a.course_id?._id || a.course_id) !== String(navCourseId)) return false;
    return true;
  });

  /* ── NEW: assessments for the current class + module across every
     term (ignores termFilter) — used only to tell "nothing has ever
     been created here" apart from "nothing in this particular term". ── */
  const moduleAssessmentsAllTerms = (navClassId && navCourseId)
    ? assessments.filter(a =>
        String(a.class_id?._id || a.class_id) === String(navClassId) &&
        String(a.course_id?._id || a.course_id) === String(navCourseId)
      )
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

  /* ── Open create modal ──
     Only rendered/callable once the teacher has drilled into a class +
     module (the toolbar button doesn't exist otherwise), so both are
     always resolvable here. Term comes straight from the header's term
     selector — there is no per-assessment term choice anymore. */
  function openCreate() {
    setEditingId(null);
    setForm({
      selectedClassId: navClassId || '',
      course_id: navCourseId || '',
      type: '',
      term: termFilter,
      academic_year: currentYearName,
    });
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
      term: a.term || termFilter,
      // The academic year an assessment was created under never changes —
      // this is display-only here, not something the teacher can edit.
      academic_year: a.academic_year || currentYearName,
    });
    setShowModal(true);
  }

  /* ── Save assessment ── */
  async function saveAssessment() {
    if (savingAssessment) return; // guard against double-submit
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

    setSavingAssessment(true);
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
    finally { setSavingAssessment(false); }
  }

  /* ── Delete assessment ──
     Only safe to delete while nothing has actually been recorded against
     it yet — once any mark is saved (even just as a draft, let alone
     submitted/approved/rejected), deleting the assessment would silently
     orphan that work. */
  function hasRecordedMarks(a) {
    return (a.marked_count || 0) > 0 || ['submitted', 'approved', 'rejected'].includes(a.submission_status);
  }
  function confirmDelete(a) {
    if (hasRecordedMarks(a)) {
      toast.error('Can\'t delete — marks have already been recorded for this assessment.');
      return;
    }
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
      const { students, updated, message } = res.data;

      const newMarks = {};
      students.forEach(s => { newMarks[s.student_id] = s.marks ?? ''; });
      setMarksData(newMarks);
      setMarksModal(prev => ({ ...prev, students }));
      setSortedByPerformance(true);
      toast.success(`${message} — ${updated} mark${updated === 1 ? '' : 's'} applied`);
    } catch (e2) {
      // Whole-file rejection (e.g. marks above the maximum, unknown
      // students): nothing was saved, so the on-screen table is left
      // untouched. Show exactly which rows caused the problem.
      const data = e2.response?.data;
      const baseMessage = data?.message || 'Failed to upload marks';
      if (data?.errors?.length > 0) {
        toast.error(
          `${baseMessage}\n${data.errors.slice(0, 5).join('\n')}${data.errors.length > 5 ? `\n…and ${data.errors.length - 5} more` : ''}`,
          { duration: 9000, style: { whiteSpace: 'pre-line', textAlign: 'left' } }
        );
      } else {
        toast.error(baseMessage);
      }
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
    let rows = [...scopedAssessments];

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
  }, [assessments, courses, navClassId, navCourseId, termFilter, searchQuery, classFilter, statusFilter, sortConfig]);

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
          padding: '11px 14px', background: dark ? '#1f1f1f' : '#f9fafb',
          color: active ? T.blueBright : (dark ? '#7b839a' : '#6b7280'),
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
          textAlign: align, borderBottom: `1px solid ${dark ? '#262626' : '#e5e7eb'}`,
          cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {label} <Icon size={11} style={{ opacity: active ? 1 : 0.5 }} />
        </span>
      </th>
    );
  }

  /* ── NEW: Class tile — level 1 of the drill-down browser. Shows how
     many modules the teacher has in this class and a quick breakdown of
     assessment counts (term-aware via assessmentsInTerm), then opens
     the modules level on click. ── */
  function ClassTile({ cls, index }) {
    const stats = assessmentsInTerm.filter(a => String(a.class_id?._id || a.class_id) === String(cls._id));
    const moduleCount = modulesForClass(cls._id).length;
    const total = stats.length;
    const approved = stats.filter(a => a.submission_status === 'approved').length;
    const pending = stats.filter(a => a.submission_status === 'draft' || a.submission_status === 'submitted').length;
    const palette = TILE_PALETTE[index % TILE_PALETTE.length];
    return (
      <button
        type="button"
        className="ta-tile ta-card-enter"
        onClick={() => { setNavClassId(cls._id); setNavCourseId(null); }}
        style={{ animationDelay: `${index * 0.05}s`, position: 'relative', border: 'none', padding: 0, borderRadius: 18, background: 'transparent' }}
      >
        <div className="ta-tile-glow" style={{ background: `linear-gradient(135deg, ${palette.grad[0]}, ${palette.grad[1]})`, filter: 'blur(16px)' }} />
        <div style={{ position: 'relative', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}`, borderRadius: 18, overflow: 'hidden', background: dark ? '#171717' : '#fff' }}>
          <div style={{ padding: '18px 18px 14px', background: `linear-gradient(135deg, ${palette.grad[0]}, ${palette.grad[1]})`, position: 'relative', overflow: 'hidden' }}>
            <School size={68} color="rgba(255,255,255,0.13)" style={{ position: 'absolute', right: -12, bottom: -16, transform: 'rotate(-8deg)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <School size={18} color="#fff" />
              </div>
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <p className="ta-display" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cls.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{moduleCount} module{moduleCount === 1 ? '' : 's'} assigned</p>
              </div>
            </div>
          </div>
          <div style={{ padding: '14px 18px 16px', textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 7, background: palette.soft, color: palette.solid }}>{total} assessment{total === 1 ? '' : 's'}</span>
              {approved > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 7, background: `${T.green}16`, color: T.green }}>{approved} approved</span>}
              {pending > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 7, background: `${T.amber}16`, color: T.amber }}>{pending} pending</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: palette.solid }}>View modules</span>
              <ArrowRight size={14} className="ta-tile-arrow" color={palette.solid} />
            </div>
          </div>
        </div>
      </button>
    );
  }

  /* ── NEW: Module tile — level 2 of the drill-down browser. Shows a
     per-status breakdown of assessments in this module (term-aware),
     then opens the assessments table for this class + module. ── */
  function ModuleTile({ course, index }) {
    const courseId = String(course._id || course.id);
    const stats = assessmentsInTerm.filter(a =>
      String(a.class_id?._id || a.class_id) === String(navClassId) &&
      String(a.course_id?._id || a.course_id) === courseId
    );
    const total = stats.length;
    const draft = stats.filter(a => a.submission_status === 'draft').length;
    const submitted = stats.filter(a => a.submission_status === 'submitted').length;
    const approved = stats.filter(a => a.submission_status === 'approved').length;
    const rejected = stats.filter(a => a.submission_status === 'rejected').length;
    const palette = TILE_PALETTE[(index + 1) % TILE_PALETTE.length];
    return (
      <button
        type="button"
        className="ta-tile ta-card-enter"
        onClick={() => setNavCourseId(courseId)}
        style={{ animationDelay: `${index * 0.05}s`, position: 'relative', textAlign: 'left', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}`, borderRadius: 16, padding: 16, background: dark ? '#171717' : '#fff' }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: `linear-gradient(135deg, ${palette.grad[0]}, ${palette.grad[1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={17} color="#fff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {course.code && <div style={{ fontSize: 9.5, fontWeight: 800, color: palette.solid, letterSpacing: '0.06em', marginBottom: 2 }}>{course.code}</div>}
            <p className="ta-display" style={{ margin: 0, fontSize: 14, fontWeight: 800, color: dark ? '#e8ecf4' : '#131313', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.name}</p>
            <p style={{ margin: '2px 0 8px', fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>{course.category || 'Module'}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: palette.soft, color: palette.solid }}>{total} total</span>
              {draft > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#9ca3af18', color: '#9ca3af' }}>{draft} draft</span>}
              {submitted > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${T.amber}16`, color: T.amber }}>{submitted} submitted</span>}
              {approved > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${T.green}16`, color: T.green }}>{approved} approved</span>}
              {rejected > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${T.red}16`, color: T.red }}>{rejected} rejected</span>}
            </div>
          </div>
          <ArrowRight size={15} className="ta-tile-arrow" color={dark ? '#5b6377' : '#9ca3af'} style={{ marginTop: 10, flexShrink: 0 }} />
        </div>
      </button>
    );
  }


  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="ta-root">
      <style>{GLOBAL_KEYFRAMES}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
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
            <h1 className="ta-display" style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-0.01em', color: dark ? '#f1f5f9' : '#131313' }}>
              My Assessments
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: dark ? '#7b839a' : '#6b7280' }}>
              Create and manage assessments for your assigned modules
            </p>
          </div>
        </div>
        <div className="ta-toolbar" style={{
          display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
          padding: 5, borderRadius: 18,
          background: dark ? 'linear-gradient(180deg, #151926, #10131c)' : 'linear-gradient(180deg, #fff, #f8fafc)',
          border: `1px solid ${dark ? '#232a3d' : '#e5e7eb'}`,
          boxShadow: dark ? 'inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.25)' : '0 4px 14px rgba(15,23,42,0.05)',
        }}>
          {/* Academic year — fixed by the School Manager, shown for
              context only. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 13,
            color: T.blueBright, fontSize: 12.5, fontWeight: 700, cursor: 'default',
          }}>
            <span style={{ width: 22, height: 22, borderRadius: 7, background: `${T.blueBright}1c`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={12} />
            </span>
            {currentYearName}
          </div>

          <div style={{ width: 1, alignSelf: 'stretch', margin: '6px 2px', background: dark ? '#232a3d' : '#e5e7eb' }} />

          {/* Term selector — the single source of truth for which term
              everything below (drill-down counts, table, new-assessment
              creation) is scoped to. */}
          <div className="ta-term-track" style={{ background: dark ? '#0d0f18' : '#f1f5f9', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}` }}>
            {TERMS.map(t => {
              const active = termFilter === t;
              const closed = (activeYear?.disabled_terms || []).includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className="ta-term-pill"
                  onClick={() => setTermFilter(t)}
                  disabled={closed}
                  style={{
                    border: 'none', padding: '7px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
                    background: active ? `linear-gradient(135deg, ${T.navy}, ${T.blueBright})` : 'transparent',
                    color: active ? '#fff' : closed ? (dark ? '#3d4256' : '#c7cbd4') : (dark ? '#8891a5' : '#6b7280'),
                    boxShadow: active ? `0 4px 14px ${T.navy}66, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                    cursor: closed ? 'not-allowed' : 'pointer',
                    opacity: closed ? 0.55 : 1,
                    transform: active ? 'translateY(-0.5px)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CalendarDays size={12} />
                  {t}
                </button>
              );
            })}
          </div>

          <div style={{ width: 1, alignSelf: 'stretch', margin: '6px 2px', background: dark ? '#232a3d' : '#e5e7eb' }} />

          {/* Refresh — icon-only, spins on click */}
          <button
            className="ta-btn ta-icon-btn"
            onClick={handleRefreshClick}
            title="Refresh"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
              borderRadius: 12, border: `1px solid ${dark ? '#232a3d' : '#e5e7eb'}`, background: dark ? '#1a1a1a' : '#fff',
              color: dark ? '#8891a5' : '#6b7280', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <RefreshCw size={14} style={{ animation: refreshSpin ? 'spin 0.6s linear' : 'none' }} />
          </button>

          {/* New Assessment — only exists once a module is actually
              open; there's nothing sensible to create otherwise, so it
              doesn't take up space until then. */}
          {navClassId && navCourseId && (
            <button
              className="ta-btn"
              onClick={openCreate}
              style={{
                position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px 9px 8px', borderRadius: 13, border: 'none', marginLeft: 2,
                background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`,
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 6px 18px ${T.navy}5c, inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}
            >
              <span style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Plus size={14} />
              </span>
              New Assessment
            </button>
          )}
        </div>
      </div>

      {/* ── Breadcrumb — All Classes → [Class] → [Module] ── */}
      {navClassId && (
        <div className="ta-step-enter" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 18, flexWrap: 'wrap', padding: 4, borderRadius: 13, background: dark ? '#12151f' : '#f8fafc', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}`, width: 'fit-content' }}>
          <button
            className="ta-btn ta-crumb"
            onClick={() => { setNavClassId(null); setNavCourseId(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, color: dark ? '#8891a5' : '#6b7280', cursor: 'pointer' }}
          >
            <Home size={12} /> All Classes
          </button>
          <ChevronRight size={13} color={dark ? '#3a4258' : '#d1d5db'} />
          <button
            className="ta-btn ta-crumb"
            onClick={() => setNavCourseId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, border: 'none', padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: navCourseId ? 'transparent' : `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`,
              color: navCourseId ? (dark ? '#8891a5' : '#6b7280') : '#fff',
              boxShadow: navCourseId ? 'none' : `0 3px 10px ${T.navy}4c`,
            }}
          >
            <School size={12} /> {navClass?.name || 'Class'}
          </button>
          {navCourseId && (
            <>
              <ChevronRight size={13} color={dark ? '#3a4258' : '#d1d5db'} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, color: '#fff', boxShadow: `0 3px 10px ${T.navy}4c` }}>
                <BookOpen size={12} /> {navCourse?.name || 'Module'}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Stat cards — scoped to whatever level of the drill-down you're
          currently at (and to the term filter above). Clicking one also
          jumps the status filter straight to it — a quick way to scan
          "how many are still pending review" without opening the dropdown. ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        {[
          { label: 'Total',     key: 'all',       val: scopedAssessments.length,                                                    color: T.navy,      Icon: FileText },
          { label: 'Draft',     key: 'draft',     val: scopedAssessments.filter(a => a.submission_status === 'draft').length,     color: '#9ca3af',   Icon: Edit2 },
          { label: 'Submitted', key: 'submitted', val: scopedAssessments.filter(a => a.submission_status === 'submitted').length, color: T.amber,     Icon: Send },
          { label: 'Approved',  key: 'approved',  val: scopedAssessments.filter(a => a.submission_status === 'approved').length,  color: T.green,     Icon: CheckCircle },
          { label: 'Rejected',  key: 'rejected',  val: scopedAssessments.filter(a => a.submission_status === 'rejected').length,  color: T.red,       Icon: XCircle },
        ].map((s, i) => {
          const active = statusFilter === s.key;
          return (
            <button
              key={s.label}
              type="button"
              className="ta-card-enter ta-stat-card"
              onClick={() => setStatusFilter(active ? 'all' : s.key)}
              style={{
                animationDelay: `${i * 0.05}s`, position: 'relative', overflow: 'hidden', textAlign: 'left',
                padding: '13px 18px 13px 16px', borderRadius: 14, minWidth: 118,
                background: active ? s.color + '14' : (dark ? '#171717' : '#fff'),
                border: `1.5px solid ${active ? s.color + '80' : (dark ? '#262626' : '#e5e7eb')}`,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: s.color, opacity: active ? 1 : 0.35 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span className="ta-mono" style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}><AnimatedNumber value={s.val} /></span>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: s.color + '1c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.Icon size={13} color={s.color} />
                </span>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: dark ? '#7b839a' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════
          LEVEL 1 — Classes
      ══════════════════════════════════════════════════════════ */}
      {!navClassId ? (
        loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ borderRadius: 18, overflow: 'hidden', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}` }}>
                <div className="ta-skel" style={{ height: 82, background: dark ? '#1c2233' : '#eef0f4' }} />
                <div style={{ padding: 16 }}>
                  <div className="ta-skel" style={{ height: 10, width: '60%', borderRadius: 6, marginBottom: 10, background: dark ? '#1c2233' : '#eef0f4' }} />
                  <div className="ta-skel" style={{ height: 10, width: '40%', borderRadius: 6, background: dark ? '#1c2233' : '#eef0f4' }} />
                </div>
              </div>
            ))}
          </div>
        ) : teacherClasses.length === 0 ? (
          <div className="ta-card-enter" style={{ ...card, textAlign: 'center', padding: 60 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'floatIcon 3.5s ease-in-out infinite' }}><School size={28} color="#fff" /></div>
            <p className="ta-display" style={{ color: dark ? '#e8ecf4' : '#131313', fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>No Classes Assigned</p>
            <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: 0 }}>Ask your admin to assign you modules and classes to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
            {teacherClasses.map((cls, i) => <ClassTile key={cls._id} cls={cls} index={i} />)}
          </div>
        )
      ) : !navCourseId ? (
        /* ══════════════════════════════════════════════════════════
            LEVEL 2 — Modules in the selected class
        ══════════════════════════════════════════════════════════ */
        navModules.length === 0 ? (
          <div className="ta-card-enter" style={{ ...card, textAlign: 'center', padding: 60 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${T.teal}, ${T.tealBright})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><BookOpen size={28} color="#fff" /></div>
            <p className="ta-display" style={{ color: dark ? '#e8ecf4' : '#131313', fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>No Modules Here</p>
            <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: 0 }}>You have no modules assigned for {navClass?.name || 'this class'}.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {navModules.map((c, i) => <ModuleTile key={c._id || c.id} course={c} index={i} />)}
          </div>
        )
      ) : (
        /* ══════════════════════════════════════════════════════════
            LEVEL 3 — Assessments in the selected class + module
        ══════════════════════════════════════════════════════════ */
        <>
          {/* ── Search + status filter — unified toolbar ── */}
          {!loading && moduleAssessmentsAllTerms.length > 0 && (
            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16,
              padding: 8, borderRadius: 15, background: dark ? '#12151f' : '#f8fafc', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}`,
            }}>
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200, maxWidth: 320 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: dark ? '#5b6377' : '#9ca3af' }} />
                <input
                  className="ta-input-focus"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search title, type…"
                  style={{ ...inp, background: dark ? '#0d0f18' : '#fff', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}`, paddingLeft: 34, paddingRight: searchQuery ? 30 : 12 }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: dark ? '#7b839a' : '#9ca3af', display: 'flex' }}>
                    <XSmall size={14} />
                  </button>
                )}
              </div>

              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 140, background: dark ? '#0d0f18' : '#fff', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}` }}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              {(searchQuery.trim() || statusFilter !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                  className="ta-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 13px', borderRadius: 10, border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, background: dark ? '#0d0f18' : '#fff', color: dark ? '#7b839a' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Filter size={12} /> Clear filters
                </button>
              )}

              <span style={{ fontSize: 11.5, fontWeight: 700, color: dark ? '#5b6377' : '#9ca3af', marginLeft: 'auto', padding: '0 6px' }}>
                {visibleAssessments.length} of {scopedAssessments.length}
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Assessment', 'Progress', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '11px 14px', background: dark ? '#1f1f1f' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: `1px solid ${dark ? '#262626' : '#e5e7eb'}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2].map(i => <SkeletonRow key={i} dark={dark} i={i} />)}
                  </tbody>
                </table>
              </div>
            </div>
          ) : moduleAssessmentsAllTerms.length === 0 ? (
            <div className="ta-card-enter" style={{ ...card, textAlign: 'center', padding: 60 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'floatIcon 3.5s ease-in-out infinite' }}><FileText size={28} color="#fff" /></div>
              <p className="ta-display" style={{ color: dark ? '#e8ecf4' : '#131313', fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>No Assessments Yet</p>
              <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: '0 0 20px' }}>Create the first assessment for {navCourse?.name || 'this module'} in {navClass?.name || 'this class'}.</p>
              <button className="ta-btn" onClick={openCreate} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />New Assessment
              </button>
            </div>
          ) : scopedAssessments.length === 0 ? (
            /* ── Nothing for this module in the selected term. ── */
            <div className="ta-card-enter" style={{ ...card, textAlign: 'center', padding: '56px 40px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: dark ? '#1f1f1f' : '#f3f4f6', border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Inbox size={26} color={dark ? '#5b6377' : '#9ca3af'} /></div>
              <p className="ta-display" style={{ color: dark ? '#e8ecf4' : '#131313', fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>No assessment created in this term</p>
              <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: '0 0 24px' }}>Nothing exists yet for {navCourse?.name || 'this module'} in <strong style={{ color: dark ? '#c4c9d4' : '#404040' }}>{termFilter}</strong>.</p>
              <button
                className="ta-btn"
                onClick={openCreate}
                style={{
                  position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 9,
                  padding: '13px 28px', borderRadius: 14, border: 'none',
                  background: `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`,
                  color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  boxShadow: `0 10px 28px ${T.navy}66`,
                }}
              >
                <span style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Plus size={14} />
                </span>
                New Assessment
              </button>
            </div>
          ) : visibleAssessments.length === 0 ? (
            <div className="ta-card-enter" style={{ ...card, textAlign: 'center', padding: 50 }}>
              <Search size={30} color={dark ? '#3a4258' : '#d1d5db'} style={{ marginBottom: 12 }} />
              <p style={{ color: dark ? '#e8ecf4' : '#131313', fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>No matches</p>
              <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: '0 0 16px', fontSize: 13 }}>Try a different search term or clear your filters.</p>
              <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="ta-btn" style={{ padding: '8px 16px', borderRadius: 9, border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#e2e8f0' : '#404040', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Clear filters
              </button>
            </div>
          ) : (
            <div style={{ ...card, padding: 0, overflow: 'hidden', borderRadius: 18, boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.28)' : '0 8px 24px rgba(15,23,42,0.06)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <SortHeader label="Assessment" sortKey="title" />
                      <SortHeader label="Progress" sortKey="progress" />
                      <SortHeader label="Status" sortKey="status" />
                      <th style={{ padding: '11px 14px', background: dark ? '#1f1f1f' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: `1px solid ${dark ? '#262626' : '#e5e7eb'}` }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAssessments.map((a, i) => {
                      const isLocked = a.submission_status === 'submitted' || a.submission_status === 'approved';
                      const progressPct = a.student_count > 0 ? Math.round((a.marked_count / a.student_count) * 100) : 0;
                      const typeMeta = ASSESSMENT_TYPES.find(t => t.key === a.type);
                      const statusAccent = { draft: '#9ca3af', submitted: T.amber, approved: T.green, rejected: T.red }[a.submission_status] || '#9ca3af';
                      return (
                        <tr
                          key={a._id || a.id}
                          className="ta-row-enter ta-row"
                          style={{ animationDelay: `${Math.min(i, 10) * 0.035}s`, position: 'relative', background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'), borderBottom: `1px solid ${dark ? '#262626' : '#f1f5f9'}` }}
                          onMouseEnter={e => { e.currentTarget.style.background = dark ? '#1f1f1f88' : '#f4f7ff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'); }}
                        >
                          <td style={{ padding: '12px 14px 12px 18px', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: statusAccent, opacity: 0.7 }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {typeMeta && (
                                <span title={typeMeta.label} style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: `${typeMeta.color}18`, border: `1px solid ${typeMeta.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: typeMeta.color }}>
                                  {a.type}
                                </span>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: dark ? '#e8ecf4' : '#131313' }}>{a.title}</div>
                                {a.review_note && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    <AlertCircle size={10} color={T.red} />
                                    <span style={{ fontSize: 11, color: T.red }}>{a.review_note}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
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
                              <button className="ta-btn ta-icon-btn" onClick={() => openMarks(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, background: dark ? '#1f1f1f' : '#f9fafb', color: dark ? '#e2e8f0' : '#404040', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                <Users size={11} /> Marks
                              </button>
                              {a.is_shared && (
                                <button className="ta-btn ta-icon-btn" onClick={() => setAttemptsModal(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, background: dark ? '#1f1f1f' : '#f9fafb', color: dark ? '#e2e8f0' : '#404040', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                  <BarChart3 size={11} /> Results
                                </button>
                              )}
                              {!isLocked && (
                                <>
                                  <button className="ta-btn ta-icon-btn" onClick={() => openEdit(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, background: dark ? '#1f1f1f' : '#f9fafb', color: dark ? '#e2e8f0' : '#404040', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                    <Edit2 size={11} /> Edit
                                  </button>
                                  {hasRecordedMarks(a) ? (
                                    <button
                                      disabled
                                      title="Can't delete — marks have already been recorded for this assessment"
                                      className="ta-icon-btn"
                                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, background: dark ? '#1a1a1a' : '#f3f4f6', color: dark ? '#4a5568' : '#9ca3af', fontSize: 11, fontWeight: 600, cursor: 'not-allowed' }}
                                    >
                                      <Lock size={11} /> Delete
                                    </button>
                                  ) : (
                                    <button className="ta-btn ta-icon-btn" onClick={() => confirmDelete(a)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: T.red, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                      <Trash2 size={11} /> Delete
                                    </button>
                                  )}
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          CREATE / EDIT ASSESSMENT MODAL — step wizard
          Class + module are resolved *before* this modal opens (drill-down
          browser, or the assessment being edited) — so by default the
          wizard only asks what's actually still undecided: Term → Type.
          The class/module picker is kept, just collapsed behind a
          "Change" action, for the rare case neither was pre-selected.
      ══════════════════════════════════════════════════════════ */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,11,20,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.18s ease' }}
        >
          <div className="ta-card-enter" style={{ width: 540, borderRadius: 24, background: dark ? '#171717' : '#fff', border: `1px solid ${dark ? '#232a3d' : '#e5e7eb'}`, padding: 0, boxShadow: `0 40px 90px rgba(6,10,20,0.5), 0 0 0 1px ${T.navy}14`, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Modal header — gradient banner */}
            <div style={{
              position: 'relative', padding: '26px 28px 20px', flexShrink: 0, overflow: 'hidden',
              background: `linear-gradient(135deg, ${T.navyDeep}, ${T.navy} 55%, ${T.blueBright})`,
            }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backdropFilter: 'blur(6px)' }}>
                  <FileText size={19} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 className="ta-display" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>
                    {editingId ? 'Edit Assessment' : 'New Assessment'}
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>
                    {editingId ? 'Update the assessment type' : `Creating for ${form.term || 'the selected term'} — just pick a type`}
                  </p>
                </div>
                {form.academic_year && (
                  <div title="Current academic year — set by your School Manager" style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, flexShrink: 0,
                    background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)',
                  }}>
                    <CalendarDays size={12} color="#fff" />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{form.academic_year}</span>
                  </div>
                )}
                <button className="ta-btn" onClick={() => setShowModal(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.14)', borderRadius: 9, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={16} color="#fff" />
                </button>
              </div>
            </div>

            <div style={{ padding: '24px 28px 28px', overflowY: 'auto' }}>

              {/* ── Context strip — class, module, and term are all
                  already decided by this point (drill-down browser +
                  the term selected up in the header), so they're shown
                  as read-only context, never re-picked in here. ── */}
              {(() => {
                const selClass  = teacherClasses.find(c => c._id === form.selectedClassId);
                const selModule = classModules.find(c => String(c._id || c.id) === form.course_id);
                if (!selClass || !selModule) return null;
                return (
                  <div className="ta-step-enter" style={{
                    display: 'flex', alignItems: 'stretch', marginBottom: 22, borderRadius: 14,
                    border: `1px solid ${dark ? '#232a3d' : '#e5e7eb'}`, background: dark ? '#171b28' : '#f8fafc',
                    overflow: 'hidden',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 14px', flex: 1.1, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: `${T.blueBright}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <School size={14} color={T.blueBright} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: dark ? '#5b6377' : '#9ca3af' }}>Class</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e2e8f0' : '#131313', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selClass.name}</div>
                      </div>
                    </div>
                    <div style={{ width: 1, background: dark ? '#232a3d' : '#e5e7eb', flexShrink: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 14px', flex: 1.6, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: `${T.tealBright}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={14} color={T.tealBright} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: dark ? '#5b6377' : '#9ca3af' }}>Module</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e2e8f0' : '#131313', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selModule.name} <span className="ta-mono" style={{ fontWeight: 500, color: dark ? '#7b839a' : '#9ca3af' }}>· {selModule.total_marks || 100} marks</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ width: 1, background: dark ? '#232a3d' : '#e5e7eb', flexShrink: 0 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 14px', flex: 0.8, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: `${T.goldBright}1c`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CalendarDays size={14} color={T.gold} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: dark ? '#5b6377' : '#9ca3af' }}>Term</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e2e8f0' : '#131313', whiteSpace: 'nowrap' }}>{form.term}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Assessment type — the one thing left to decide.
                  Duplicate guard still checks against class + module +
                  term + academic year under the hood, just nothing here
                  is user-editable anymore. ── */}
              <div className="ta-step-enter">
                <label style={lbl}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FileText size={11} /> Assessment Type *
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
                          padding: '12px 14px', borderRadius: 11,
                          cursor: alreadyUsed ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          border: `2px solid ${selected ? t.color : (dark ? '#333333' : '#e5e7eb')}`,
                          background: selected ? t.color + '12' : alreadyUsed ? (dark ? '#0f0f0f' : '#f3f4f6') : 'transparent',
                          display: 'flex', alignItems: 'center', gap: 12,
                          opacity: alreadyUsed ? 0.55 : 1,
                        }}
                      >
                        <span style={{ minWidth: 30, textAlign: 'center', fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 6, background: t.color + '20', color: t.color, border: `1px solid ${t.color}40`, flexShrink: 0 }}>{t.key}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: selected ? 800 : 500, color: selected ? t.color : (dark ? '#e2e8f0' : '#404040') }}>{t.label}</div>
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
                  <div className="ta-step-enter" style={{ marginTop: 10, padding: '9px 12px', borderRadius: 10, background: dark ? '#1f1f1f' : '#f0f9ff', border: `1px solid ${dark ? '#333333' : '#bae6fd'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={12} color="#0369a1" />
                    <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#0369a1' }}>
                      Title will be: <strong style={{ color: dark ? '#e2e8f0' : '#0c4a6e' }}>{ASSESSMENT_TYPES.find(t => t.key === form.type)?.label}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button className="ta-btn" onClick={() => setShowModal(false)} disabled={savingAssessment} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, background: dark ? '#1f1f1f' : '#f9fafb', color: dark ? '#94a3b8' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: savingAssessment ? 'default' : 'pointer', opacity: savingAssessment ? 0.6 : 1 }}>
                  Cancel
                </button>
                <button
                  className="ta-btn"
                  onClick={saveAssessment}
                  disabled={!form.course_id || !form.type || !form.term || savingAssessment}
                  style={{
                    flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: (!form.course_id || !form.type || !form.term || savingAssessment)
                      ? (dark ? '#333333' : '#e5e7eb')
                      : `linear-gradient(135deg, ${T.navy}, ${T.blueBright})`,
                    color: (!form.course_id || !form.type || !form.term)
                      ? (dark ? '#4a5568' : '#9ca3af')
                      : savingAssessment ? '#fff' : '#fff',
                    fontSize: 13, fontWeight: 700,
                    cursor: (!form.course_id || !form.type || !form.term || savingAssessment) ? 'not-allowed' : 'pointer',
                    boxShadow: (!form.course_id || !form.type || !form.term || savingAssessment) ? 'none' : `0 4px 14px ${T.navy}59`,
                  }}
                >
                  {savingAssessment && <RefreshCw size={14} style={{ animation: 'spin 0.6s linear infinite' }} />}
                  {savingAssessment
                    ? (editingId ? 'Saving…' : 'Creating…')
                    : (editingId ? 'Save Changes' : 'Create Assessment')}
                </button>
              </div>
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
          <div className="ta-card-enter" style={{ width: 720, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 20, background: dark ? '#171717' : '#fff', border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
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
                <div style={{ flexShrink: 0, padding: '28px 28px 16px', borderBottom: `1px solid ${dark ? '#262626' : '#eef0f4'}`, boxShadow: dark ? '0 4px 14px rgba(0,0,0,0.25)' : '0 4px 14px rgba(15,23,42,0.04)', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                    {!marksLocked && (
                      <ProgressRing pct={markingProgress.pct} size={56} stroke={5} dark={dark} showLabel />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <h3 className="ta-display" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#131313' }}>{marksModal.assessment?.title}</h3>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Module: <strong style={{ color: dark ? '#e2e8f0' : '#404040' }}>{marksModal.assessment?.course_id?.name}</strong></span>
                        <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{marksModal.assessment?.term} · {marksModal.assessment?.academic_year}</span>
                        <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Max: <strong style={{ color: dark ? '#e2e8f0' : '#404040' }}>{marksModal.assessment?.max_marks}</strong></span>
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
                  <button className="ta-btn" onClick={() => setMarksModal(null)} style={{ border: 'none', background: dark ? '#262626' : '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                    border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`,
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
                          ? (dark ? '#333333' : '#e5e7eb')
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
                          ? (dark ? '#333333' : '#e5e7eb')
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
                    background: markingProgress.complete ? `${T.gold}12` : (dark ? '#1f1f1f' : '#f9fafb'),
                    border: `1px solid ${markingProgress.complete ? `${T.gold}55` : (dark ? '#333333' : '#e5e7eb')}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: markingProgress.complete ? 0 : 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: markingProgress.complete ? T.gold : (dark ? '#e2e8f0' : '#404040') }}>
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
                        <div style={{ height: 8, borderRadius: 4, background: dark ? '#333333' : '#e5e7eb', overflow: 'hidden' }}>
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
                <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${dark ? '#262626' : '#eef0f4'}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['#', 'Student', 'Marks', `Out of ${marksModal.assessment?.max_marks}`, '%'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', background: dark ? '#1f1f1f' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textAlign: 'left', borderBottom: `1px solid ${dark ? '#262626' : '#e5e7eb'}`, position: 'sticky', top: 0 }}>{h}</th>
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
                            style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'), borderBottom: `1px solid ${dark ? '#262626' : '#f1f5f9'}` }}
                            onMouseEnter={e => { e.currentTarget.style.background = dark ? '#1f1f1f88' : '#f4f7ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafafa'); }}
                          >
                            <td style={{ padding: '9px 12px', fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{i + 1}</td>
                            <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: dark ? '#e2e8f0' : '#404040' }}>
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
                                  border: `1px solid ${num != null && num > max ? T.red : (missing && !marksLocked ? T.amber : (dark ? '#333333' : '#d1d5db'))}`,
                                  background: marksLocked ? (dark ? '#0f0f0f' : '#f3f4f6') : (dark ? '#1f1f1f' : '#fff'),
                                  color: dark ? '#e2e8f0' : '#131313', fontSize: 13, outline: 'none',
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
                  <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '16px 28px 28px', borderTop: `1px solid ${dark ? '#262626' : '#eef0f4'}` }}>
                    <button className="ta-btn" onClick={saveDraft} disabled={marksSaving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 10, border: `1px solid ${dark ? '#333333' : '#e5e7eb'}`, background: dark ? '#1f1f1f' : '#f9fafb', color: dark ? '#e2e8f0' : '#404040', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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

      {attemptsModal && (
        <AssessmentAttemptsModal
          assessment={attemptsModal}
          onClose={() => setAttemptsModal(null)}
        />
      )}
    </div>
  );
}