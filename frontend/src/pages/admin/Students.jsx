import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import ImpersonateButton from '../../components/common/ImpersonateButton';
import {
  Plus, Search, Edit2, Trash2, LayoutGrid, List,
  BookOpen, GraduationCap, Filter, X,
  Award, Layers, CheckCircle2,
  Copy, Eye, EyeOff,
  ToggleLeft, ToggleRight, Info,
} from 'lucide-react';

/* ── Constants ── */

const LEVEL_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#64748b'];
const TRADE_COLORS = ['#f59e0b', '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#10b981', '#3b82f6', '#8b5cf6'];
const LEVEL_BG    = ['#dbeafe', '#d1fae5', '#ede9fe', '#fef3c7', '#fce7f3', '#cffafe', '#ffedd5', '#f1f5f9'];
const TRADE_BG    = ['#fef3c7', '#cffafe', '#fce7f3', '#ffedd5', '#e0e7ff', '#d1fae5', '#dbeafe', '#ede9fe'];

/* ── Status Badge ── */
function StatusBadge({ is_active }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, letterSpacing: 0.3,
      background: is_active !== false ? '#ecfdf5' : '#fef2f2',
      color: is_active !== false ? '#059669' : '#ef4444',
    }}>
      {is_active !== false ? 'Active' : 'Inactive'}
    </span>
  );
}


const AVATAR_COLORS = [
  ['#10b981','#059669'], ['#6366f1','#4338ca'], ['#0ea5e9','#0284c7'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#8b5cf6','#7c3aed'],
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
  const byLevel = levels.reduce((a, l) => { a[l.value] = students.filter(s => s.level === l.value).length; return a; }, {});
  const byTrade = trades.reduce((a, t) => { a[t.value] = students.filter(s => s.trade === t.value).length; return a; }, {});
  const topTrade = Object.entries(byTrade).sort((a, b) => b[1] - a[1])[0];
  const withClasses = students.filter(s => (s.class_count || 0) > 0).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {[
        { icon: GraduationCap, label: 'Total Students', value: students.length,    color: '#10b981', bg: '#ecfdf5' },
        { icon: BookOpen,      label: 'Enrolled',       value: withClasses,        color: '#6366f1', bg: '#eef2ff' },
        { icon: Layers,        label: 'Trades Active',  value: Object.values(byTrade).filter(Boolean).length, color: '#0ea5e9', bg: '#f0f9ff' },
        { icon: Award,         label: 'Top Trade',      value: topTrade?.[0] || '—', color: '#f59e0b', bg: '#fffbeb', isText: true },
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
function StudentCard({ student: s, levels = [], trades = [], onEdit, onDelete, onToggle, animDelay = 0 }) {
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
            <ImpersonateButton userId={s.id} name={s.name} />
            <button onClick={() => onEdit(s)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', transition: 'background 0.15s' }}>
              <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button onClick={() => onDelete(s)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex', transition: 'background 0.15s' }}>
              <Trash2 size={13} style={{ color: '#ef4444' }} />
            </button>
            <button onClick={() => onToggle(s)} title={s.is_active !== false ? 'Deactivate' : 'Activate'}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: s.is_active !== false ? '#fef3c7' : '#ecfdf5', display: 'flex', transition: 'background 0.15s' }}>
              {s.is_active !== false ? <ToggleRight size={13} style={{ color: '#d97706' }} /> : <ToggleLeft size={13} style={{ color: '#10b981' }} />}
            </button>
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
            {' '}class{s.class_count !== 1 ? 'es' : ''}
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
function StudentRow({ student: s, levels = [], trades = [], onEdit, onDelete, onToggle, animDelay = 0 }) {
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
          {s.class_count > 0 ? <><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.class_count}</span> class{s.class_count !== 1 ? 'es' : ''}</> : '—'}
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
          <ImpersonateButton userId={s.id} name={s.name} />
          <button onClick={() => onEdit(s)}
            style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
            <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={() => onDelete(s)}
            style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex' }}>
            <Trash2 size={13} style={{ color: '#ef4444' }} />
          </button>
          <button onClick={() => onToggle(s)} title={s.is_active !== false ? 'Deactivate' : 'Activate'}
            style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: s.is_active !== false ? '#fef3c7' : '#ecfdf5', display: 'flex' }}>
            {s.is_active !== false ? <ToggleRight size={13} style={{ color: '#d97706' }} /> : <ToggleLeft size={13} style={{ color: '#10b981' }} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ══ MAIN ══ */
export default function AdminStudents() {
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
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState([]);
  const [defaultPassword, setDefaultPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', classIds: [], class_year: '' });

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
        setForm({ name: s.name, email: s.email, classIds: s.classes.map(c => String(c.id)), class_year: s.class_year || '' });
      } catch {
        setForm({ name: student.name, email: student.email, classIds: [], class_year: '' });
      }
    } else {
      setForm({ name: '', email: '', classIds: [], class_year: '' });
    }
    setModal(true);
  };

  const toggleClass = (id) => {
    setForm(f => ({
      ...f,
      classIds: f.classIds.includes(String(id))
        ? f.classIds.filter(c => c !== String(id))
        : [...f.classIds, String(id)],
    }));
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
      <div style={{
        borderRadius: 20, padding: '22px 26px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #052e16 0%, #064e3b 45%, #065f46 100%)',
        boxShadow: '0 8px 32px rgba(16,185,129,0.2)',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(16,185,129,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 200, width: 90, height: 90, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 30, right: 100, width: 50, height: 50, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <GraduationCap size={11} style={{ color: '#6ee7b7' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Student Registry</span>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#a7f3d0' }}>{total} enrolled</span>
              </div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 5, lineHeight: 1.2 }}>
              🎓 Students
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 380, lineHeight: 1.6 }}>
              Manage student accounts, track class enrollments, and monitor progress across all programs.
            </p>
          </div>


        </div>

        {/* Action strip */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            onClick={() => openModal()}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              fontSize: 12, fontWeight: 700, transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <Plus size={14} /> New Student
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
            placeholder="Search by name or email…"
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
          Filters
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
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by:</span>

          {/* Class select */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Class</span>
            <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setPage(1); }}
              className="input-field" style={{ width: 160, padding: '5px 10px', fontSize: 12 }}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {activeFilters > 0 && (
            <button onClick={() => { setFilterClass(''); setPage(1); }}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#ef4444', background: '#fef2f2', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 7 }}>
              <X size={11} /> Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--surface-100)', borderTopColor: '#10b981', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading students…</p>
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <GraduationCap size={28} style={{ color: '#10b981' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No students found</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {search || activeFilters ? 'Try adjusting your search or filters.' : 'Add your first student to get started.'}
          </p>
          {!search && !activeFilters && (
            <button onClick={() => openModal()} className="btn-primary" style={{ margin: '0 auto' }}>
              <Plus size={14} /> Add Student
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {students.map((s, i) => (
            <StudentCard key={s.id} student={s} animDelay={i * 45}
              onEdit={openModal} onDelete={setDeleteTarget} onToggle={handleToggle} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--card-border)' }}>
                {['Student', 'Level / Trade', 'Classes', 'Year', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: h === 'Actions' ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <StudentRow key={s.id} student={s} animDelay={i * 35}
                  onEdit={openModal} onDelete={setDeleteTarget} onToggle={handleToggle} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}

      {/* ── Modal ── */}
      <Modal isOpen={modal} onClose={() => { setModal(false); setDefaultPassword(''); }} title={editing ? 'Edit Student' : 'New Student'}>

        {/* Success screen after creation */}
        {defaultPassword ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <CheckCircle2 size={28} style={{ color: '#10b981' }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Student Created!</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>Share these login credentials with the student.</p>
            </div>

            <div style={{ borderRadius: 14, border: '1px solid var(--surface-100)', background: 'transparent', overflow: 'hidden' }}>
              {[
                { label: 'Email', value: form.email, mono: true },
                { label: 'Default Password', value: defaultPassword, mono: true, secret: true },
              ].map(({ label, value, mono, secret }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: label === 'Email' ? '1px solid var(--surface-100)' : 'none',
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
              <button onClick={() => { setModal(false); setDefaultPassword(''); }} className="btn-secondary">Close</button>
              <button onClick={() => {
                setDefaultPassword('');
                setForm({ name: '', email: '', classIds: [], class_year: '' });
                setEditing(null);
              }} className="btn-primary">
                <Plus size={14} /> Add Another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Name & Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field" placeholder="Student name" required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="input-field" placeholder="student@school.edu" required />
              </div>
            </div>

            {/* Class Year */}
            <div>
              <label className="label">Intake Year</label>
              <select value={form.class_year} onChange={e => setForm(f => ({ ...f, class_year: e.target.value }))}
                className="input-field">
                <option value="">Select year…</option>
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            {/* Enroll in Classes */}
            <div>
              <label className="label">
                Enroll in Classes
                {form.classIds.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#10b981' }}>
                    {form.classIds.length} selected
                  </span>
                )}
              </label>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                marginTop: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 2,
              }}>
                {classes.map(c => {
                  const selected = form.classIds.includes(String(c.id));
                  const [from] = getAvatarColors(c.name);
                  return (
                    <label key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${selected ? from + '66' : 'var(--card-border)'}`,
                      background: selected ? `${from}0d` : 'var(--surface-50)',
                      transition: 'all 0.15s',
                    }}>
                      <input type="checkbox" checked={selected} onChange={() => toggleClass(c.id)}
                        style={{ accentColor: from, width: 14, height: 14, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
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
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', gridColumn: '1/-1', padding: 8 }}>No classes available.</p>
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
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 2 }}>TVET info assigned automatically</p>
                    <p style={{ fontSize: 11, color: '#166534' }}>
                      From <strong>{primaryClass.name}</strong>:{' '}
                      {primaryClass.level && <span>Level: <strong>{primaryClass.level}</strong>{primaryClass.trade ? ' · ' : ''}</span>}
                      {primaryClass.trade && <span>Trade: <strong>{primaryClass.trade}</strong></span>}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                {editing ? 'Update Student' : 'Create Student'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!toggleTarget} onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleConfirm} loading={toggling}
        title={toggleTarget?.is_active !== false ? 'Deactivate Student' : 'Activate Student'}
        message={toggleTarget?.is_active !== false
          ? `Deactivate "${toggleTarget?.name}"? They will lose access to EDUPLA immediately.`
          : `Activate "${toggleTarget?.name}"? They will regain full access to EDUPLA.`}
        confirmText={toggleTarget?.is_active !== false ? 'Deactivate' : 'Activate'}
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Delete Student"
        message={`Delete "${deleteTarget?.name}"? Their submissions and records will also be removed.`}
        confirmText="Delete" variant="danger"
      />

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}