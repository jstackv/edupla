import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import ImpersonateButton from '../../components/common/ImpersonateButton';
import ResetPasswordModal from '../../components/common/ResetPasswordModal';
import {
  Plus, Search, Edit2, Trash2, LayoutGrid, List,
  BookOpen, GraduationCap, Filter, X,
  Award, Layers, CheckCircle2,
  Copy, Eye, EyeOff,
  ToggleLeft, ToggleRight, Info, KeyRound,
} from 'lucide-react';

/* ── Constants ── */

const LEVEL_COLORS = ['#3b82f6', '#10b981', '#c2410c', '#f59e0b', '#ec4899', '#06b6d4', '#c2410c', '#64748b'];
const TRADE_COLORS = ['#f59e0b', '#06b6d4', '#ec4899', '#c2410c', '#c2410c', '#10b981', '#3b82f6', '#c2410c'];
const LEVEL_BG    = ['#dbeafe', '#d1fae5', '#fdba74', '#fef3c7', '#fce7f3', '#cffafe', '#fdba74', '#f1f5f9'];
const TRADE_BG    = ['#fef3c7', '#cffafe', '#fce7f3', '#fdba74', '#fdba74', '#d1fae5', '#dbeafe', '#fdba74'];

/* ── Status Badge ── */
function StatusBadge({ is_active }) {
  const { t: tr } = useTranslation();
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, letterSpacing: 0.3,
      background: is_active !== false ? '#ecfdf5' : '#fef2f2',
      color: is_active !== false ? '#059669' : '#ef4444',
    }}>
      {is_active !== false ? tr('adminStudents.status.active') : tr('adminStudents.status.inactive')}
    </span>
  );
}


const AVATAR_COLORS = [
  ['#10b981','#059669'], ['#c2410c','#7c2d12'], ['#0ea5e9','#0284c7'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#c2410c','#9a3412'],
];
function getAvatarColors(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

/* ── Avatar ── */
function Avatar({ name, size = 36 }) {
  const [from, to] = getAvatarColors(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: `0 2px 8px ${from}55`,
    }}>
      <span style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.4 }}>
        {name?.[0]?.toUpperCase()}
      </span>
    </div>
  );
}

/* ── Badges ── */
function LevelBadge({ level, levels = [] }) {
  if (!level) return null;
  const idx = levels.findIndex(l => l.value === level);
  const i = idx >= 0 ? idx : (level.charCodeAt(0) % LEVEL_COLORS.length);
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: LEVEL_BG[i % LEVEL_BG.length], color: LEVEL_COLORS[i % LEVEL_COLORS.length], letterSpacing: '0.04em' }}>
      {level}
    </span>
  );
}
function TradeBadge({ trade, trades = [] }) {
  if (!trade) return null;
  const idx = trades.findIndex(t => t.value === trade);
  const i = idx >= 0 ? idx : (trade.charCodeAt(0) % TRADE_COLORS.length);
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: TRADE_BG[i % TRADE_BG.length], color: TRADE_COLORS[i % TRADE_COLORS.length] }}>
      {trade}
    </span>
  );
}

/* ── Stat strip ── */
function StatStrip({ students, levels = [], trades = [] }) {
  const { t: tr } = useTranslation();
  const byLevel = levels.reduce((a, l) => { a[l.value] = students.filter(s => s.level === l.value).length; return a; }, {});
  const byTrade = trades.reduce((a, t) => { a[t.value] = students.filter(s => s.trade === t.value).length; return a; }, {});
  const topTrade = Object.entries(byTrade).sort((a, b) => b[1] - a[1])[0];
  const withClasses = students.filter(s => (s.class_count || 0) > 0).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {[
        { icon: GraduationCap, label: tr('adminStudents.statStrip.totalStudents'), value: students.length,    color: '#10b981', bg: '#ecfdf5' },
        { icon: BookOpen,      label: tr('adminStudents.statStrip.enrolled'),       value: withClasses,        color: '#c2410c', bg: '#fed7aa' },
        { icon: Layers,        label: tr('adminStudents.statStrip.tradesActive'),  value: Object.values(byTrade).filter(Boolean).length, color: '#0ea5e9', bg: '#f0f9ff' },
        { icon: Award,         label: tr('adminStudents.statStrip.topTrade'),      value: topTrade?.[0] || '—', color: '#f59e0b', bg: '#fffbeb', isText: true },
      ].map(({ icon: Icon, label, value, color, bg, isText }) => (
        <div key={label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <p style={{ fontSize: isText ? 14 : 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Student Card (grid) ── */
function StudentCard({ student: s, levels = [], trades = [], onEdit, onDelete, onToggle, onResetPassword, isSuperAdmin, animDelay = 0 }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [from] = getAvatarColors(s.name);

  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', overflow: 'hidden', padding: 0,
        transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 16px 40px rgba(0,0,0,0.12), 0 0 0 1px ${from}22` : '',
        animation: 'slideUp 0.4s ease both',
        animationDelay: `${animDelay}ms`,
      }}
    >
      {/* Top accent */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${from}, ${from}77)`, borderRadius: '12px 12px 0 0' }} />

      <div style={{ padding: '16px 18px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <Avatar name={s.name} size={44} />
          <div style={{ display: 'flex', gap: 3, opacity: hovered ? 1 : 0, transition: 'opacity 0.18s' }}>
            {isSuperAdmin && <ImpersonateButton userId={s.id} name={s.name} />}
            <button onClick={() => onResetPassword(s)} title={t('adminStudents.card.resetPassword')}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fed7aa', display: 'flex', transition: 'background 0.15s' }}>
              <KeyRound size={13} style={{ color: '#c2410c' }} />
            </button>
            <button onClick={() => onEdit(s)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', transition: 'background 0.15s' }}>
              <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button onClick={() => onDelete(s)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex', transition: 'background 0.15s' }}>
              <Trash2 size={13} style={{ color: '#ef4444' }} />
            </button>
            {isSuperAdmin && (
              <button onClick={() => onToggle(s)} title={s.is_active !== false ? t('adminStudents.card.deactivate') : t('adminStudents.card.activate')}
                style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: s.is_active !== false ? '#fef3c7' : '#ecfdf5', display: 'flex', transition: 'background 0.15s' }}>
                {s.is_active !== false ? <ToggleRight size={13} style={{ color: '#d97706' }} /> : <ToggleLeft size={13} style={{ color: '#10b981' }} />}
              </button>
            )}
          </div>
        </div>

        {/* Name & email */}
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</p>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {s.level && <LevelBadge level={s.level} levels={levels} />}
          {s.trade && <TradeBadge trade={s.trade} trades={trades} />}
          {s.class_year && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
              {s.class_year}
            </span>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 10, borderTop: '1px solid var(--card-border)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
            <BookOpen size={12} />
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.class_count || 0}</span>
            {' '}{t('adminStudents.card.class', { count: s.class_count })}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            {s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Student Row (table) ── */
function StudentRow({ student: s, levels = [], trades = [], onEdit, onDelete, onToggle, onResetPassword, isSuperAdmin, animDelay = 0 }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--surface-50)' : 'transparent',
        transition: 'background 0.15s',
        animation: 'slideUp 0.35s ease both',
        animationDelay: `${animDelay}ms`,
      }}
    >
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={s.name} size={34} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{s.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.email}</p>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {s.level && <LevelBadge level={s.level} levels={levels} />}
          {s.trade && <TradeBadge trade={s.trade} trades={trades} />}
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
          <BookOpen size={12} />
          {s.class_count > 0 ? <><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.class_count}</span> {t('adminStudents.card.class', { count: s.class_count })}</> : '—'}
        </span>
      </td>
      <td style={{ padding: '10px 16px' }}>
        {s.class_year
          ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>{s.class_year}</span>
          : <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>—</span>}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
          {isSuperAdmin && <ImpersonateButton userId={s.id} name={s.name} />}
          <button onClick={() => onResetPassword(s)} title={t('adminStudents.card.resetPassword')}
            style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fed7aa', display: 'flex' }}>
            <KeyRound size={13} style={{ color: '#c2410c' }} />
          </button>
          <button onClick={() => onEdit(s)}
            style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
            <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={() => onDelete(s)}
            style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex' }}>
            <Trash2 size={13} style={{ color: '#ef4444' }} />
          </button>
          {isSuperAdmin && (
            <button onClick={() => onToggle(s)} title={s.is_active !== false ? t('adminStudents.card.deactivate') : t('adminStudents.card.activate')}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: s.is_active !== false ? '#fef3c7' : '#ecfdf5', display: 'flex' }}>
              {s.is_active !== false ? <ToggleRight size={13} style={{ color: '#d97706' }} /> : <ToggleLeft size={13} style={{ color: '#10b981' }} />}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ══ MAIN ══ */
export default function AdminStudents() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = !!user?.is_super_admin;
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState([]);
  const [defaultPassword, setDefaultPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', classIds: [], class_year: '' });
  // The class a student was already enrolled in when the edit modal was opened.
  // Students can only ever belong to one class, so this lets us show the
  // current class as fixed while any other class remains pickable, and once
  // a new one is picked, all others (including the old one) become disabled.
  const [originalClassId, setOriginalClassId] = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 12 };
      if (filterClass) params.classId = filterClass;
      const res = await api.get('/admin/students', { params });
      setStudents(res.data.students);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  }, [search, page, filterClass]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => {
    api.get('/admin/classes?limit=100').then(r => setClasses(r.data.classes || [])).catch(() => {});
  }, []);

  const openModal = async (student = null) => {
    setEditing(student);
    setDefaultPassword('');
    setShowPassword(false);
    if (student) {
      try {
        const res = await api.get(`/admin/students/${student.id}`);
        const s = res.data.student;
        // A student only ever belongs to one class — use the first as "current"
        const currentClassId = s.classes?.[0]?.id ? String(s.classes[0].id) : null;
        setOriginalClassId(currentClassId);
        setForm({ name: s.name, email: s.email, classIds: currentClassId ? [currentClassId] : [], class_year: s.class_year || '' });
      } catch {
        setOriginalClassId(null);
        setForm({ name: student.name, email: student.email, classIds: [], class_year: '' });
      }
    } else {
      setOriginalClassId(null);
      setForm({ name: '', email: '', classIds: [], class_year: '' });
    }
    setModal(true);
  };

  // A student can only ever be enrolled in one class at a time.
  // - Picking a class always replaces whatever was previously selected.
  // - Un-picking the currently selected class reverts to the student's
  //   original class when editing (or clears it entirely when creating).
  const toggleClass = (id) => {
    const idStr = String(id);
    setForm(f => {
      if (f.classIds.includes(idStr)) {
        return { ...f, classIds: originalClassId ? [originalClassId] : [] };
      }
      return { ...f, classIds: [idStr] };
    });
  };

  // Whether a given class checkbox should be disabled:
  // - While editing and nothing has changed yet (only the student's original
  //   class is selected), every OTHER class stays pickable — only the
  //   current one is locked, so admin can freely switch them out.
  // - As soon as any class is selected (either a fresh pick, or when
  //   creating a new student), every other class becomes disabled — a
  //   student can only ever be ticked into one class.
  const isClassDisabled = (classId) => {
    const idStr = String(classId);
    const isUnchangedOriginal = editing && form.classIds.length === 1 && form.classIds[0] === originalClassId;
    if (isUnchangedOriginal) return idStr === originalClassId;
    return form.classIds.length > 0 && !form.classIds.includes(idStr);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/students/${editing.id}`, form);
        toast.success('Student updated');
        setModal(false);
        fetchStudents();
      } else {
        const res = await api.post('/admin/students', form);
        setDefaultPassword(res.data.defaultPassword);
        toast.success('Student created!');
        fetchStudents();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleToggle = (student) => {
    setToggleTarget(student);
  };

  const handleToggleConfirm = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const res = await api.patch(`/admin/students/${toggleTarget._id || toggleTarget.id}/toggle-status`);
      toast.success(res.data.message);
      setToggleTarget(null);
      fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status'); }
    finally { setToggling(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/students/${deleteTarget.id}`);
      toast.success('Student deleted');
      setDeleteTarget(null);
      fetchStudents();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  const activeFilters = [filterClass].filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero Banner ── */}
      <div className="hero-card" style={{
        borderRadius: 20, padding: '22px 26px', position: 'relative', overflow: 'hidden',
        background: 'var(--hero-bg)', border: '1px solid var(--hero-border)',
        boxShadow: 'var(--hero-shadow)',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'var(--hero-glow)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <GraduationCap size={11} style={{ color: '#10b981' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('adminStudents.hero.registry')}</span>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#10b981' }}>{t('adminStudents.hero.enrolled', { count: total })}</span>
              </div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--hero-fg)', marginBottom: 5, lineHeight: 1.2 }}>
              {t('adminStudents.hero.title')}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--hero-fg-soft)', maxWidth: 380, lineHeight: 1.6 }}>
              {t('adminStudents.hero.subtitle')}
            </p>
          </div>


        </div>

        {/* Action strip */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--hero-glass-border)', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            onClick={() => openModal()}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #c2410c, #9a3412)', color: '#fff',
              fontSize: 12, fontWeight: 700, transition: 'filter 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.12)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            <Plus size={14} /> {t('adminStudents.hero.newStudent')}
          </button>
        </div>
      </div>

      {/* ── Stat Strip ── */}
      {!loading && students.length > 0 && <StatStrip students={students} />}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field"
            style={{ paddingLeft: 34 }}
            placeholder={t('adminStudents.toolbar.searchPlaceholder')}
          />
        </div>

        <button
          onClick={() => setShowFilters(f => !f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: '1px solid var(--card-border)',
            background: showFilters || activeFilters ? '#ecfdf5' : 'var(--card-bg)',
            color: showFilters || activeFilters ? '#059669' : 'var(--text-secondary)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <Filter size={13} />
          {t('adminStudents.toolbar.filters')}
          {activeFilters > 0 && (
            <span style={{
              width: 16, height: 16, borderRadius: '50%', background: '#10b981',
              color: '#fff', fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{activeFilters}</span>
          )}
        </button>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface-100)', borderRadius: 10, padding: 3, gap: 2 }}>
          {[{ mode: 'table', icon: List }, { mode: 'grid', icon: LayoutGrid }].map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: viewMode === mode ? 'var(--card-bg)' : 'transparent',
                color: viewMode === mode ? '#10b981' : 'var(--text-secondary)',
                boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                display: 'flex', transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <button onClick={() => openModal()} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          <Plus size={14} /> New Student
        </button>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', animation: 'slideUp 0.2s ease' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('adminStudents.toolbar.filterBy')}</span>

          {/* Class select */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('adminStudents.toolbar.class')}</span>
            <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }}
              className="input-field" style={{ width: 160, padding: '5px 10px', fontSize: 12 }}>
              <option value="">{t('adminStudents.toolbar.allClasses')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {activeFilters > 0 && (
            <button onClick={() => { setFilterClass(''); setPage(1); }}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#ef4444', background: '#fef2f2', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 7 }}>
              <X size={11} /> {t('adminStudents.toolbar.clearAll')}
            </button>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--surface-100)', borderTopColor: '#10b981', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('adminStudents.states.loading')}</p>
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <GraduationCap size={28} style={{ color: '#10b981' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('adminStudents.states.noStudentsFound')}</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {search || activeFilters ? t('adminStudents.states.tryAdjusting') : t('adminStudents.states.addFirstStudent')}
          </p>
          {!search && !activeFilters && (
            <button onClick={() => openModal()} className="btn-primary" style={{ margin: '0 auto' }}>
              <Plus size={14} /> {t('adminStudents.states.addStudent')}
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {students.map((s, i) => (
            <StudentCard key={s.id} student={s} animDelay={i * 45}
              onEdit={openModal} onDelete={setDeleteTarget} onToggle={handleToggle} onResetPassword={setResetTarget} isSuperAdmin={isSuperAdmin} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--card-border)' }}>
                {[t('adminStudents.table.student'), t('adminStudents.table.levelTrade'), t('adminStudents.table.classes'), t('adminStudents.table.year'), t('adminStudents.table.joined'), t('adminStudents.table.actions')].map((h, idx) => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: idx === 5 ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <StudentRow key={s.id} student={s} animDelay={i * 35}
                  onEdit={openModal} onDelete={setDeleteTarget} onToggle={handleToggle} onResetPassword={setResetTarget} isSuperAdmin={isSuperAdmin} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}

      {/* ── Modal ── */}
      <Modal isOpen={modal} onClose={() => { setModal(false); setDefaultPassword(''); }} title={editing ? t('adminStudents.modal.editTitle') : t('adminStudents.modal.createTitle')}>

        {/* Success screen after creation */}
        {defaultPassword ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <CheckCircle2 size={28} style={{ color: '#10b981' }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{t('adminStudents.modal.studentCreated')}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>{t('adminStudents.modal.shareCredentials')}</p>
            </div>

            <div style={{ borderRadius: 14, border: '1px solid var(--surface-100)', background: 'transparent', overflow: 'hidden' }}>
              {[
                { label: t('adminStudents.modal.email'), value: form.email, mono: true },
                { label: t('adminStudents.modal.defaultPassword'), value: defaultPassword, mono: true, secret: true },
              ].map(({ label, value, mono, secret }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: label === t('adminStudents.modal.email') ? '1px solid var(--surface-100)' : 'none',
                }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : 'inherit' }}>
                      {secret && !showPassword ? '••••••••••' : value}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {secret && (
                      <button onClick={() => setShowPassword(p => !p)}
                        style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#d1fae5', display: 'flex' }}>
                        {showPassword ? <EyeOff size={14} style={{ color: '#059669' }} /> : <Eye size={14} style={{ color: '#059669' }} />}
                      </button>
                    )}
                    <button onClick={() => copyToClipboard(value)}
                      style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#d1fae5', display: 'flex' }}>
                      <Copy size={14} style={{ color: '#059669' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setModal(false); setDefaultPassword(''); }} className="btn-secondary">{t('adminStudents.modal.close')}</button>
              <button onClick={() => {
                setDefaultPassword('');
                setForm({ name: '', email: '', classIds: [], class_year: '' });
                setEditing(null);
                setOriginalClassId(null);
              }} className="btn-primary">
                <Plus size={14} /> {t('adminStudents.modal.addAnother')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Name & Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">{t('adminStudents.modal.fullName')}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field" placeholder={t('adminStudents.modal.fullNamePlaceholder')} required />
              </div>
              <div>
                <label className="label">{t('adminStudents.modal.emailLabel')}</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="input-field" placeholder={t('adminStudents.modal.emailPlaceholder')} required />
              </div>
            </div>

            {/* Class Year */}
            <div>
              <label className="label">{t('adminStudents.modal.intakeYear')}</label>
              <select value={form.class_year} onChange={e => setForm(f => ({ ...f, class_year: e.target.value }))}
                className="input-field">
                <option value="">{t('adminStudents.modal.selectYear')}</option>
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            {/* Enroll in Class (a student can only ever belong to one) */}
            <div>
              <label className="label">
                {editing ? t('adminStudents.modal.class') : t('adminStudents.modal.enrollInClass')}
                {form.classIds.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#10b981' }}>
                    {t('adminStudents.modal.selected')}
                  </span>
                )}
              </label>
              {editing && (
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 6px' }}>
                  {t('adminStudents.modal.editingClassNote')}
                </p>
              )}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                marginTop: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 2,
              }}>
                {classes.map(c => {
                  const selected = form.classIds.includes(String(c.id));
                  const isCurrent = editing && String(c.id) === originalClassId;
                  const disabled = isClassDisabled(c.id);
                  const [from] = getAvatarColors(c.name);
                  return (
                    <label key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
                      border: `1.5px solid ${selected ? from + '66' : 'var(--card-border)'}`,
                      background: selected ? `${from}0d` : 'var(--surface-50)',
                      opacity: disabled && !selected ? 0.45 : 1,
                      transition: 'all 0.15s',
                    }}>
                      <input type="checkbox" checked={selected} disabled={disabled}
                        onChange={() => { if (!disabled) toggleClass(c.id); }}
                        style={{ accentColor: from, width: 14, height: 14, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                          {isCurrent && (
                            <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, color: '#6b7280' }}>{t('adminStudents.modal.current')}</span>
                          )}
                        </p>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                          {c.teacher_name && (
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.teacher_name}</span>
                          )}
                          {c.level && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#dbeafe', color: '#3b82f6' }}>{c.level}</span>
                          )}
                          {c.trade && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#d97706' }}>{c.trade}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {classes.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', gridColumn: '1/-1', padding: 8 }}>{t('adminStudents.modal.noClassesAvailable')}</p>
                )}
              </div>
            </div>

            {/* TVET info auto-derived hint */}
            {form.classIds.length > 0 && (() => {
              const primaryClass = classes.find(c => String(c.id) === String(form.classIds[0]));
              if (!primaryClass) return null;
              const hasInfo = primaryClass.level || primaryClass.trade;
              if (!hasInfo) return null;
              return (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <Info size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 2 }}>{t('adminStudents.modal.tvetAutoTitle')}</p>
                    <p style={{ fontSize: 11, color: '#166534' }}>
                      {t('adminStudents.modal.from')} <strong>{primaryClass.name}</strong>:{' '}
                      {primaryClass.level && <span>{t('adminStudents.modal.level')}<strong>{primaryClass.level}</strong>{primaryClass.trade ? ' · ' : ''}</span>}
                      {primaryClass.trade && <span>{t('adminStudents.modal.trade')}<strong>{primaryClass.trade}</strong></span>}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">{t('adminStudents.modal.cancel')}</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                {editing ? t('adminStudents.modal.updateStudent') : t('adminStudents.modal.createStudent')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!toggleTarget} onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleConfirm} loading={toggling}
        title={toggleTarget?.is_active !== false ? t('adminStudents.confirm.deactivateTitle') : t('adminStudents.confirm.activateTitle')}
        message={toggleTarget?.is_active !== false
          ? t('adminStudents.confirm.deactivateMessage', { name: toggleTarget?.name })
          : t('adminStudents.confirm.activateMessage', { name: toggleTarget?.name })}
        confirmText={toggleTarget?.is_active !== false ? t('adminStudents.confirm.deactivateConfirm') : t('adminStudents.confirm.activateConfirm')}
        variant="danger"
      />
      {resetTarget && (
        <ResetPasswordModal target={resetTarget} role="student" onClose={() => setResetTarget(null)} />
      )}
      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} loading={deleting}
        title={t('adminStudents.confirm.deleteTitle')}
        message={t('adminStudents.confirm.deleteMessage', { name: deleteTarget?.name })}
        confirmText={t('adminStudents.confirm.deleteConfirm')} variant="danger"
      />

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}