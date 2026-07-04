import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/common/ConfirmModal';
import {
  BookOpen, Plus, Edit2, Trash2, UserCheck, BarChart2, X, Search,
  GraduationCap, FileText, Users, Printer, ChevronRight, Award,
  TrendingUp, Hash, School, User2, Calendar, Target, Settings,
  Save, Image, AlignLeft, Phone, Mail, Globe, MapPin, Building2,
  CheckCircle2, Sparkles, Download, Eye, RefreshCw, ClipboardCheck,
  CheckCircle, XCircle, Clock, Filter, UploadCloud,
} from 'lucide-react';

/* ─────────── Constants ─────────── */
const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [
  `${CURRENT_YEAR - 1}-${CURRENT_YEAR}`,
  `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR + 1}-${CURRENT_YEAR + 2}`,
];

const MODULE_CATEGORIES     = ['Complementary modules', 'General modules', 'Specific modules'];
const ALL_MODULE_CATEGORIES = ['Complementary modules', 'General modules', 'Specific modules', 'Elective Non Examinable'];

const ASSESSMENT_TYPES = [
  { key: 'FA', label: 'Formative Assessment',     short: 'FA', color: '#3b82f6' },
  { key: 'IA', label: 'Integrated Assessment',    short: 'IA', color: '#10b981' },
  { key: 'CA', label: 'Comprehensive Assessment', short: 'CA', color: '#8b5cf6' },
];

const DEFAULT_REPORT_CONFIG = {
  schoolName: 'EDUPLA Academy',
  schoolMotto: 'Excellence Through Knowledge',
  schoolAddress: 'KG 123 Street, Kigali, Rwanda',
  schoolPhone: '+250 788 000 000',
  schoolEmail: 'info@edupla.ac.rw',
  schoolWebsite: 'www.edupla.ac.rw',
  schoolLogoUrl: '',
  managerName: 'School Manager',
  managerTitle: 'School Principal',
  footerNote: "Module Weight = Module's learning hours = Credit × 10. Passing Line: 50% for mathematics, sciences and complementary modules while 70% is for core modules (specific and general modules). Module Annual Average: (Average of Integrated A + Average of Comprehensive A) / number of assessed terms.",
  primaryColor: '#1a3a6b',
  accentColor:  '#1565c0',
  termLabel:    '2nd TERM',
  academicYear: `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  republic:  'REPUBLIC OF RWANDA',
  ministry:  'MINISTRY OF EDUCATION',
  district:  'DISTRICT RUHANGO',
};

/* ─────────── Helpers ─────────── */
function pctColor(pct) {
  if (pct == null) return '#374151';
  if (pct >= 70)   return '#059669';
  if (pct >= 50)   return '#b45309';
  return '#dc2626';
}

function calcPct(obtained, max) {
  if (max == null || max <= 0 || obtained == null) return null;
  return Math.min(Math.round((obtained / max) * 100), 100);
}

function getGrade(obtained, max) {
  const pct = Math.min((obtained / max) * 100, 100);
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

function getRwandanDecision(pct) {
  if (pct == null) return '—';
  return pct >= 70 ? 'C' : pct >= 50 ? 'P' : 'NYC';
}

function GradeBadge({ grade }) {
  const color =
    grade === 'A+' || grade === 'A' ? '#10b981'
    : grade === 'B' ? '#3b82f6'
    : grade === 'C' ? '#f59e0b'
    : grade === 'D' ? '#f97316'
    : grade === 'F' ? '#ef4444'
    : '#9ca3af';
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 7,
      background: color + '22', color, border: '1px solid ' + color + '44',
    }}>{grade}</span>
  );
}

function TypeBadge({ type }) {
  const found = ASSESSMENT_TYPES.find(t => t.key === type);
  const color = found?.color || '#9ca3af';
  const label = found?.label || type;
  return (
    <span title={label} style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
      background: color + '20', color, border: '1px solid ' + color + '40',
    }}>{type}</span>
  );
}

/* ─────────── Report Config Storage ───────────
 * The report header (school name, address, manager, etc) is stored server-side
 * per admin account, so it's shared across devices/browsers instead of living
 * only in this one browser's localStorage. */
async function fetchReportConfig() {
  try {
    const res = await api.get('/admin/report-config');
    return { ...DEFAULT_REPORT_CONFIG, ...res.data.reportConfig };
  } catch {
    return { ...DEFAULT_REPORT_CONFIG };
  }
}
async function persistReportConfig(cfg) {
  const res = await api.put('/admin/report-config', cfg);
  return { ...DEFAULT_REPORT_CONFIG, ...res.data.reportConfig };
}

/* ─────────── Category helpers ─────────── */
function catBadge(cat) {
  const colors = {
    'Complementary modules':   { bg: '#1a3a6b18', border: '#1a3a6b30', text: '#1a3a6b', dot: '#1a3a6b' },
    'General modules':         { bg: '#06563018', border: '#06563030', text: '#065f46', dot: '#065f46' },
    'Specific modules':        { bg: '#7c2d1218', border: '#7c2d1230', text: '#7c2d12', dot: '#7c2d12' },
    'Elective Non Examinable': { bg: '#4a044e18', border: '#4a044e30', text: '#4a044e', dot: '#4a044e' },
  };
  return colors[cat] || colors['Complementary modules'];
}

/* ══════════════════════════════════════════════════════════════════════
   MULTI-CLASS PICKER — tag-style pill selector used in the course modal
══════════════════════════════════════════════════════════════════════ */
function MultiClassPicker({ classes, selectedIds, onChange, dark }) {
  const inputSt = {
    width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#d1d5db'}`,
    background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#111827', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const available = classes.filter(c => !selectedIds.includes(c._id || c.id));

  function add(id) {
    if (id && !selectedIds.includes(id)) onChange([...selectedIds, id]);
  }
  function remove(id) {
    onChange(selectedIds.filter(x => x !== id));
  }

  return (
    <div>
      {/* Selected pills */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectedIds.map(id => {
            const cls = classes.find(c => (c._id || c.id) === id);
            if (!cls) return null;
            return (
              <span key={id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20,
                background: 'rgba(26,58,107,0.10)', border: '1px solid rgba(26,58,107,0.30)',
                fontSize: 12, fontWeight: 700, color: '#1a3a6b',
              }}>
                <School size={11} />
                {cls.name}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 0 2px', color: '#1a3a6b', display: 'flex', alignItems: 'center', lineHeight: 1 }}
                  title={`Remove ${cls.name}`}
                >
                  <X size={11} />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', fontSize: 11, fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Dropdown to add more */}
      <select
        value=""
        onChange={e => { add(e.target.value); e.target.value = ''; }}
        style={inputSt}
      >
        <option value="">
          {available.length === 0
            ? selectedIds.length > 0 ? 'All classes assigned' : 'No classes available'
            : `Add a class… (${available.length} remaining)`}
        </option>
        {available.map(c => (
          <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
        ))}
      </select>

      {selectedIds.length === 0 && (
        <p style={{ margin: '5px 0 0', fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>
          No classes assigned. Use the dropdown above to assign one or more.
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   REPORT CONFIG PANEL  — removed: Programme/Qualification, Brand Colors
══════════════════════════════════════════════════════════════════════ */
/* ─────────── Logo Uploader (drag & drop or click to browse) ───────────
 * Uploading a file goes straight to the server (POST /admin/report-config/logo)
 * and is saved immediately — no need to press "Save" afterwards — because it's
 * a single, self-contained action. Removing it (or pasting a URL manually)
 * still goes through the normal draft/Save flow like every other field. */
function LogoUploader({ value, onUploaded, onRemove, dark }) {
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toast.error('Please choose a PNG, JPG, WEBP, or SVG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be smaller than 5MB.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await api.post('/admin/report-config/logo', formData);
      onUploaded(res.data.reportConfig);
      toast.success('Logo uploaded!');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error uploading logo');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!uploading) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        if (uploading) return;
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12,
        cursor: uploading ? 'wait' : 'pointer',
        border: `2px dashed ${dragOver ? '#1a3a6b' : (dark ? '#2a3042' : '#d1d5db')}`,
        background: dragOver ? (dark ? 'rgba(26,58,107,0.15)' : 'rgba(26,58,107,0.05)') : (dark ? '#1a1f2e' : '#f9fafb'),
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
      <div style={{
        width: 56, height: 56, borderRadius: 12, flexShrink: 0, overflow: 'hidden',
        background: dark ? '#0f1117' : '#fff', border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {value
          ? <img src={value} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
          : <UploadCloud size={20} color={dark ? '#4a5168' : '#9ca3af'} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: dark ? '#e2e8f0' : '#111827' }}>
          {uploading ? 'Uploading…' : value ? 'Click or drop to replace logo' : 'Click or drag & drop to upload logo'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>
          PNG, JPG, WEBP or SVG · up to 5MB · appears on every printed report
        </p>
      </div>
      {value && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title="Remove logo"
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: dark ? '#7b839a' : '#9ca3af', padding: 4, flexShrink: 0 }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function ReportConfigPanel({ config, onChange, dark }) {
  const [draft, setDraft] = useState({ ...config });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft({ ...config }); }, [config]);

  const labelSt = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: dark ? '#7b839a' : '#6b7280', display: 'block', marginBottom: 4,
  };
  const inputSt = {
    width: '100%', padding: '9px 12px', borderRadius: 10, boxSizing: 'border-box',
    border: `1px solid ${dark ? '#2a3042' : '#d1d5db'}`,
    background: dark ? '#1a1f2e' : '#f9fafb',
    color: dark ? '#e2e8f0' : '#111827', fontSize: 13, outline: 'none',
  };
  const cardSt = {
    background: dark ? '#13161f' : '#fff',
    border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
    borderRadius: 14, padding: 20,
  };

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      {label && <label style={labelSt}>{label}</label>}
      {type === 'textarea'
        ? <textarea value={draft[key] || ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} rows={3} placeholder={placeholder} style={{ ...inputSt, resize: 'vertical' }} />
        : <input type={type} value={draft[key] || ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} placeholder={placeholder} style={inputSt} />
      }
    </div>
  );

  async function handleSave() {
    setSaving(true);
    try {
      const saved_ = await persistReportConfig(draft);
      onChange(saved_);
      setDraft(saved_);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Report configuration saved!');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error saving report configuration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={15} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#111827' }}>Government / Authority Header</p>
            <p style={{ margin: 0, fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>Shown top-left of the report</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>{field('Republic / Country', 'republic', 'text', 'REPUBLIC OF RWANDA')}</div>
          <div style={{ gridColumn: '1/-1' }}>{field('Ministry', 'ministry', 'text', 'MINISTRY OF EDUCATION')}</div>
          {field('District', 'district', 'text', 'DISTRICT ...')}
          <div style={{ gridColumn: '1/-1' }}>{field('School / Lycée Name', 'schoolName', 'text', 'Lycée de Ruhango Ikirezi ...')}</div>
          <div style={{ gridColumn: '1/-1' }}>{field('School Motto / Tagline', 'schoolMotto', 'text', 'Excellence Through Knowledge')}</div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelSt}>School Logo</label>
            <LogoUploader
              value={draft.schoolLogoUrl}
              dark={dark}
              onUploaded={(serverCfg) => { setDraft(d => ({ ...d, schoolLogoUrl: serverCfg.schoolLogoUrl })); onChange(serverCfg); }}
              onRemove={() => setDraft(d => ({ ...d, schoolLogoUrl: '' }))}
            />
            <p style={{ margin: '8px 0 4px', fontSize: 10.5, color: dark ? '#5b6377' : '#9ca3af' }}>
              Or paste an image URL directly (remember to press Save below):
            </p>
            {field('', 'schoolLogoUrl', 'text', 'https://…')}
          </div>
        </div>
      </div>

      <div style={cardSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={15} color="#fff" />
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#111827' }}>Contact Information</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>{field('Address', 'schoolAddress')}</div>
          {field('Phone / Tel', 'schoolPhone')}
          {field('Email', 'schoolEmail', 'email')}
          <div style={{ gridColumn: '1/-1' }}>{field('Website', 'schoolWebsite')}</div>
        </div>
      </div>

      <div style={cardSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User2 size={15} color="#fff" />
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#111827' }}>Report Signatory</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {field('Principal / Director Name', 'managerName', 'text', 'Full Name')}
          {field('Title / Role', 'managerTitle', 'text', 'School Principal')}
        </div>
      </div>

      <div style={cardSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#06b6d4,#0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlignLeft size={15} color="#fff" />
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#111827' }}>Footer Legend / Note</p>
        </div>
        {field('Legend text (shown below the marks table)', 'footerNote', 'textarea')}
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '12px 24px', borderRadius: 12, border: 'none',
        background: saved ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#1a3a6b,#1565c0)',
        color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
        boxShadow: '0 4px 20px rgba(26,58,107,0.35)', transition: 'all 0.3s', opacity: saving ? 0.75 : 1,
      }}>
        {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
        {saving ? 'Saving…' : saved ? 'Saved Successfully!' : 'Save Report Configuration'}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function AdminAssessments() {
  const { dark } = useTheme();
  const { user } = useAuth();

  const [tab, setTab]                   = useState('courses');
  const [reportType, setReportType]     = useState('class');
  const [reportConfig, setReportConfig] = useState({ ...DEFAULT_REPORT_CONFIG });

  const [courses,     setCourses]     = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [students,    setStudents]    = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading,     setLoading]     = useState(false);

  /* ── Course tab filters + view mode ── */
  const [courseView,           setCourseView]           = useState('cards');
  const [courseFilterTeacher,  setCourseFilterTeacher]  = useState('');
  const [courseFilterCategory, setCourseFilterCategory] = useState('');
  const [courseFilterClass,    setCourseFilterClass]    = useState('');

  /* ── Report state ── */
  const [reportFilter,  setReportFilter]  = useState({ term: '', year: '', studentId: '', studentIds: [], assessmentId: '', classId: '' });
  const [reportData,    setReportData]    = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  /* ── Submissions state ── */
  const [submissions,              setSubmissions]              = useState([]);
  const [submissionsLoading,       setSubmissionsLoading]       = useState(false);
  const [submissionFilter,         setSubmissionFilter]         = useState('');
  const [submissionTeacherFilter,  setSubmissionTeacherFilter]  = useState('');
  const [submissionCourseFilter,   setSubmissionCourseFilter]   = useState('');
  const [submissionClassFilter,    setSubmissionClassFilter]    = useState('');
  const [submissionCategoryFilter, setSubmissionCategoryFilter] = useState('');
  const [viewingSubmission,        setViewingSubmission]        = useState(null);
  const [viewingSubmissionLoading, setViewingSubmissionLoading] = useState(false);
  const [rejectingId,              setRejectingId]              = useState(null);
  const [rejectNote,               setRejectNote]               = useState('');
  const [submissionActionLoading,  setSubmissionActionLoading]  = useState(false);

  /* ── Course modal ── */
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse,   setEditingCourse]   = useState(null);

  /*
   * class_ids: string[]  — array of class IDs (replaces single class_id)
   * We still send class_id (first entry) to the API for backwards compat,
   * plus class_ids for the new multi-class endpoint.
   */
  const [courseForm, setCourseForm] = useState({
    name: '', code: '', description: '', total_marks: 100,
    class_ids: [],          // ← NEW: multiple classes
    teacher_id: '', category: 'Complementary modules',
  });

  const [confirmModal, setConfirmModal] = useState({
    open: false, variant: 'warning', title: '', message: '', onConfirm: null, loading: false, confirmText: 'Confirm',
  });

  const card       = { background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`, borderRadius: 16, padding: 20 };
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#d1d5db'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#111827', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: dark ? '#7b839a' : '#6b7280', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' };

  function openConfirm(opts) { setConfirmModal({ open: true, loading: false, confirmText: 'Confirm', cancelText: 'Cancel', ...opts }); }
  function closeConfirm()    { setConfirmModal(prev => ({ ...prev, open: false, loading: false })); }

  /* ── Data fetch ── */
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
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchReportConfig().then(setReportConfig); }, []);

  const fetchSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const res = await api.get('/assessment/admin/submissions', { params: submissionFilter ? { status: submissionFilter } : {} });
      setSubmissions(res.data.assessments || []);
    } catch { toast.error('Failed to load submissions'); }
    finally { setSubmissionsLoading(false); }
  }, [submissionFilter]);

  useEffect(() => { if (tab === 'submissions') fetchSubmissions(); }, [tab, fetchSubmissions]);

  async function viewSubmission(assessmentId) {
    setViewingSubmissionLoading(true);
    setViewingSubmission(null);
    try {
      const res = await api.get('/assessment/admin/submissions/' + assessmentId);
      setViewingSubmission(res.data);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to load submission'); }
    finally { setViewingSubmissionLoading(false); }
  }

  async function approveSubmission(assessmentId) {
    openConfirm({
      variant: 'success', title: 'Approve Submission',
      message: 'Approving this submission will update all reports. This action cannot be undone.',
      confirmText: 'Approve & Publish',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.post('/assessment/admin/submissions/' + assessmentId + '/approve');
          toast.success('Assessment approved');
          setViewingSubmission(null);
          fetchSubmissions();
          closeConfirm();
        } catch (e) {
          toast.error(e.response?.data?.message || 'Error approving');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  }

  async function rejectSubmission(assessmentId) {
    setSubmissionActionLoading(true);
    try {
      await api.post('/assessment/admin/submissions/' + assessmentId + '/reject', { note: rejectNote });
      toast.success('Assessment rejected — teacher can edit again');
      setRejectingId(null); setRejectNote('');
      setViewingSubmission(null);
      fetchSubmissions();
      closeConfirm();
    } catch (e) { toast.error(e.response?.data?.message || 'Error rejecting'); }
    finally { setSubmissionActionLoading(false); }
  }

  function openRejectModal(assessmentId) {
    setRejectNote('');
    setRejectingId(assessmentId);
    openConfirm({
      variant: 'reject', title: 'Reject Submission',
      message: 'The teacher will regain edit access to fix the marks.',
      confirmText: 'Reject & Send Back',
      onConfirm: () => rejectSubmission(assessmentId),
    });
  }

  const classStudents = useCallback((classId) => {
    if (!classId) return students;
    const cls = classes.find(c => (c._id || c.id) === classId);
    if (!cls) return [];
    const ids = (cls.students || []).map(s => s._id || s.id || s);
    return students.filter(s => ids.includes(s._id || s.id));
  }, [students, classes]);

  /* ── Course CRUD ── */
  function openCreateCourse() {
    setEditingCourse(null);
    setCourseForm({
      name: '', code: '', description: '', total_marks: 100,
      class_ids: [], teacher_id: '', category: 'Complementary modules',
    });
    setShowCourseModal(true);
  }

  function openEditCourse(c) {
    setEditingCourse(c);
    /*
     * Support both old (single class_id) and new (class_ids array) shapes
     * coming back from the API.
     */
    let class_ids = [];
    if (Array.isArray(c.class_ids) && c.class_ids.length > 0) {
      class_ids = c.class_ids.map(id => (typeof id === 'object' ? id._id || id.id : id));
    } else if (c.class_id) {
      const single = typeof c.class_id === 'object' ? c.class_id._id || c.class_id.id : c.class_id;
      if (single) class_ids = [single];
    }
    setCourseForm({
      name: c.name || '', code: c.code || '', description: c.description || '',
      total_marks: c.total_marks || 100,
      class_ids,
      teacher_id: c.teacher_id?._id || c.teacher_id || '',
      category: c.category || 'Complementary modules',
    });
    setShowCourseModal(true);
  }

  async function saveCourse() {
    if (!courseForm.name.trim()) { toast.error('Course name is required'); return; }
    /*
     * Send both class_ids (new) and class_id (first entry, backward compat)
     * so older API versions continue to work.
     */
    const payload = {
      ...courseForm,
      class_ids: courseForm.class_ids,
      class_id: courseForm.class_ids[0] || '',
    };
    try {
      if (editingCourse) {
        await api.put('/assessment/admin/courses/' + editingCourse._id, payload);
        toast.success('Module updated');
      } else {
        await api.post('/assessment/admin/courses', payload);
        toast.success('Module created');
      }
      setShowCourseModal(false); fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Error saving module'); }
  }

  async function deleteCourse(id) {
    openConfirm({
      variant: 'danger', title: 'Delete Module',
      message: 'This will permanently delete the module and all its assessments.',
      confirmText: 'Yes, Delete Module',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await api.delete('/assessment/admin/courses/' + id);
          toast.success('Module deleted');
          fetchAll();
          closeConfirm();
        } catch (e) {
          toast.error(e.response?.data?.message || 'Error');
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  }

  /* ── Report ── */
  const fetchReport = useCallback(async (filter = reportFilter, type = reportType) => {
    if (type === 'student'    && !filter.studentId)    { setReportData(null); return; }
    if (type === 'assessment' && !filter.assessmentId) { setReportData(null); return; }
    if (type === 'class'      && !filter.classId)      { setReportData(null); return; }
    setReportLoading(true); setReportData(null);
    try {
      let res;
      if (type === 'student') {
        res = await api.get('/assessment/admin/reports/student/' + filter.studentId, { params: { term: filter.term || undefined, year: filter.year || undefined } });
      } else if (type === 'assessment') {
        res = await api.get('/assessment/admin/reports/assessment/' + filter.assessmentId);
      } else {
        const sIds = filter.studentIds.length > 0 ? filter.studentIds.join(',') : undefined;
        res = await api.get('/assessment/admin/reports/class/' + filter.classId, { params: { term: filter.term || undefined, year: filter.year || undefined, studentIds: sIds } });
      }
      setReportData({ type, ...res.data });
    } catch (e) { toast.error(e.response?.data?.message || 'Error loading report'); }
    finally { setReportLoading(false); }
  }, [reportFilter, reportType]);

  const reportDebounceRef = useRef(null);
  useEffect(() => {
    if (tab !== 'reports') return;
    clearTimeout(reportDebounceRef.current);
    reportDebounceRef.current = setTimeout(() => fetchReport(reportFilter, reportType), 400);
    return () => clearTimeout(reportDebounceRef.current);
  }, [reportFilter, reportType, tab]); // eslint-disable-line

  const selectedClassStudents = classStudents(reportFilter.classId);

  /* ── Derived: courses belonging to selected class (submissions tab) ── */
  const coursesForSubmissionClass = submissionClassFilter
    ? courses.filter(c => {
        const ids = Array.isArray(c.class_ids) && c.class_ids.length > 0
          ? c.class_ids.map(x => typeof x === 'object' ? x._id || x.id : x)
          : [c.class_id?._id || c.class_id].filter(Boolean);
        return ids.includes(submissionClassFilter);
      })
    : courses;

  const tabs = [
    { key: 'courses',     label: 'Courses & Modules', icon: BookOpen },
    { key: 'submissions', label: 'Mark Submissions',  icon: ClipboardCheck },
    { key: 'reports',     label: 'Reports',           icon: BarChart2 },
    { key: 'config',      label: 'Report Settings',   icon: Settings },
  ];

  /* ── Filtered courses (Courses tab) ── */
  const filteredCourses = courses.filter(c => {
    if (courseFilterTeacher) {
      const tid = c.teacher_id?._id || c.teacher_id;
      if (tid !== courseFilterTeacher) return false;
    }
    if (courseFilterCategory && (c.category || 'Complementary modules') !== courseFilterCategory) return false;
    if (courseFilterClass) {
      // A course matches if it's assigned to this class (single or multi)
      const ids = Array.isArray(c.class_ids) && c.class_ids.length > 0
        ? c.class_ids.map(x => typeof x === 'object' ? x._id || x.id : x)
        : [c.class_id?._id || c.class_id].filter(Boolean);
      if (!ids.includes(courseFilterClass)) return false;
    }
    return true;
  });
  const hasActiveCourseFilter = courseFilterTeacher || courseFilterCategory || courseFilterClass;

  /* ── Filtered submissions ── */
  const filteredSubmissions = submissions.filter(a => {
    if (submissionTeacherFilter) {
      const tid = a.teacher_id?._id || a.teacher_id;
      if (tid !== submissionTeacherFilter) return false;
    }
    if (submissionCourseFilter) {
      const cid = a.course_id?._id || a.course_id;
      if (cid !== submissionCourseFilter) return false;
    }
    if (submissionClassFilter) {
      const courseId = a.course_id?._id || a.course_id;
      const inClass  = coursesForSubmissionClass.some(c => (c._id || c.id) === courseId);
      if (!inClass) return false;
    }
    if (submissionCategoryFilter) {
      const cat = a.course_id?.category || '';
      if (cat !== submissionCategoryFilter) return false;
    }
    return true;
  });

  /* ── Helper: resolve class names for a course (multi or single) ── */
  function getCourseClassNames(c) {
    if (Array.isArray(c.class_ids) && c.class_ids.length > 0) {
      return c.class_ids.map(x => {
        if (typeof x === 'object') return x.name || x._id || x.id;
        const found = classes.find(cl => (cl._id || cl.id) === x);
        return found ? found.name : x;
      });
    }
    if (c.class_id) {
      const name = typeof c.class_id === 'object' ? c.class_id.name : null;
      return [name || c.class_id];
    }
    return [];
  }

  /* ── shared select style ── */
  const filterSelect = (active) => ({
    padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', outline: 'none', minWidth: 160,
    border: `1px solid ${active ? '#1a3a6b' : (dark ? '#2a3042' : '#e5e7eb')}`,
    background: active ? 'rgba(26,58,107,0.08)' : (dark ? '#1a1f2e' : '#f9fafb'),
    color: active ? '#1a3a6b' : (dark ? '#e2e8f0' : '#374151'),
  });

  return (
    <div>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes fadeUp{ from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @media print {
          .no-print  { display: none !important; }
          body       { background: white !important; }
          .print-area{ padding: 0 !important; }
        }
        .course-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(26,58,107,0.18) !important; }
        .course-card       { transition: all 0.2s ease; }
      `}</style>

      {/* ── Page Header ── */}
      <div className="no-print" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GraduationCap size={20} color="#fff" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827', margin: 0, fontFamily: "'Sora',sans-serif" }}>
                Modules, Submissions and Report Management
              </h1>
            </div>
            <p style={{ fontSize: 13, color: dark ? '#7b839a' : '#6b7280', margin: '0 0 0 50px' }}>
              Manage TVET modules, mark submissions and generate official assessment reports
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Courses',     val: courses.length,     color: '#1a3a6b' },
              { label: 'Assessments', val: assessments.length, color: '#8b5cf6' },
              { label: 'Students',    val: students.length,    color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{ padding: '8px 16px', borderRadius: 12, background: s.color + '18', border: '1px solid ' + s.color + '33', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</span>
                <span style={{ fontSize: 10, color: dark ? '#7b839a' : '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 20, borderBottom: `2px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
              border: 'none', borderRadius: '10px 10px 0 0',
              background: tab === key ? (dark ? '#1d2235' : '#fff') : 'transparent',
              color: tab === key ? '#1a3a6b' : (dark ? '#7b839a' : '#6b7280'),
              fontWeight: tab === key ? 700 : 500, fontSize: 13, cursor: 'pointer',
              borderBottom: tab === key ? '2px solid #1a3a6b' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ COURSES TAB ══════════ */}
      {tab === 'courses' && (
        <div className="no-print" style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, background: dark ? '#1a1f2e' : '#f1f5f9', border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}` }}>
              <Filter size={12} color={dark ? '#7b839a' : '#6b7280'} />
              <span style={{ fontSize: 11, fontWeight: 700, color: dark ? '#7b839a' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Class</label>
              <select value={courseFilterClass} onChange={e => setCourseFilterClass(e.target.value)} style={filterSelect(courseFilterClass)}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Teacher</label>
              <select value={courseFilterTeacher} onChange={e => setCourseFilterTeacher(e.target.value)} style={filterSelect(courseFilterTeacher)}>
                <option value="">All Teachers</option>
                {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Module Type</label>
              <select value={courseFilterCategory} onChange={e => setCourseFilterCategory(e.target.value)} style={filterSelect(courseFilterCategory)}>
                <option value="">All Types</option>
                {ALL_MODULE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {hasActiveCourseFilter && (
              <button onClick={() => { setCourseFilterTeacher(''); setCourseFilterCategory(''); setCourseFilterClass(''); }} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#7b839a' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-end' }}>
                Clear
              </button>
            )}
            {hasActiveCourseFilter && (
              <div style={{ alignSelf: 'flex-end', padding: '7px 12px', borderRadius: 8, background: 'rgba(26,58,107,0.08)', border: '1px solid rgba(26,58,107,0.2)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a3a6b' }}>{filteredCourses.length} module{filteredCourses.length !== 1 ? 's' : ''} found</span>
              </div>
            )}

            {/* View toggle */}
            <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 2, padding: 3, borderRadius: 9, background: dark ? '#1a1f2e' : '#f1f5f9', border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}` }}>
              {[
                { key: 'cards', icon: '⊞', title: 'Card view' },
                { key: 'table', icon: '☰', title: 'Table view' },
              ].map(v => (
                <button key={v.key} title={v.title} onClick={() => setCourseView(v.key)} style={{
                  width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 14,
                  background: courseView === v.key ? (dark ? '#2a3042' : '#fff') : 'transparent',
                  color: courseView === v.key ? '#1a3a6b' : (dark ? '#7b839a' : '#9ca3af'),
                  boxShadow: courseView === v.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                }}>{v.icon}</button>
              ))}
            </div>

            <button onClick={openCreateCourse} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,58,107,0.4)', alignSelf: 'flex-end' }}>
              <Plus size={14} /> Add Module
            </button>
          </div>

          {!hasActiveCourseFilter && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {MODULE_CATEGORIES.map(cat => {
                const cb = catBadge(cat);
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: cb.bg, border: `1px solid ${cb.border}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cb.dot }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: cb.text }}>{cat}</span>
                    <span style={{ fontSize: 11, color: cb.text + '80' }}>({courses.filter(c => c.category === cat).length})</span>
                  </div>
                );
              })}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid #1a3a6b', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
              <p style={{ color: dark ? '#7b839a' : '#9ca3af', fontSize: 13 }}>Loading modules…</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 70 }}>
              <div style={{ width: 70, height: 70, borderRadius: 20, background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <BookOpen size={30} color="#fff" />
              </div>
              <p style={{ color: dark ? '#e8ecf4' : '#111827', fontWeight: 800, fontSize: 17, margin: '0 0 6px' }}>
                {hasActiveCourseFilter ? 'No modules match your filters' : 'No Modules Yet'}
              </p>
              <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: '0 0 20px', fontSize: 13 }}>
                {hasActiveCourseFilter ? 'Try adjusting the class, teacher or type filters above.' : 'Add TVET modules to assign teachers and track assessments.'}
              </p>
              {!hasActiveCourseFilter && (
                <button onClick={openCreateCourse} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  <Plus size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />Add Your First Module
                </button>
              )}
            </div>
          ) : (
            ALL_MODULE_CATEGORIES.map(cat => {
              const catCourses = filteredCourses.filter(c => (c.category || 'Complementary modules') === cat);
              if (catCourses.length === 0) return null;
              const cb = catBadge(cat);
              return (
                <div key={cat} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ height: 2, width: 20, background: cb.dot, borderRadius: 2 }} />
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: cb.text, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat}</h3>
                    <div style={{ height: 2, flex: 1, background: cb.dot + '20', borderRadius: 2 }} />
                    <span style={{ fontSize: 11, color: cb.text, fontWeight: 700 }}>{catCourses.length} modules</span>
                  </div>

                  {courseView === 'cards' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                      {catCourses.map(c => {
                        const classNames = getCourseClassNames(c);
                        return (
                          <div key={c._id} className="course-card" style={{ ...card, position: 'relative', overflow: 'hidden', boxShadow: dark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)', padding: 16 }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cb.dot }} />
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div style={{ flex: 1 }}>
                                {c.code && <div style={{ fontSize: 10, fontWeight: 800, color: cb.text, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{c.code}</div>}
                                <p style={{ fontSize: 13, fontWeight: 700, color: dark ? '#e8ecf4' : '#111827', margin: 0, lineHeight: 1.4 }}>{c.name}</p>
                              </div>
                              <div style={{ display: 'flex', gap: 5, marginLeft: 8 }}>
                                <button onClick={() => openEditCourse(c)} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Edit2 size={11} color={dark ? '#7b839a' : '#6b7280'} />
                                </button>
                                <button onClick={() => deleteCourse(c._id)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Trash2 size={11} color="#ef4444" />
                                </button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <div style={{ padding: '2px 8px', borderRadius: 6, background: cb.bg, border: `1px solid ${cb.border}` }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: cb.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat.replace(' modules', '')}</span>
                              </div>
                              <div style={{ padding: '3px 9px', borderRadius: 6, background: cb.bg, border: `1px solid ${cb.border}` }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: cb.text }}>Weight: {c.total_marks || 100} marks</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {classNames.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 11, color: dark ? '#7b839a' : '#6b7280' }}>
                                  <School size={10} color={dark ? '#7b839a' : '#9ca3af'} style={{ marginTop: 2, flexShrink: 0 }} />
                                  <div>
                                    {classNames.length === 1
                                      ? <span>Class: <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{classNames[0]}</strong></span>
                                      : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                                          <span style={{ marginRight: 2 }}>Classes:</span>
                                          {classNames.map((n, i) => (
                                            <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: 'rgba(26,58,107,0.08)', border: '1px solid rgba(26,58,107,0.2)', color: '#1a3a6b' }}>{n}</span>
                                          ))}
                                        </div>
                                      )}
                                  </div>
                                </div>
                              )}
                              {c.teacher_id && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: dark ? '#7b839a' : '#6b7280' }}><UserCheck size={10} color={dark ? '#7b839a' : '#9ca3af'} />Teacher: <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{c.teacher_id?.name || 'Assigned'}</strong></div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── Table view ── */
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: dark ? '#1a1f2e' : '#f9fafb', borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>
                            {['Code', 'Module Name', 'Weight', 'Classes', 'Teacher', 'Actions'].map(h => (
                              <th key={h} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {catCourses.map((c, i) => {
                            const classNames = getCourseClassNames(c);
                            return (
                              <tr key={c._id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#fafbfd'), borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}` }}>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  {c.code
                                    ? <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: cb.text, background: cb.bg, padding: '2px 7px', borderRadius: 5, border: `1px solid ${cb.border}` }}>{c.code}</span>
                                    : <span style={{ color: dark ? '#4a5068' : '#d1d5db', fontSize: 12 }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: dark ? '#e8ecf4' : '#111827' }}>{c.name}</span>
                                </td>
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: cb.text }}>{c.total_marks || 100}</span>
                                  <span style={{ fontSize: 11, color: dark ? '#7b839a' : '#9ca3af', marginLeft: 3 }}>marks</span>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {classNames.length === 0
                                    ? <span style={{ color: dark ? '#4a5068' : '#d1d5db', fontSize: 12 }}>—</span>
                                    : (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {classNames.map((n, idx) => (
                                          <span key={idx} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(26,58,107,0.08)', border: '1px solid rgba(26,58,107,0.2)', color: '#1a3a6b', whiteSpace: 'nowrap' }}>{n}</span>
                                        ))}
                                      </div>
                                    )}
                                </td>
                                <td style={{ padding: '10px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151', whiteSpace: 'nowrap' }}>
                                  {c.teacher_id?.name || <span style={{ color: dark ? '#4a5068' : '#d1d5db' }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => openEditCourse(c)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#94a3b8' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                      <Edit2 size={10} /> Edit
                                    </button>
                                    <button onClick={() => deleteCourse(c._id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                      <Trash2 size={10} /> Delete
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
              );
            })
          )}
        </div>
      )}

      {/* ══════════ MARK SUBMISSIONS TAB ══════════ */}
      {tab === 'submissions' && (
        <div className="no-print" style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ ...card, marginBottom: 16, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#6b7280', fontWeight: 700 }}>Filters:</span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Class</label>
                <select
                  value={submissionClassFilter}
                  onChange={e => { setSubmissionClassFilter(e.target.value); setSubmissionCourseFilter(''); }}
                  style={filterSelect(submissionClassFilter)}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Teacher</label>
                <select value={submissionTeacherFilter} onChange={e => setSubmissionTeacherFilter(e.target.value)} style={filterSelect(submissionTeacherFilter)}>
                  <option value="">All Teachers</option>
                  {teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Course {submissionClassFilter ? `(${coursesForSubmissionClass.length})` : ''}
                </label>
                <select value={submissionCourseFilter} onChange={e => setSubmissionCourseFilter(e.target.value)} style={filterSelect(submissionCourseFilter)}>
                  <option value="">{submissionClassFilter ? 'All Class Courses' : 'All Courses'}</option>
                  {coursesForSubmissionClass.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Module Type</label>
                <select value={submissionCategoryFilter} onChange={e => setSubmissionCategoryFilter(e.target.value)} style={filterSelect(submissionCategoryFilter)}>
                  <option value="">All Types</option>
                  {ALL_MODULE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: dark ? '#7b839a' : '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Status</label>
                <select value={submissionFilter} onChange={e => setSubmissionFilter(e.target.value)} style={filterSelect(submissionFilter)}>
                  <option value="">All Statuses</option>
                  <option value="submitted">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              {(submissionClassFilter || submissionTeacherFilter || submissionCourseFilter || submissionFilter || submissionCategoryFilter) && (
                <button
                  onClick={() => { setSubmissionClassFilter(''); setSubmissionTeacherFilter(''); setSubmissionCourseFilter(''); setSubmissionFilter(''); setSubmissionCategoryFilter(''); }}
                  style={{ marginTop: 14, padding: '7px 12px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#7b839a' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  Clear
                </button>
              )}
              <button onClick={fetchSubmissions} style={{ marginLeft: 'auto', marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#7b839a' : '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {submissionsLoading ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #1a3a6b', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: dark ? '#7b839a' : '#9ca3af' }}>Loading submissions…</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 60 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(26,58,107,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ClipboardCheck size={28} color="#1a3a6b" />
              </div>
              <p style={{ color: dark ? '#e8ecf4' : '#111827', fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>No Submissions Found</p>
              <p style={{ color: dark ? '#7b839a' : '#9ca3af', margin: 0, fontSize: 13 }}>
                {submissionClassFilter ? 'No mark submissions found for this class.' : 'Marks submitted by teachers will appear here.'}
              </p>
            </div>
          ) : (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Assessment', 'Course', 'Category', 'Teacher', 'Type', 'Term', 'Marked', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left', borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((a, i) => {
                      const statusInfo = {
                        draft:     { label: 'Draft',    color: '#9ca3af', icon: Clock },
                        submitted: { label: 'Pending',  color: '#f59e0b', icon: Clock },
                        approved:  { label: 'Approved', color: '#10b981', icon: CheckCircle },
                        rejected:  { label: 'Rejected', color: '#ef4444', icon: XCircle },
                      }[a.submission_status] || { label: a.submission_status, color: '#9ca3af', icon: Clock };
                      const StatusIcon = statusInfo.icon;
                      const courseCat  = a.course_id?.category || '';
                      const cb         = catBadge(courseCat);
                      return (
                        <tr key={a._id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff04' : '#f9fafb40'), borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}` }}>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: dark ? '#e8ecf4' : '#111827' }}>{a.title}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.course_id?.name}</td>
                          <td style={{ padding: '10px 14px' }}>
                            {courseCat && (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: cb.bg, color: cb.text, border: `1px solid ${cb.border}`, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                {courseCat.replace(' modules', '')}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.teacher_id?.name || '—'}</td>
                          <td style={{ padding: '10px 14px' }}><TypeBadge type={a.type} /></td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.term}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: dark ? '#c4c9d4' : '#374151' }}>{a.marked_count}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 7, background: statusInfo.color + '18', color: statusInfo.color, border: `1px solid ${statusInfo.color}40` }}>
                              <StatusIcon size={11} /> {statusInfo.label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => viewSubmission(a._id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                <Eye size={11} /> View
                              </button>
                              {(a.submission_status === 'submitted' || a.submission_status === 'approved') && (
                                <>
                                  {a.submission_status === 'submitted' && (
                                    <button onClick={() => approveSubmission(a._id)} disabled={submissionActionLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                      <CheckCircle size={11} /> Approve
                                    </button>
                                  )}
                                  <button onClick={() => openRejectModal(a._id)} disabled={submissionActionLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                    <XCircle size={11} /> Reject
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

          {/* Submission Detail Modal */}
          {(viewingSubmission || viewingSubmissionLoading) && (
            <div onClick={e => { if (e.target === e.currentTarget) setViewingSubmission(null); }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ width: 720, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', borderRadius: 18, background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`, padding: 26, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
                {viewingSubmissionLoading ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1a3a6b', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ color: dark ? '#7b839a' : '#9ca3af' }}>Loading…</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>{viewingSubmission.assessment?.title}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>
                          {viewingSubmission.assessment?.course_id?.name} · {viewingSubmission.assessment?.term} · {viewingSubmission.assessment?.academic_year} · Teacher: {viewingSubmission.assessment?.teacher_id?.name}
                        </p>
                      </div>
                      <button onClick={() => setViewingSubmission(null)} style={{ border: 'none', background: dark ? '#1e2130' : '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <X size={16} />
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto', marginTop: 16 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['#', 'Student', 'Marks', `/ ${viewingSubmission.assessment?.max_marks}`, '%', 'Grade'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textAlign: 'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(viewingSubmission.students || []).map((s, i) => (
                            <tr key={s.student_id} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff05' : '#f9fafb50') }}>
                              <td style={{ padding: '8px 12px', fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{i + 1}</td>
                              <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: dark ? '#e2e8f0' : '#374151' }}>{s.name}</td>
                              <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: pctColor(s.percentage) }}>{s.marks ?? '—'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 13, color: dark ? '#e2e8f0' : '#374151' }}>{s.max_marks}</td>
                              <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: pctColor(s.percentage) }}>{s.percentage != null ? Math.min(s.percentage, 100) + '%' : '—'}</td>
                              <td style={{ padding: '8px 12px' }}><GradeBadge grade={s.grade} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(viewingSubmission.submission?.status === 'submitted' || viewingSubmission.submission?.status === 'approved') && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                        <button onClick={() => openRejectModal(viewingSubmission.assessment?.id || viewingSubmission.assessment?._id)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          <XCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Reject
                        </button>
                        {viewingSubmission.submission?.status === 'submitted' && (
                          <button onClick={() => approveSubmission(viewingSubmission.assessment?.id || viewingSubmission.assessment?._id)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            <CheckCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Approve
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ REPORTS TAB ══════════ */}
      {tab === 'reports' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <div className="no-print" style={{ ...card, marginBottom: 20 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: dark ? '#94a3b8' : '#374151' }}>Select Report Type</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {[
                { key: 'class',      label: 'Class Report',       icon: Users,         desc: 'Full TVET report per student in class' },
                { key: 'student',    label: 'Single Student',     icon: GraduationCap, desc: 'Individual progress report' },
                { key: 'assessment', label: 'Assessment Results', icon: FileText,      desc: 'Results for one assessment' },
              ].map(({ key, label, icon: Icon, desc }) => (
                <button key={key} onClick={() => { setReportType(key); setReportData(null); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${reportType === key ? '#1a3a6b' : (dark ? '#2a3042' : '#e5e7eb')}`,
                  background: reportType === key ? 'rgba(26,58,107,0.08)' : (dark ? '#1a1f2e' : '#f9fafb'),
                  transition: 'all 0.15s', flex: 1, minWidth: 160,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: reportType === key ? 'linear-gradient(135deg,#1a3a6b,#1565c0)' : (dark ? '#2a3042' : '#e5e7eb'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={17} color={reportType === key ? '#fff' : (dark ? '#7b839a' : '#9ca3af')} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: reportType === key ? '#1a3a6b' : (dark ? '#e8ecf4' : '#111827') }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: dark ? '#7b839a' : '#9ca3af' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
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
                <>
                  <div>
                    <label style={labelStyle}>Class</label>
                    <select value={reportFilter.classId} onChange={e => setReportFilter(f => ({ ...f, classId: e.target.value, studentIds: [] }))} style={inputStyle}>
                      <option value="">Select class…</option>
                      {classes.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {reportFilter.classId && (
                    <div>
                      <label style={labelStyle}>Filter Students (optional)</label>
                      <select value="" onChange={e => {
                        const v = e.target.value;
                        if (v === '__all__') setReportFilter(f => ({ ...f, studentIds: [] }));
                        else if (v && !reportFilter.studentIds.includes(v)) setReportFilter(f => ({ ...f, studentIds: [...f.studentIds, v] }));
                      }} style={inputStyle}>
                        <option value="">Add student…</option>
                        <option value="__all__">— All Students —</option>
                        {selectedClassStudents.filter(s => !reportFilter.studentIds.includes(s._id || s.id)).map(s => (
                          <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                        ))}
                      </select>
                      {reportFilter.studentIds.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                          {reportFilter.studentIds.map(id => {
                            const st = students.find(s => (s._id || s.id) === id);
                            return st ? (
                              <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(26,58,107,0.12)', border: '1px solid rgba(26,58,107,0.25)', fontSize: 11, color: '#1a3a6b', fontWeight: 600 }}>
                                {st.name}
                                <button onClick={() => setReportFilter(f => ({ ...f, studentIds: f.studentIds.filter(x => x !== id) }))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#1a3a6b' }}>×</button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {(reportType === 'student' || reportType === 'class') && (
                <>
                  <div>
                    <label style={labelStyle}>Term</label>
                    <select value={reportFilter.term} onChange={e => setReportFilter(f => ({ ...f, term: e.target.value }))} style={inputStyle}>
                      <option value="">Annual (1st, 2nd, 3rd + Overall)</option>
                      {TERMS.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <p style={{ margin: '4px 0 0', fontSize: 10.5, color: dark ? '#7b839a' : '#9ca3af' }}>
                      {reportFilter.term
                        ? `Only ${reportFilter.term} will be shown on the report.`
                        : 'Annual report shows all three terms plus the overall annual average.'}
                    </p>
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

            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {reportLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(26,58,107,0.08)', border: '1px solid rgba(26,58,107,0.2)' }}>
                  <div style={{ width: 14, height: 14, border: '2px solid rgba(26,58,107,0.4)', borderTopColor: '#1a3a6b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: 12, color: '#1a3a6b', fontWeight: 600 }}>Generating report…</span>
                </div>
              )}
              {reportData && !reportLoading && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <CheckCircle size={13} color="#10b981" />
                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Report ready</span>
                  </div>
                  <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Printer size={14} /> Print / Export PDF
                  </button>
                  <button onClick={() => setReportData(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#7b839a' : '#9ca3af', fontSize: 13, cursor: 'pointer' }}>
                    <RefreshCw size={13} /> Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {reportData && (
            <div className="print-area">
              <ReportView data={reportData} dark={dark} students={students} classes={classes} config={reportConfig} selectedTerm={reportFilter.term || null} />
            </div>
          )}
        </div>
      )}

      {/* ══════════ CONFIG TAB ══════════ */}
      {tab === 'config' && (
        <div className="no-print" style={{ animation: 'fadeUp 0.3s ease' }}>
          <div style={{ ...card, marginBottom: 20, background: 'linear-gradient(135deg,#1a3a6b10,#1565c008)', borderColor: '#1a3a6b25' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Settings size={24} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>Report Configuration</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: dark ? '#7b839a' : '#6b7280' }}>
                  Customise school branding, contact details, and signatory for all reports.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
            <ReportConfigPanel config={reportConfig} onChange={cfg => setReportConfig(cfg)} dark={dark} />
            <div style={{ position: 'sticky', top: 20 }}>
              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Eye size={14} color="#1a3a6b" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Preview</span>
                </div>
                <ReportHeaderPreview config={reportConfig} />
              </div>
              <div style={{ padding: '12px 16px', borderRadius: 12, background: dark ? '#1a1f2e' : '#f0f9ff', border: `1px solid ${dark ? '#2a3042' : '#bae6fd'}` }}>
                <p style={{ margin: 0, fontSize: 11, color: dark ? '#7b839a' : '#0369a1', lineHeight: 1.6 }}>
                  💡 <strong>Tip:</strong> All changes are saved to your browser and applied instantly to new reports.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ COURSE MODAL ══════════ */}
      {showCourseModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowCourseModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 560, borderRadius: 22, background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`, padding: 30, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={18} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>{editingCourse ? 'Edit Module' : 'Add New Module'}</h2>
                <p style={{ margin: 0, fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>Fill in the module details below</p>
              </div>
              <button onClick={() => setShowCourseModal(false)} style={{ border: 'none', background: dark ? '#1e2130' : '#f3f4f6', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Module Type */}
              <div>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Module Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {MODULE_CATEGORIES.map(cat => {
                    const cb = catBadge(cat);
                    const selected = courseForm.category === cat;
                    return (
                      <button key={cat} type="button" onClick={() => setCourseForm(f => ({ ...f, category: cat }))} style={{ padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', border: `2px solid ${selected ? cb.dot : (dark ? '#2a3042' : '#e5e7eb')}`, background: selected ? cb.bg : 'transparent', transition: 'all 0.15s' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: cb.dot, margin: '0 auto 6px' }} />
                        <span style={{ fontSize: 11, fontWeight: selected ? 800 : 500, color: selected ? cb.text : (dark ? '#7b839a' : '#6b7280'), display: 'block', lineHeight: 1.3 }}>
                          {cat.replace(' modules', '')}
                        </span>
                        {selected && <span style={{ fontSize: 9, color: cb.text, fontWeight: 700 }}>✓ Selected</span>}
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setCourseForm(f => ({ ...f, category: 'Elective Non Examinable' }))} style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 9, cursor: 'pointer', textAlign: 'left', border: `1.5px solid ${courseForm.category === 'Elective Non Examinable' ? '#4a044e' : (dark ? '#2a3042' : '#e5e7eb')}`, background: courseForm.category === 'Elective Non Examinable' ? '#4a044e15' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a044e', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: courseForm.category === 'Elective Non Examinable' ? 700 : 500, color: courseForm.category === 'Elective Non Examinable' ? '#4a044e' : (dark ? '#7b839a' : '#6b7280') }}>Elective Non Examinable</span>
                  {courseForm.category === 'Elective Non Examinable' && <span style={{ fontSize: 9, color: '#4a044e', fontWeight: 700, marginLeft: 'auto' }}>✓ Selected</span>}
                </button>
              </div>

              {/* Name + Code + Weight */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Module Name *</label>
                  <input value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. CREATE A BUSINESS" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Module Code</label>
                  <input value={courseForm.code} onChange={e => setCourseForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CCMCB302" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Module Weight (Max Marks) *</label>
                  <input type="number" min={1} max={1000} value={courseForm.total_marks} onChange={e => setCourseForm(f => ({ ...f, total_marks: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* ── Multi-class assignment ── */}
              <div>
                <label style={{ ...labelStyle, marginBottom: 6 }}>
                  Assign to Classes
                  {courseForm.class_ids.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(26,58,107,0.10)', color: '#1a3a6b', border: '1px solid rgba(26,58,107,0.25)' }}>
                      {courseForm.class_ids.length} selected
                    </span>
                  )}
                </label>

                {/* Info tip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, background: dark ? '#1a1f2e' : '#f0f9ff', border: `1px solid ${dark ? '#2a3042' : '#bae6fd'}`, marginBottom: 10 }}>
                  <Users size={12} color="#0369a1" />
                  <span style={{ fontSize: 11, color: dark ? '#7b839a' : '#0369a1' }}>
                    This module will be available to all selected classes simultaneously.
                  </span>
                </div>

                <MultiClassPicker
                  classes={classes}
                  selectedIds={courseForm.class_ids}
                  onChange={ids => setCourseForm(f => ({ ...f, class_ids: ids }))}
                  dark={dark}
                />
              </div>

              {/* Teacher */}
              <div>
                <label style={labelStyle}>Assign to Teacher</label>
                <select value={courseForm.teacher_id} onChange={e => setCourseForm(f => ({ ...f, teacher_id: e.target.value }))} style={inputStyle}>
                  <option value="">No teacher assigned</option>
                  {teachers.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name} — {t.email}</option>)}
                </select>
              </div>
            </div>

            {/* Summary badge when multiple classes selected */}
            {courseForm.class_ids.length > 1 && (
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(26,58,107,0.06)', border: '1px solid rgba(26,58,107,0.18)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={14} color="#1a3a6b" />
                <span style={{ fontSize: 12, color: '#1a3a6b', fontWeight: 600 }}>
                  This module will be assigned to {courseForm.class_ids.length} classes at once.
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setShowCourseModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#94a3b8' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveCourse} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1a3a6b,#1565c0)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(26,58,107,0.35)' }}>
                {editingCourse ? 'Save Changes' : 'Create Module'}
              </button>
            </div>
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
        cancelText={confirmModal.cancelText || 'Cancel'}
      >
        {confirmModal.variant === 'reject' && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: dark ? '#7b839a' : '#6b7280', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rejection Note (optional)</label>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Explain what needs to be corrected…" style={{ width: '100%', padding: '9px 12px', borderRadius: 10, boxSizing: 'border-box', border: `1px solid ${dark ? '#2a3042' : '#d1d5db'}`, background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#e2e8f0' : '#111827', fontSize: 13, outline: 'none', resize: 'vertical' }} />
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   REPORT HEADER PREVIEW
══════════════════════════════════════════════════════════ */
function ReportHeaderPreview({ config }) {
  const pc = config.primaryColor || '#1a3a6b';
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 8, color: '#1a1a2e', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'start' }}>
        <div style={{ fontSize: 7, lineHeight: 1.7, color: '#374151' }}>
          <div style={{ fontWeight: 800 }}>{config.republic || 'REPUBLIC OF RWANDA'}</div>
          <div>{config.ministry || 'MINISTRY OF EDUCATION'}</div>
          <div>{config.district || 'DISTRICT ...'}</div>
          <div style={{ fontWeight: 700 }}>{config.schoolName || 'School Name'}</div>
          <div style={{ color: '#6b7280' }}>{config.schoolEmail}</div>
          <div style={{ color: '#6b7280' }}>{config.schoolPhone}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: pc + '15', border: '1px solid ' + pc + '30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {config.schoolLogoUrl
              ? <img src={config.schoolLogoUrl} style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: '50%' }} alt="" onError={e => e.target.style.display = 'none'} />
              : <School size={14} color={pc} />}
          </div>
        </div>
        <div style={{ fontSize: 7, lineHeight: 1.7, color: '#374151', textAlign: 'right' }}>
          <div>ACADEMIC YEAR: {config.academicYear}</div>
          <div>CLASS: Level 3 FBO A</div>
          <div>LEARNER NAME: Student Name</div>
          <div>LEARNER CODE: 1176221265</div>
        </div>
      </div>
      <div style={{ padding: '5px 10px', background: '#fff', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.06em', color: '#1a1a2e' }}>LEARNER'S ASSESSMENT REPORT</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 1fr', fontSize: 7, borderBottom: '1px solid #dee2e6' }}>
        <div style={{ padding: '3px 6px', background: '#f1f5f9', fontWeight: 700, borderRight: '1px solid #dee2e6' }}>Sector</div>
        <div style={{ padding: '3px 6px', borderRight: '1px solid #dee2e6' }}>—</div>
        <div style={{ padding: '3px 6px', background: '#f1f5f9', fontWeight: 700, borderRight: '1px solid #dee2e6' }}>Qualification</div>
        <div style={{ padding: '3px 6px' }}>—</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 1fr', fontSize: 7 }}>
        <div style={{ padding: '3px 6px', background: '#f1f5f9', fontWeight: 700, borderRight: '1px solid #dee2e6' }}>Trade</div>
        <div style={{ padding: '3px 6px', borderRight: '1px solid #dee2e6' }}>—</div>
        <div style={{ padding: '3px 6px', background: '#f1f5f9', fontWeight: 700, borderRight: '1px solid #dee2e6' }}>RTQF Level</div>
        <div style={{ padding: '3px 6px' }}>—</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   REPORT VIEW ROUTER
══════════════════════════════════════════════════════════ */
function ReportView({ data, dark, students, classes, config, selectedTerm }) {
  const printStyle = `
    @media print {
      /* A4 portrait, one report per sheet of paper */
      @page { margin: 6mm 5mm; size: A4 portrait; }
      html, body { font-size: 8.5px !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .edupla-sidebar, .mobile-overlay, .edupla-topbar, header { display: none !important; }
      .edupla-layout { display: block !important; }
      .edupla-main { width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
      /* Each student's report gets its own page: break AFTER every report so
         the next one starts fresh on a new sheet, and avoid splitting a
         single report's content across two pages. */
      .report-student-page {
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        box-shadow: none !important;
        border: none !important;
        padding: 3mm !important;
        margin: 0 !important;
      }
      .report-student-page:last-child { page-break-after: avoid !important; break-after: auto !important; }
      .print-area { padding: 0 !important; }
    }
  `;

  if (data.type === 'class') {
    const { class: cls, assessments, students: reportStudentsRaw } = data;
    if (!reportStudentsRaw || reportStudentsRaw.length === 0)
      return <div style={{ textAlign: 'center', padding: 40, color: dark ? '#7b839a' : '#9ca3af' }}>No student data for selected filters.</div>;

    // Display order: ascending rank (rank 1 first). The API already sorts this
    // way, but we re-sort defensively here too (e.g. against cached results).
    const rankOf = (s) => (selectedTerm ? s.term_ranks?.[selectedTerm]?.rank : s.rank) ?? Infinity;
    const reportStudents = [...reportStudentsRaw].sort((a, b) => rankOf(a) - rankOf(b));

    return (
      <div>
        <style>{printStyle}</style>
        {reportStudents.map((student, idx) => (
          <TVETStudentReport
            key={student.student_id}
            student={student}
            cls={cls}
            allAssessments={assessments}
            allStudents={reportStudents}
            config={config}
            isLast={idx === reportStudents.length - 1}
            selectedTerm={selectedTerm}
          />
        ))}
      </div>
    );
  }

  if (data.type === 'student') {
    const { student, report, rank, total_students, term_ranks } = data;
    const scored   = (report || []).filter(r => r.marks_obtained != null);
    const totalObt = scored.reduce((s, r) => s + r.marks_obtained, 0);
    const totalMax = scored.reduce((s, r) => s + r.max_marks, 0);
    const pct      = calcPct(totalObt, totalMax);
    const fakeStudent = {
      student_id: student._id || student.id, name: student.name, email: student.email,
      level: student.level, trade: student.trade, class_name: student.class_year,
      marks: report.map(r => ({
        assessment_id: r.assessment_id, type: r.type, term: r.term,
        marks: r.marks_obtained, max_marks: r.max_marks,
        course: r.course, course_id: r.course_id, course_code: r.course_code,
        course_total_marks: r.course_total_marks, course_category: r.course_category,
      })),
      total_obtained: totalObt, total_max: totalMax, percentage: pct,
      grade: totalMax > 0 ? getGrade(totalObt, totalMax) : 'N/A',
      rank, rank_total: total_students, term_ranks: term_ranks || {},
    };
    const fakeAssessments = report.map(r => ({
      _id: r.assessment_id, title: r.title, type: r.type, term: r.term, max_marks: r.max_marks,
      course_id: { _id: r.course_id, name: r.course, code: r.course_code, total_marks: r.course_total_marks, category: r.course_category },
    }));
    return (
      <div>
        <style>{printStyle}</style>
        <TVETStudentReport
          student={fakeStudent}
          cls={{ name: student.class_year || 'N/A', teacher: null, program: data.program }}
          allAssessments={fakeAssessments}
          allStudents={[fakeStudent]}
          config={config}
          isLast
          selectedTerm={selectedTerm}
        />
      </div>
    );
  }

  if (data.type === 'assessment') {
    const { assessment, students: sData } = data;
    const avg = sData.length
      ? Math.round(sData.filter(s => s.percentage != null).reduce((s, x) => s + (x.percentage || 0), 0) / (sData.filter(s => s.percentage != null).length || 1))
      : null;
    const th = { padding: '10px 14px', background: dark ? '#1a1f2e' : '#f9fafb', color: dark ? '#7b839a' : '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left' };
    const td = { padding: '10px 14px', borderBottom: `1px solid ${dark ? '#1e2130' : '#f1f5f9'}`, color: dark ? '#e2e8f0' : '#374151', fontSize: 13 };
    return (
      <div style={{ background: dark ? '#13161f' : '#fff', border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`, borderRadius: 16, padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: dark ? '#f1f5f9' : '#111827' }}>{assessment?.title}</h2>
            <TypeBadge type={assessment?.type} />
            {assessment?.course_id?.category && (() => {
              const cb = catBadge(assessment.course_id.category);
              return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 7, background: cb.bg, color: cb.text, border: `1px solid ${cb.border}` }}>{assessment.course_id.category.replace(' modules', '')}</span>;
            })()}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[['Course', assessment?.course_id?.name], ['Term', assessment?.term], ['Year', assessment?.academic_year], ['Teacher', assessment?.teacher_id?.name]].map(([k, v]) => v && (
              <span key={k} style={{ fontSize: 12, color: dark ? '#7b839a' : '#9ca3af' }}>{k}: <strong style={{ color: dark ? '#e2e8f0' : '#374151' }}>{v}</strong></span>
            ))}
            {avg != null && <span style={{ fontSize: 13, fontWeight: 700, color: pctColor(Math.min(avg, 100)) }}>Class Avg: {Math.min(avg, 100)}%</span>}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['#', 'Student', 'Marks', 'Max', '%', 'Grade', 'Rank', 'Decision'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(sData || []).sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)).map((s, i) => {
                const displayPct = s.percentage != null ? Math.min(s.percentage, 100) : null;
                const dec = getRwandanDecision(displayPct);
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : (dark ? '#ffffff05' : '#f9fafb50') }}>
                    <td style={{ ...td, color: dark ? '#7b839a' : '#9ca3af' }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{s.student_name}</td>
                    <td style={{ ...td, fontWeight: 700, color: pctColor(displayPct) }}>{s.marks_obtained ?? '—'}</td>
                    <td style={td}>{s.max_marks}</td>
                    <td style={{ ...td, fontWeight: 700, color: pctColor(displayPct) }}>{displayPct != null ? displayPct + '%' : '—'}</td>
                    <td style={td}><GradeBadge grade={s.grade} /></td>
                    <td style={td}>{s.rank ? <span style={{ fontWeight: 700 }}>#{s.rank}</span> : '—'}</td>
                    <td style={td}><span style={{ fontWeight: 700, color: dec === 'C' ? '#059669' : dec === 'P' ? '#b45309' : '#dc2626' }}>{dec}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return null;
}

/* ══════════════════════════════════════════════════════════
   TVET STUDENT REPORT
   When `selectedTerm` is set (e.g. "Term 1"), the report shows ONLY that
   term's columns — no other terms, no annual summary. When it's falsy
   (the "Annual" option), the full 1st/2nd/3rd term + Annual grid is shown.
══════════════════════════════════════════════════════════ */
function TVETStudentReport({ student, cls, allAssessments, allStudents, config, isLast, selectedTerm }) {
  const termsToRender = selectedTerm ? [selectedTerm] : TERMS;
  const isAnnualView  = !selectedTerm;
  const selTermIdx    = selectedTerm ? TERMS.indexOf(selectedTerm) : null;
  const termShortLabel = (t) => (TERMS.indexOf(t) === 0 ? '1ST TERM' : TERMS.indexOf(t) === 1 ? '2ND TERM' : '3RD TERM');
  const pc = config?.primaryColor || '#1a3a6b';
  const reportDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

  const courseMap = new Map();
  allAssessments.forEach(a => {
    const cid = String(a.course_id?._id || a.course_id || a._id);
    if (!courseMap.has(cid)) {
      courseMap.set(cid, {
        _id: cid,
        code: a.course_id?.code || '—',
        name: a.course_id?.name || a.title || '—',
        weight: a.course_id?.total_marks || 100,
        category: a.course_id?.category || 'Complementary modules',
        termData:    { 'Term 1': { FA: null, IA: null, CA: null }, 'Term 2': { FA: null, IA: null, CA: null }, 'Term 3': { FA: null, IA: null, CA: null } },
        termMaxData: { 'Term 1': { FA: null, IA: null, CA: null }, 'Term 2': { FA: null, IA: null, CA: null }, 'Term 3': { FA: null, IA: null, CA: null } },
      });
    }
    const row     = courseMap.get(cid);
    const term    = a.term || 'Term 1';
    const slotKey = a.type === 'FA' ? 'FA' : a.type === 'IA' ? 'IA' : 'CA';
    if (row.termData[term]) {
      const markEntry = (student.marks || []).find(m => String(m.assessment_id) === String(a._id || a.assessment_id));
      if (row.termData[term][slotKey] == null) {
        row.termData[term][slotKey]    = markEntry?.marks ?? null;
        row.termMaxData[term][slotKey] = a.max_marks || 100;
      }
    }
  });

  const moduleRows = Array.from(courseMap.values()).map(row => {
    const terms = TERMS.map(term => {
      const d  = row.termData[term];
      const mx = row.termMaxData[term];
      const hasAnyData = d.FA != null || d.IA != null || d.CA != null;
      let avg = null;
      if (hasAnyData) {
        if (d.FA == null && d.CA == null && d.IA != null) {
          avg = Math.min(Math.round((d.IA / (mx.IA || 100)) * 100), 100);
        } else {
          const faPct = d.FA != null ? (d.FA / (mx.FA || 100)) * 100 : 0;
          const caPct = d.CA != null ? (d.CA / (mx.CA || 100)) * 100 : 0;
          avg = Math.min(Math.round((faPct + caPct) / 2), 100);
        }
      }
      const scores   = [d.FA, d.IA, d.CA].filter(v => v != null);
      const maxes    = [mx.FA, mx.IA, mx.CA].filter((_, i) => [d.FA, d.IA, d.CA][i] != null);
      const obtained = scores.reduce((s, v) => s + v, 0);
      const maxTotal = maxes.reduce((s, v) => s + v, 0);
      return { ...d, maxData: mx, obtained: scores.length > 0 ? obtained : null, maxTotal: maxTotal || null, avg };
    });
    const termAvgs      = terms.map(t => t.avg).filter(v => v != null);
    const annualAvg     = termAvgs.length > 0 ? Math.min(Math.round(termAvgs.reduce((s, v) => s + v, 0) / termAvgs.length), 100) : null;
    const totalObtained = terms.reduce((s, t) => s + (t.obtained || 0), 0);
    const totalMax      = terms.reduce((s, t) => s + (t.maxTotal || 0), 0);
    return { ...row, terms, annualAvg, annualMarks: totalMax > 0 ? totalObtained : null, annualMax: totalMax, decision: getRwandanDecision(annualAvg) };
  });

  const grouped = {};
  ALL_MODULE_CATEGORIES.forEach(cat => { grouped[cat] = moduleRows.filter(r => r.category === cat); });

  const termTotals = TERMS.map((_, ti) => {
    const allObtained = moduleRows.reduce((s, r) => s + (r.terms[ti].obtained || 0), 0);
    const allMax      = moduleRows.reduce((s, r) => s + (r.terms[ti].maxTotal || 0), 0);
    return { obtained: allObtained, max: allMax, pct: allMax > 0 ? Math.min(Math.round((allObtained / allMax) * 100), 100) : null };
  });

  const annualObtained = moduleRows.reduce((s, r) => s + (r.annualMarks || 0), 0);
  const annualMax      = moduleRows.reduce((s, r) => s + (r.annualMax  || 0), 0);
  const annualPct      = annualMax > 0 ? Math.min(Math.round((annualObtained / annualMax) * 100), 100) : null;

  const annualRank  = student.rank       || null;
  const totalRanked = student.rank_total || allStudents.length;
  const termRanks   = student.term_ranks || {};
  const behaviourMarks = student.behaviour || null;

  /*
   * The report's final 3-column summary (%, Marks, Decision + Position) is
   * either the ANNUAL total across all terms, or — when a single term is
   * selected — that term's own total. Everything downstream reads from
   * these "final*" values instead of the annual-only ones directly.
   */
  const finalLabel     = isAnnualView ? 'ANNUAL' : termShortLabel(selectedTerm);
  const finalPct       = isAnnualView ? annualPct                    : termTotals[selTermIdx]?.pct ?? null;
  const finalObtained  = isAnnualView ? annualObtained                : termTotals[selTermIdx]?.obtained ?? null;
  const finalMax       = isAnnualView ? annualMax                     : termTotals[selTermIdx]?.max ?? null;
  const finalDecision  = getRwandanDecision(finalPct);
  const finalRankEntry = isAnnualView ? { rank: annualRank, total: totalRanked } : termRanks[selectedTerm];

  const border   = '1px solid #c8cdd8';
  const headerBg = '#e8ecf0';
  // Base font size scales down slightly as the module list grows so a
  // curriculum with many modules still fits one A4 portrait page, while
  // smaller programs get noticeably larger, easier-to-read text.
  const fs       = Math.max(7.5, Math.min(10.5, 11 - moduleRows.length * 0.15));
  const scale    = fs / 7.5;
  const fz       = (n) => Math.round(n * scale * 10) / 10;
  const cellPad  = `${Math.round(3 * scale * 10) / 10}px ${Math.round(4 * scale * 10) / 10}px`;

  function decColor(d) { return d === 'C' ? '#059669' : d === 'P' ? '#b45309' : d === 'NYC' ? '#dc2626' : '#374151'; }

  const cell     = { padding: cellPad, fontSize: fs, borderRight: border, borderBottom: border, textAlign: 'center', verticalAlign: 'middle' };
  const cellLeft = { ...cell, textAlign: 'left' };
  const hCell    = { padding: cellPad, fontSize: fs, background: headerBg, fontWeight: 700, borderRight: border, borderBottom: border, textAlign: 'center', verticalAlign: 'middle' };
  const vHeaderCell = { ...hCell, padding: '4px 2px', width: 20, minWidth: 20, maxWidth: 24 };

  function VLabel({ text, bg }) {
    return (
      <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontSize: fz(6.5), fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1, padding: '4px 1px', background: bg || 'transparent', color: '#374151' }}>
        {text}
      </div>
    );
  }

  return (
    <div className="report-student-page" style={{ background: '#fff', padding: '12px 14px', marginBottom: isLast ? 0 : 32, fontFamily: 'Arial, Helvetica, sans-serif', color: '#1a1a2e', fontSize: fs, boxShadow: '0 2px 20px rgba(0,0,0,0.08)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 5 }}>
        <tbody>
          <tr>
            <td style={{ width: '35%', verticalAlign: 'top', padding: '0 0 4px 0' }}>
              <div style={{ fontSize: fz(8), lineHeight: 1.8, color: '#1a1a2e' }}>
                <div style={{ fontWeight: 900 }}>{config?.republic || 'REPUBLIC OF RWANDA'}</div>
                <div style={{ fontWeight: 700 }}>{config?.ministry || 'MINISTRY OF EDUCATION'}</div>
                <div>{config?.district || 'DISTRICT ...'}</div>
                <div style={{ fontWeight: 800 }}>{config?.schoolName || 'School Name'}</div>
                {config?.schoolMotto && <div style={{ fontStyle: 'italic', color: '#555' }}>{config.schoolMotto}</div>}
                {config?.schoolEmail && <div style={{ color: '#374151' }}>Email: {config.schoolEmail}</div>}
                {config?.schoolPhone && <div style={{ color: '#374151' }}>Tel: {config.schoolPhone}</div>}
              </div>
            </td>
            <td style={{ width: '30%', verticalAlign: 'middle', textAlign: 'center', padding: '0 8px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: pc + '10', border: '2px solid ' + pc + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                {config?.schoolLogoUrl
                  ? <img src={config.schoolLogoUrl} style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '50%' }} alt="Logo" onError={e => e.target.style.display = 'none'} />
                  : <School size={24} color={pc} />}
              </div>
            </td>
            <td style={{ width: '35%', verticalAlign: 'top', textAlign: 'right', padding: '0 0 4px 0' }}>
              <div style={{ fontSize: fz(8), lineHeight: 1.8, color: '#1a1a2e' }}>
                <div>ACADEMIC YEAR : <strong>{config?.academicYear || ''}</strong></div>
                <div>CLASS : <strong>{cls?.name || student.class_name || 'N/A'}</strong></div>
                <div>LEARNER NAME : <strong>{student.name}</strong></div>
                {student.student_id && <div>LEARNER CODE : <strong>{String(student.student_id).slice(-10).toUpperCase()}</strong></div>}
                {student.trade && <div>TRADE : <strong>{student.trade}</strong></div>}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ border, background: '#f8f9fa', padding: '4px', textAlign: 'center', fontWeight: 900, fontSize: fz(11), letterSpacing: '0.04em', marginBottom: 0, borderBottom: 'none' }}>
        LEARNER'S ASSESSMENT REPORT {isAnnualView ? '— ANNUAL REPORT' : `— ${termShortLabel(selectedTerm)} REPORT`}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ ...hCell, width: '8%' }}>Sector</td>
            <td style={{ ...cellLeft, width: '28%' }}>{cls?.program?.sector || config?.sector || ''}</td>
            <td style={{ ...hCell, width: '12%' }}>Qualification Title</td>
            <td style={cellLeft}>{cls?.program?.qualificationTitle || config?.qualificationTitle || ''}</td>
          </tr>
          <tr>
            <td style={hCell}>Trade</td>
            <td style={cellLeft}>{cls?.program?.trade || config?.trade || ''}</td>
            <td style={hCell}>RTQF Level</td>
            <td style={cellLeft}>{cls?.program?.rtqfLevel || config?.rtqfLevel || 'Level 3'}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', border, marginTop: 0 }}>
        <colgroup>
          <col style={{ width: 16 }} /><col style={{ width: 34 }} /><col style={{ width: 80 }} /><col style={{ width: 22 }} />
          {termsToRender.map(t => (
            <Fragment key={`col-${t}`}>
              <col style={{ width: 18 }} /><col style={{ width: 18 }} /><col style={{ width: 18 }} /><col style={{ width: 22 }} />
            </Fragment>
          ))}
          <col style={{ width: 22 }} /><col style={{ width: 22 }} /><col style={{ width: 22 }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...hCell, fontSize: fz(6) }}>#</th>
            <th rowSpan={2} style={{ ...hCell, textAlign: 'left', fontSize: fz(6) }}>Code</th>
            <th rowSpan={2} style={{ ...hCell, textAlign: 'left', fontSize: fz(6) }}>Module Title</th>
            <th rowSpan={2} style={{ ...hCell, fontSize: fz(6) }}>Max</th>
            {termsToRender.map(t => (
              <th key={`hdr-${t}`} colSpan={4} style={{ ...hCell, background: '#d8e3ee', fontSize: fz(7) }}>{termShortLabel(t)}</th>
            ))}
            <th colSpan={3} style={{ ...hCell, background: '#b8cfe0', fontSize: fz(7) }}>{finalLabel}</th>
          </tr>
          <tr>
            {termsToRender.map((t) => {
              const ti = TERMS.indexOf(t);
              return (
                <Fragment key={`h${ti}`}>
                  <th style={{ ...vHeaderCell, background: ti % 2 === 0 ? '#dde8f0' : '#d4e1ec' }}><VLabel text="Formative Assessment" /></th>
                  <th style={{ ...vHeaderCell, background: ti % 2 === 0 ? '#dde8f0' : '#d4e1ec' }}><VLabel text="Integrated Assessment" /></th>
                  <th style={{ ...vHeaderCell, background: ti % 2 === 0 ? '#dde8f0' : '#d4e1ec' }}><VLabel text="Comprehensive Assessment" /></th>
                  <th style={{ ...vHeaderCell, background: '#c8d8e8' }}><VLabel text="Average" bg="#c8d8e8" /></th>
                </Fragment>
              );
            })}
            <th style={{ ...vHeaderCell, background: '#b0c8dc' }}><VLabel text={isAnnualView ? 'Annual %' : 'Term %'} bg="#b0c8dc" /></th>
            <th style={{ ...vHeaderCell, background: '#b0c8dc' }}><VLabel text={isAnnualView ? 'Annual Marks' : 'Term Marks'} bg="#b0c8dc" /></th>
            <th style={{ ...vHeaderCell, background: '#b0c8dc' }}><VLabel text="Decision" bg="#b0c8dc" /></th>
          </tr>
          <tr style={{ background: '#f5f7fa' }}>
            <td style={{ ...hCell, fontSize: fz(6) }} />
            <td style={{ ...cellLeft, fontWeight: 700, fontSize: fz(6) }} colSpan={2}>Behaviour</td>
            <td style={{ ...cell, fontWeight: 700, fontSize: fz(6) }}>{student.behaviourMax || 40}</td>
            {termsToRender.map((t) => {
              const ti = TERMS.indexOf(t);
              return (
                <Fragment key={`b${ti}`}>
                  <td style={{ ...cell, color: '#9ca3af', fontSize: fz(6) }}>{behaviourMarks?.terms?.[ti]?.FA ?? 'N/A'}</td>
                  <td style={{ ...cell, color: '#9ca3af', fontSize: fz(6) }}>N/A</td>
                  <td style={{ ...cell, color: '#9ca3af', fontSize: fz(6) }}>N/A</td>
                  <td style={{ ...cell, fontWeight: 700, fontSize: fz(6) }}>{behaviourMarks?.terms?.[ti]?.avg ?? '—'}</td>
                </Fragment>
              );
            })}
            <td style={{ ...cell, fontWeight: 700, background: '#f0f4f8', fontSize: fz(6) }}>{isAnnualView ? (behaviourMarks?.annualPct ?? '—') : (behaviourMarks?.terms?.[selTermIdx]?.avg ?? '—')}</td>
            <td style={{ ...cell, fontWeight: 700, background: '#f0f4f8', fontSize: fz(6) }}>{isAnnualView ? (behaviourMarks?.annualMarks ?? '—') : '—'}</td>
            <td style={{ ...cell, fontWeight: 700, color: '#059669', background: '#f0f4f8', fontSize: fz(6) }}>C</td>
          </tr>
        </thead>

        <tbody>
          {ALL_MODULE_CATEGORIES.map(cat => {
            const catRows = grouped[cat] || [];
            if (catRows.length === 0) return null;
            const cb = catBadge(cat);
            return (
              <Fragment key={`cat-${cat}`}>
                <tr style={{ background: cb.bg }}>
                  <td colSpan={4 + termsToRender.length * 4 + 3} style={{ padding: '2px 6px', fontSize: fz(7), fontWeight: 900, color: cb.text, letterSpacing: '0.05em', borderBottom: border, textTransform: 'uppercase', borderTop: `2px solid ${cb.dot}` }}>{cat}</td>
                </tr>
                {catRows.map((row, i) => {
                  const finalRowSrc = isAnnualView
                    ? { avg: row.annualAvg, marks: row.annualMarks, decision: row.decision }
                    : { avg: row.terms[selTermIdx]?.avg ?? null, marks: row.terms[selTermIdx]?.obtained ?? null, decision: getRwandanDecision(row.terms[selTermIdx]?.avg ?? null) };
                  return (
                    <tr key={row._id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafc' }}>
                      <td style={{ ...cell, color: '#9ca3af', fontSize: fz(6) }}>{i + 1}</td>
                      <td style={{ ...cellLeft, fontWeight: 700, color: cb.text, fontFamily: 'monospace', fontSize: fz(6), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.code}</td>
                      <td style={{ ...cellLeft, fontWeight: 500, textTransform: 'uppercase', fontSize: fz(6), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name}</td>
                      <td style={{ ...cell, fontWeight: 700, fontSize: fz(6) }}>{row.weight}</td>
                      {termsToRender.map((t) => {
                        const ti = TERMS.indexOf(t);
                        const td_ = row.terms[ti];
                        return (
                          <Fragment key={`r${row._id}t${ti}`}>
                            <td style={{ ...cell, color: td_.FA != null ? '#374151' : '#ccc', fontSize: fz(6) }}>{td_.FA != null ? td_.FA : 'N/A'}</td>
                            <td style={{ ...cell, color: td_.IA != null ? '#374151' : '#ccc', fontSize: fz(6) }}>{td_.IA != null ? td_.IA : 'N/A'}</td>
                            <td style={{ ...cell, color: td_.CA != null ? '#374151' : '#ccc', fontSize: fz(6) }}>{td_.CA != null ? td_.CA : 'N/A'}</td>
                            <td style={{ ...cell, fontWeight: 700, color: pctColor(td_.avg), background: '#f8f9fc', fontSize: fz(6) }}>{td_.avg != null ? td_.avg + '%' : '—'}</td>
                          </Fragment>
                        );
                      })}
                      <td style={{ ...cell, fontWeight: 800, color: pctColor(finalRowSrc.avg), background: '#f0f4f8', fontSize: fz(6) }}>{finalRowSrc.avg != null ? finalRowSrc.avg + '%' : '—'}</td>
                      <td style={{ ...cell, fontWeight: 800, color: pctColor(finalRowSrc.avg), background: '#f0f4f8', fontSize: fz(6) }}>{finalRowSrc.marks != null ? finalRowSrc.marks : '—'}</td>
                      <td style={{ ...cell, fontWeight: 800, color: decColor(finalRowSrc.decision), background: '#f0f4f8', fontSize: fz(6) }}>{finalRowSrc.avg != null ? finalRowSrc.decision : '—'}</td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>

        <tfoot>
          <tr style={{ background: headerBg }}>
            <td colSpan={3} style={{ ...hCell, textAlign: 'right', fontSize: fz(6) }}>Total Weights assessed:</td>
            <td style={{ ...hCell, fontSize: fz(6) }}>{moduleRows.reduce((s, r) => s + r.weight, 0)}</td>
            {termsToRender.map((t) => {
              const ti = TERMS.indexOf(t);
              const tt = termTotals[ti];
              return (
                <Fragment key={`tf${ti}`}>
                  <td style={{ ...hCell, fontSize: fz(6) }}>—</td>
                  <td style={{ ...hCell, fontSize: fz(6) }}>—</td>
                  <td style={{ ...hCell, fontSize: fz(6) }}>—</td>
                  <td style={{ ...hCell, color: pctColor(tt.pct), fontSize: fz(6) }}>{tt.obtained || 0}</td>
                </Fragment>
              );
            })}
            <td style={{ ...hCell, background: '#b0c8dc', color: pctColor(finalPct), fontSize: fz(6) }}>{finalPct != null ? finalPct + '%' : '—'}</td>
            <td style={{ ...hCell, background: '#b0c8dc', color: pctColor(finalPct), fontSize: fz(6) }}>{finalObtained || '—'}</td>
            <td style={{ ...hCell, background: '#b0c8dc', color: decColor(finalDecision), fontSize: fz(6) }}>{finalDecision}</td>
          </tr>
          <tr style={{ background: '#f5f7fa' }}>
            <td colSpan={3} style={{ ...hCell, textAlign: 'right', fontSize: fz(6) }}>TOTAL :</td>
            <td style={{ ...hCell, fontSize: fz(6) }}>{moduleRows.reduce((s, r) => s + r.weight, 0)}</td>
            {termsToRender.map((t) => {
              const ti = TERMS.indexOf(t);
              const tt = termTotals[ti];
              return (
                <Fragment key={`tf2${ti}`}>
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...hCell, color: pctColor(tt.pct), fontSize: fz(6) }}>{tt.obtained || 0}</td>
                </Fragment>
              );
            })}
            <td style={{ ...hCell, background: '#b0c8dc', color: pctColor(finalPct), fontSize: fz(6) }}>{finalPct != null ? finalPct + '%' : '—'}</td>
            <td style={{ ...hCell, background: '#b0c8dc', color: pctColor(finalPct), fontSize: fz(6) }}>{finalObtained}</td>
            <td style={{ ...hCell, background: '#b0c8dc', fontSize: fz(6) }}>{finalMax}</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ ...hCell, textAlign: 'right', fontSize: fz(6) }}>PERCENTAGE :</td>
            <td style={{ ...cell, fontSize: fz(6) }} />
            {termsToRender.map((t) => {
              const ti = TERMS.indexOf(t);
              const tt = termTotals[ti];
              return (
                <Fragment key={`pf${ti}`}>
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...hCell, color: pctColor(tt.pct), fontSize: fz(6) }}>{tt.pct != null ? tt.pct + '%' : '—'}</td>
                </Fragment>
              );
            })}
            <td colSpan={3} style={{ ...hCell, background: '#b0c8dc', color: pctColor(finalPct), fontWeight: 900, fontSize: fz(7) }}>{finalPct != null ? finalPct.toFixed(2) + '%' : '—'}</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ ...hCell, textAlign: 'right', fontSize: fz(6) }}>POSITION :</td>
            <td style={{ ...cell, fontSize: fz(6) }} />
            {termsToRender.map((t) => {
              const ti = TERMS.indexOf(t);
              const tr_ = termRanks[t];
              const posLabel = tr_ ? `${tr_.rank}/${tr_.total}` : '—';
              return (
                <Fragment key={`pos${ti}`}>
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...cell, fontSize: fz(6) }} />
                  <td style={{ ...hCell, fontSize: fz(6), color: tr_ ? '#1a3a6b' : '#9ca3af' }}>{posLabel}</td>
                </Fragment>
              );
            })}
            <td colSpan={3} style={{ ...hCell, background: '#b0c8dc', fontSize: fz(7), fontWeight: 900, color: finalRankEntry?.rank ? '#1a3a6b' : '#9ca3af' }}>
              {finalRankEntry?.rank ? `${finalRankEntry.rank}/${finalRankEntry.total}` : '—'}
            </td>
          </tr>
          <tr>
            <td colSpan={4 + termsToRender.length * 4 + 3} style={{ padding: '4px 8px', fontSize: fz(7), borderBottom: border, background: '#f8f9fa' }}>
              <strong>{cls?.teacher?.name || config?.classTrainer || 'Class Trainer'}</strong> (Class Trainer)'s Comments &amp; signature :
              <span style={{ display: 'inline-block', width: 180, borderBottom: '1px solid #999', marginLeft: 8, verticalAlign: 'bottom' }} />
            </td>
          </tr>
        </tfoot>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 5 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', padding: '3px 8px 0 0', width: '55%' }}>
              <div style={{ fontSize: fz(7), color: '#374151', lineHeight: 1.9 }}>
                <div><strong>N/A:</strong> Not Applicable · <strong style={{ color: '#059669' }}>C:</strong> Competent · <strong style={{ color: '#dc2626' }}>NYC:</strong> Not Yet Competent · <strong style={{ color: '#b45309' }}>P:</strong> In progress</div>
                <div><strong>Passing Line:</strong> 50% for complementary modules; <strong>70%</strong> for general &amp; specific modules.</div>
                <div><strong>Term Average:</strong> (Formative Assessment% + Comprehensive Assessment%) ÷ 2.</div>
                <div><strong>Annual Average:</strong> Mean of all term averages with data.</div>
                <div><strong>Position:</strong> Ranked within class per term and annually.</div>
              </div>
            </td>
            <td style={{ verticalAlign: 'top', padding: '0 8px', width: '25%', borderLeft: '1px solid #dee2e6' }}>
              <div style={{ fontSize: fz(7.5), fontWeight: 800, marginBottom: 3 }}>Deliberation :</div>
              {['Promoted at 1st sitting', 'Promoted after re-assessment', 'Re-assessment required', 'Advised to repeat', 'Dismissed'].map(opt => (
                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, fontSize: fz(7) }}>
                  <div style={{ width: 10, height: 10, border: '1px solid #999', borderRadius: 2, flexShrink: 0 }} />
                  <span>{opt}</span>
                </div>
              ))}
            </td>
            <td style={{ verticalAlign: 'bottom', textAlign: 'center', padding: '0 0 0 8px', width: '20%', borderLeft: '1px solid #dee2e6' }}>
              <div style={{ fontSize: fz(7), color: '#6b7280', marginBottom: 22 }}>Date: {reportDate}</div>
              <div style={{ borderTop: '1px solid #374151', paddingTop: 4, marginTop: 4 }}>
                <div style={{ fontSize: fz(8), fontWeight: 800, color: '#1a1a2e' }}>{config?.managerName || 'School Principal'}</div>
                <div style={{ fontSize: fz(7), color: '#6b7280' }}>{config?.managerTitle || 'School Principal'}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 5, textAlign: 'center', fontSize: fz(6.5), color: '#d1d5db' }}>
        Report generated by {config?.schoolName || 'EDUPLA'} Academic Management System · {reportDate}
      </div>
    </div>
  );
}