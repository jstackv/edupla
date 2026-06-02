import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Pagination from '../../components/common/Pagination';
import {
  Plus, Search, Users, Edit2, Trash2, Mail, Phone, BookOpen,
  GraduationCap, LayoutGrid, List, Filter, X, CheckCircle2,
  Copy, Eye, EyeOff, Award, TrendingUp, ArrowUpRight, Shield,
} from 'lucide-react';

/* ── Constants ── */
const AVATAR_COLORS = [
  ['#6366f1','#4338ca'], ['#8b5cf6','#7c3aed'], ['#0ea5e9','#0284c7'],
  ['#10b981','#059669'], ['#f59e0b','#d97706'], ['#ec4899','#db2777'],
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

/* ── Stat strip ── */
function StatStrip({ teachers }) {
  const withClasses  = teachers.filter(t => (t.class_count || 0) > 0).length;
  const withStudents = teachers.filter(t => (t.student_count || 0) > 0).length;
  const topTeacher   = [...teachers].sort((a, b) => (b.student_count || 0) - (a.student_count || 0))[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {[
        { icon: Users,         label: 'Total Teachers',    value: teachers.length,    color: '#6366f1', bg: '#eef2ff' },
        { icon: BookOpen,      label: 'Teaching Classes',  value: withClasses,        color: '#0ea5e9', bg: '#f0f9ff' },
        { icon: GraduationCap, label: 'With Students',     value: withStudents,       color: '#10b981', bg: '#ecfdf5' },
        { icon: Award,         label: 'Top Teacher',       value: topTeacher?.name?.split(' ')[0] || '—', color: '#f59e0b', bg: '#fffbeb', isText: true },
      ].map(({ icon: Icon, label, value, color, bg, isText }) => (
        <div key={label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <p style={{ fontSize: isText ? 13 : 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Teacher Card (grid) ── */
function TeacherCard({ teacher: t, onEdit, onDelete, animDelay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const [from, to] = getAvatarColors(t.name);

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
      {/* Top accent band */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${from}, ${to})`, borderRadius: '12px 12px 0 0' }} />

      <div style={{ padding: '16px 18px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <Avatar name={t.name} size={48} />
          <div style={{ display: 'flex', gap: 3, opacity: hovered ? 1 : 0, transition: 'opacity 0.18s' }}>
            <button onClick={() => onEdit(t)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
              <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button onClick={() => onDelete(t)}
              style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex' }}>
              <Trash2 size={13} style={{ color: '#ef4444' }} />
            </button>
          </div>
        </div>

        {/* Name */}
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</p>

        {/* Contact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
            <Mail size={11} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email}</span>
          </p>
          {t.phone && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Phone size={11} style={{ flexShrink: 0 }} /> {t.phone}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14,
        }}>
          {[
            { icon: BookOpen, label: 'Classes', value: t.class_count || 0, color: '#6366f1', bg: '#eef2ff' },
            { icon: GraduationCap, label: 'Students', value: t.student_count || 0, color: '#10b981', bg: '#ecfdf5' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} style={{ padding: '8px 10px', borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon size={13} style={{ color, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 7,
            background: `${from}14`, fontSize: 10, fontWeight: 600, color: from,
          }}>
            <Shield size={10} />
            Teacher
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            {t.created_at ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Teacher Row (table) ── */
function TeacherRow({ teacher: t, onEdit, onDelete, animDelay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const [from] = getAvatarColors(t.name);

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
          <Avatar name={t.name} size={36} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{t.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.email}</p>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Mail size={11} /> {t.email}
          </p>
          {t.phone && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Phone size={11} /> {t.phone}
            </p>
          )}
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ padding: '3px 9px', borderRadius: 7, background: '#eef2ff', display: 'flex', alignItems: 'center', gap: 5 }}>
            <BookOpen size={11} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>{t.class_count || 0}</span>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ padding: '3px 9px', borderRadius: 7, background: '#ecfdf5', display: 'flex', alignItems: 'center', gap: 5 }}>
            <GraduationCap size={11} style={{ color: '#10b981' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{t.student_count || 0}</span>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {t.created_at ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </span>
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}>
          <button onClick={() => onEdit(t)}
            style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex' }}>
            <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={() => onDelete(t)}
            style={{ padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#fef2f2', display: 'flex' }}>
            <Trash2 size={13} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ══ MAIN ══ */
export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/teachers', { params: { search, page, limit: 12 } });
      setTeachers(res.data.teachers);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load teachers'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const openModal = (teacher = null) => {
    setEditing(teacher);
    setDefaultPassword('');
    setShowPassword(false);
    setForm(teacher
      ? { name: teacher.name, email: teacher.email, phone: teacher.phone || '' }
      : { name: '', email: '', phone: '' });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/teachers/${editing.id}`, form);
        toast.success('Teacher updated');
        setModal(false);
        fetchTeachers();
      } else {
        const res = await api.post('/admin/teachers', form);
        setDefaultPassword(res.data.defaultPassword);
        toast.success('Teacher created!');
        fetchTeachers();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/teachers/${deleteTarget.id}`);
      toast.success('Teacher deleted. Classes remain unassigned.');
      setDeleteTarget(null);
      fetchTeachers();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  const totalClasses  = teachers.reduce((a, t) => a + (t.class_count  || 0), 0);
  const totalStudents = teachers.reduce((a, t) => a + (t.student_count || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Hero Banner ── */}
      <div style={{
        borderRadius: 20, padding: '22px 26px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4c1d95 100%)',
        boxShadow: '0 8px 32px rgba(99,102,241,0.28)',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(139,92,246,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 220, width: 90, height: 90, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 90, width: 55, height: 55, borderRadius: '50%', background: 'rgba(167,139,250,0.1)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Shield size={11} style={{ color: '#c4b5fd' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Faculty</span>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 99, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#c4b5fd' }}>{total} registered</span>
              </div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 5, lineHeight: 1.2 }}>
              👩‍🏫 Teachers
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 380, lineHeight: 1.6 }}>
              Manage faculty accounts, track class assignments, and monitor student engagement across all teachers.
            </p>
          </div>

          {/* Aggregate counters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Teachers',  value: total,         icon: Users },
              { label: 'Classes',   value: totalClasses,  icon: BookOpen },
              { label: 'Students',  value: totalStudents, icon: GraduationCap },
            ].map(({ label, value, icon: Ic }) => (
              <div key={label} style={{
                textAlign: 'center', padding: '10px 16px', borderRadius: 14,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 68,
              }}>
                <Ic size={13} style={{ color: '#c4b5fd', margin: '0 auto 4px', display: 'block' }} />
                <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom strip */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Avg classes per teacher</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
              {total > 0 ? (totalClasses / total).toFixed(1) : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GraduationCap size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Avg students per teacher</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
              {total > 0 ? (totalStudents / total).toFixed(1) : '—'}
            </span>
          </div>
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
            <Plus size={14} /> New Teacher
          </button>
        </div>
      </div>

      {/* ── Stat Strip ── */}
      {!loading && teachers.length > 0 && <StatStrip teachers={teachers} />}

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

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface-100)', borderRadius: 10, padding: 3, gap: 2 }}>
          {[{ mode: 'table', icon: List }, { mode: 'grid', icon: LayoutGrid }].map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: viewMode === mode ? 'var(--card-bg)' : 'transparent',
                color: viewMode === mode ? '#6366f1' : 'var(--text-secondary)',
                boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                display: 'flex', transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <button onClick={() => openModal()} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          <Plus size={14} /> New Teacher
        </button>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--surface-100)', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading teachers…</p>
          </div>
        </div>
      ) : teachers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Users size={28} style={{ color: '#6366f1' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No teachers yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Create the first teacher account to get started.</p>
          <button onClick={() => openModal()} className="btn-primary" style={{ margin: '0 auto' }}>
            <Plus size={14} /> New Teacher
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {teachers.map((t, i) => (
            <TeacherCard key={t.id} teacher={t} animDelay={i * 45}
              onEdit={openModal} onDelete={setDeleteTarget} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-50)', borderBottom: '1px solid var(--card-border)' }}>
                {['Teacher', 'Contact', 'Classes', 'Students', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: h === 'Actions' ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => (
                <TeacherRow key={t.id} teacher={t} animDelay={i * 35}
                  onEdit={openModal} onDelete={setDeleteTarget} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 12 && <Pagination page={page} totalPages={Math.ceil(total / 12)} onPageChange={setPage} />}

      {/* ── Modal ── */}
      <Modal isOpen={modal} onClose={() => { setModal(false); setDefaultPassword(''); }} title={editing ? 'Edit Teacher' : 'Create New Teacher'}>

        {/* Success screen */}
        {defaultPassword ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <CheckCircle2 size={28} style={{ color: '#6366f1' }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Teacher Created!</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>Share these login credentials with the teacher.</p>
            </div>

            <div style={{ borderRadius: 14, border: '1px solid var(--surface-100)', background: 'transparent', overflow: 'hidden' }}>
              {[
                { label: 'Email', value: form.email, secret: false },
                { label: 'Default Password', value: defaultPassword, secret: true },
              ].map(({ label, value, secret }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: label === 'Email' ? '1px solid var(--surface-100)' : 'none',
                }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {secret && !showPassword ? '••••••••••' : value}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {secret && (
                      <button onClick={() => setShowPassword(p => !p)}
                        style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#e0e7ff', display: 'flex' }}>
                        {showPassword ? <EyeOff size={14} style={{ color: '#6366f1' }} /> : <Eye size={14} style={{ color: '#6366f1' }} />}
                      </button>
                    )}
                    <button onClick={() => copyToClipboard(value)}
                      style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#e0e7ff', display: 'flex' }}>
                      <Copy size={14} style={{ color: '#6366f1' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-100)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Shield size={14} style={{ color: '#6366f1', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                All teachers share a default password. The teacher should change it after their first login.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setModal(false); setDefaultPassword(''); setForm({ name: '', email: '', phone: '' }); }} className="btn-secondary">Close</button>
              <button onClick={() => { setDefaultPassword(''); setForm({ name: '', email: '', phone: '' }); setEditing(null); }} className="btn-primary">
                <Plus size={14} /> Add Another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Preview avatar */}
            {form.name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-50)', animation: 'slideUp 0.2s ease' }}>
                <Avatar name={form.name} size={40} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{form.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{form.email || 'No email yet'}</p>
                </div>
              </div>
            )}

            <div>
              <label className="label">Full Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="input-field" placeholder="Teacher full name" required />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input-field" placeholder="teacher@school.edu" required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="input-field" placeholder="+250 xxx xxx xxx" />
            </div>

            {!editing && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-100)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Shield size={14} style={{ color: '#6366f1', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  All teachers share the same default password. The teacher should change it after first login.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                {editing ? 'Update Teacher' : 'Create Teacher'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Delete Teacher"
        message={`Delete "${deleteTarget?.name}"? Their classes will remain and can be reassigned to another teacher.`}
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