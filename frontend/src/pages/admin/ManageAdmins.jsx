import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Shield, Plus, Trash2, X, Eye, EyeOff, UserPlus, Users,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
  GraduationCap, BookOpen, User, Search, Activity,
  TrendingUp, AlertCircle, CheckCircle, Clock,
  Building2, BarChart3, RefreshCw, Filter, Pencil,
  AlertTriangle, PowerOff, Power, Save, Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ── Stat Pill ──────────────────────────────────────────────────────────────
const StatPill = ({ icon: Icon, label, value, color = '#6366f1' }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
    style={{ background: `${color}15`, color }}>
    <Icon className="w-3 h-3" />
    <span>{value}</span>
    <span className="font-medium opacity-70">{label}</span>
  </div>
);

// ── Mini Progress Bar ──────────────────────────────────────────────────────
const MiniBar = ({ value, max, color = '#6366f1' }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--card-border)' }}>
        <div className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)', minWidth: 28 }}>{pct}%</span>
    </div>
  );
};

// ── Confirmation Modal (Delete / Toggle) ───────────────────────────────────
function ConfirmModal({ type, admin, onConfirm, onCancel, loading }) {
  const isDelete = type === 'delete';
  const isDeactivate = type === 'deactivate';
  const isActivate = type === 'activate';

  const config = {
    delete: {
      icon: Trash2,
      iconBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      iconShadow: '0 4px 14px rgba(239,68,68,0.4)',
      accentColor: '#ef4444',
      accentBg: 'rgba(239,68,68,0.06)',
      accentBorder: 'rgba(239,68,68,0.15)',
      title: 'Delete Admin Account',
      message: `You are about to permanently delete the admin account for`,
      warning: 'This action cannot be undone. All associated data will be lost.',
      confirmLabel: 'Delete Account',
      confirmStyle: {
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
      },
    },
    deactivate: {
      icon: PowerOff,
      iconBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      iconShadow: '0 4px 14px rgba(245,158,11,0.4)',
      accentColor: '#d97706',
      accentBg: 'rgba(245,158,11,0.06)',
      accentBorder: 'rgba(245,158,11,0.15)',
      title: 'Deactivate Admin',
      message: `You are about to deactivate the admin account for`,
      warning: 'The admin will lose access immediately but their data will be preserved.',
      confirmLabel: 'Deactivate',
      confirmStyle: {
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
      },
    },
    activate: {
      icon: Power,
      iconBg: 'linear-gradient(135deg, #10b981, #059669)',
      iconShadow: '0 4px 14px rgba(16,185,129,0.4)',
      accentColor: '#059669',
      accentBg: 'rgba(16,185,129,0.06)',
      accentBorder: 'rgba(16,185,129,0.15)',
      title: 'Activate Admin',
      message: `You are about to reactivate the admin account for`,
      warning: 'The admin will regain full access to their workspace.',
      confirmLabel: 'Activate',
      confirmStyle: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
      },
    },
  };

  const c = config[type];
  const Icon = c.icon;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          animation: 'modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Colored top bar */}
        <div className="h-1 w-full" style={{ background: c.confirmStyle.background }} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: c.iconBg, boxShadow: c.iconShadow }}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Super Admin Action</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {/* Admin info card */}
          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: c.accentBg, border: `1px solid ${c.accentBorder}` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
              >
                <Shield className="w-4 h-4" style={{ color: c.accentColor }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{admin?.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{admin?.email}</p>
              </div>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            {c.message} <strong style={{ color: 'var(--text-primary)' }}>{admin?.name}</strong>.
          </p>

          {/* Warning */}
          <div
            className="flex items-start gap-2.5 rounded-xl p-3 mb-5"
            style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: c.accentColor }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.warning}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: 'var(--surface-100)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-primary)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity"
              style={{ ...c.confirmStyle, opacity: loading ? 0.7 : 1 }}
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Icon className="w-4 h-4" />
              }
              {c.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit Admin Modal ───────────────────────────────────────────────────────
function EditAdminModal({ admin, onSave, onClose }) {
  const [form, setForm] = useState({
    name: admin.name || '',
    email: admin.email || '',
    password: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (form.password && form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim() };
      if (form.password) payload.password = form.password;
      await api.put(`/admin/admins/${admin.id}`, payload);
      toast.success('Admin updated successfully');
      onSave({ ...admin, name: payload.name, email: payload.email });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update admin');
    } finally { setSaving(false); }
  };

  const Field = ({ label, id, children, error }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs flex items-center gap-1 text-red-500">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          animation: 'modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Indigo top bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}
              >
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Edit Admin Account</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Update admin information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100 transition-colors"
            >
              <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {/* Current admin badge */}
          <div
            className="flex items-center gap-3 rounded-xl p-3 mb-5"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}
            >
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{admin.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{admin.email}</p>
            </div>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto flex-shrink-0"
              style={{
                background: admin.is_active !== false ? '#ecfdf5' : '#fef2f2',
                color: admin.is_active !== false ? '#059669' : '#ef4444',
              }}
            >
              {admin.is_active !== false ? '● Active' : '● Inactive'}
            </span>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Field label="Full Name" error={errors.name}>
              <input
                className="input-field"
                placeholder="e.g. Admin Kigali Branch"
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(ev => ({ ...ev, name: '' })); }}
              />
            </Field>

            <Field label="Email Address" error={errors.email}>
              <input
                type="email"
                className="input-field"
                placeholder="admin@school.com"
                value={form.email}
                onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(ev => ({ ...ev, email: '' })); }}
              />
            </Field>

            <Field label="New Password" error={errors.password}>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="Leave blank to keep current password"
                  value={form.password}
                  onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(ev => ({ ...ev, password: '' })); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!errors.password && (
                <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <Lock className="w-3 h-3" /> Only fill this if you want to change the password
                </p>
              )}
            </Field>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: 'var(--surface-100)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-primary)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity"
              style={{
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Save className="w-4 h-4" />
              }
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin Detail Panel ─────────────────────────────────────────────────────
function AdminDetailPanel({ admin, onClose }) {
  const [tab, setTab] = useState('overview');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/admin/admins/${admin.id}/detail`)
      .then(({ data }) => { if (!cancelled) { setDetail(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { toast.error('Failed to load admin details'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [admin.id]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'teachers', label: 'Teachers', icon: GraduationCap },
    { id: 'classes', label: 'Classes', icon: BookOpen },
    { id: 'students', label: 'Students', icon: Users },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl h-full max-h-[calc(100vh-2rem)] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>

        {/* Panel header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: admin.is_active !== false ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#6b7280', boxShadow: admin.is_active !== false ? '0 4px 12px rgba(99,102,241,0.4)' : 'none' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{admin.name}</h2>
                {admin.is_super_admin && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Super Admin
                  </span>
                )}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: admin.is_active !== false ? '#ecfdf5' : '#fef2f2',
                    color: admin.is_active !== false ? '#059669' : '#ef4444',
                  }}>
                  {admin.is_active !== false ? '● Active' : '● Inactive'}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{admin.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100 flex-shrink-0 ml-3">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={tab === t.id
                ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff' }
                : { color: 'var(--text-secondary)', background: 'transparent' }}>
              <t.icon className="w-3 h-3" />
              {t.label}
              {detail && tab !== t.id && (
                <span className="ml-0.5 opacity-60">
                  {t.id === 'teachers' ? `(${detail.teachers?.length ?? 0})`
                    : t.id === 'classes' ? `(${detail.classes?.length ?? 0})`
                    : t.id === 'students' ? `(${detail.students?.length ?? 0})`
                    : ''}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading admin data…</p>
            </div>
          ) : !detail ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-muted">Could not load data</p>
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {tab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Teachers', value: detail.teachers?.length ?? 0, icon: GraduationCap, color: '#6366f1' },
                      { label: 'Classes', value: detail.classes?.length ?? 0, icon: BookOpen, color: '#0ea5e9' },
                      { label: 'Students', value: detail.students?.length ?? 0, icon: Users, color: '#10b981' },
                      { label: 'Active Classes', value: detail.classes?.filter(c => c.is_active !== false).length ?? 0, icon: Activity, color: '#f59e0b' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-3 flex flex-col gap-1"
                        style={{ background: `${s.color}0d`, border: `1px solid ${s.color}25` }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: `${s.color}20` }}>
                          <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                        </div>
                        <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {detail.teachers?.length > 0 && (
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Teacher Load
                      </p>
                      <div className="space-y-2.5">
                        {detail.teachers.slice(0, 5).map(t => {
                          const tClasses = detail.classes?.filter(c =>
                            c.teacher_id?.toString() === t.id?.toString() ||
                            c.teacher_name === t.name
                          ) ?? [];
                          return (
                            <div key={t.id} className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: '#6366f115' }}>
                                <User className="w-3 h-3 text-indigo-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{tClasses.length} classes</span>
                                </div>
                                <MiniBar value={tClasses.length} max={Math.max(...detail.teachers.map(tt =>
                                  detail.classes?.filter(c => c.teacher_name === tt.name).length ?? 0
                                ), 1)} color="#6366f1" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
                    <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Account created</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {admin.created_at ? new Date(admin.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TEACHERS TAB */}
              {tab === 'teachers' && (
                <div className="space-y-2">
                  {detail.teachers?.length === 0 ? (
                    <EmptyState icon={GraduationCap} label="No teachers yet" />
                  ) : detail.teachers.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-surface-100"
                      style={{ border: '1px solid var(--card-border)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: t.is_active !== false ? '#6366f115' : '#9ca3af20' }}>
                        <GraduationCap className="w-4 h-4" style={{ color: t.is_active !== false ? '#6366f1' : '#9ca3af' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: t.is_active !== false ? '#ecfdf5' : '#fef2f2',
                              color: t.is_active !== false ? '#059669' : '#ef4444',
                            }}>
                            {t.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <StatPill icon={BookOpen} label="cls" value={t.class_count ?? 0} color="#0ea5e9" />
                        <StatPill icon={Users} label="stu" value={t.student_count ?? 0} color="#10b981" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CLASSES TAB */}
              {tab === 'classes' && (
                <div className="space-y-2">
                  {detail.classes?.length === 0 ? (
                    <EmptyState icon={BookOpen} label="No classes yet" />
                  ) : detail.classes.map(cls => (
                    <div key={cls.id} className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid var(--card-border)' }}>
                      <button
                        onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
                        className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-surface-100">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: cls.is_active !== false ? '#0ea5e915' : '#9ca3af20' }}>
                          <BookOpen className="w-4 h-4" style={{ color: cls.is_active !== false ? '#0ea5e9' : '#9ca3af' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{cls.name}</p>
                            {cls.level && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                {cls.level}
                              </span>
                            )}
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{
                                background: cls.is_active !== false ? '#ecfdf5' : '#fef2f2',
                                color: cls.is_active !== false ? '#059669' : '#ef4444',
                              }}>
                              {cls.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Teacher: {cls.teacher_name || <span className="italic">Unassigned</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatPill icon={Users} label="students" value={cls.student_count ?? 0} color="#10b981" />
                          {expandedClass === cls.id
                            ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                            : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                          }
                        </div>
                      </button>

                      {expandedClass === cls.id && (
                        <div className="border-t px-3 pb-3 pt-2 space-y-1.5"
                          style={{ borderColor: 'var(--card-border)', background: 'var(--surface-100)' }}>
                          <p className="text-xs font-bold uppercase tracking-wider mb-2"
                            style={{ color: 'var(--text-secondary)' }}>
                            Enrolled Students ({cls.student_count ?? 0})
                          </p>
                          {!cls.enrolledStudents || cls.enrolledStudents.length === 0 ? (
                            <p className="text-xs text-center py-3" style={{ color: 'var(--text-secondary)' }}>No students enrolled</p>
                          ) : cls.enrolledStudents.map(s => (
                            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg"
                              style={{ background: 'var(--card-bg)' }}>
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: '#10b98115' }}>
                                <User className="w-3 h-3 text-emerald-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{s.email}</p>
                              </div>
                              {s.level && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 flex-shrink-0 font-medium">
                                  {s.level}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* STUDENTS TAB */}
              {tab === 'students' && (
                <div className="space-y-2">
                  {detail.students?.length === 0 ? (
                    <EmptyState icon={Users} label="No students yet" />
                  ) : detail.students.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-surface-100"
                      style={{ border: '1px solid var(--card-border)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: s.is_active !== false ? '#10b98115' : '#9ca3af20' }}>
                        <User className="w-4 h-4" style={{ color: s.is_active !== false ? '#10b981' : '#9ca3af' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: s.is_active !== false ? '#ecfdf5' : '#fef2f2',
                              color: s.is_active !== false ? '#059669' : '#ef4444',
                            }}>
                            {s.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        {s.level && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium">{s.level}</span>
                        )}
                        {s.trade && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300 font-medium">{s.trade}</span>
                        )}
                        <StatPill icon={BookOpen} label="cls" value={s.class_count ?? 0} color="#0ea5e9" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-100)' }}>
        <Icon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

// ── Summary stats bar ──────────────────────────────────────────────────────
function SummaryBar({ admins, allStats }) {
  const totalTeachers = allStats.reduce((s, a) => s + (a.teacher_count ?? 0), 0);
  const totalClasses = allStats.reduce((s, a) => s + (a.class_count ?? 0), 0);
  const totalStudents = allStats.reduce((s, a) => s + (a.student_count ?? 0), 0);
  const activeAdmins = admins.filter(a => a.is_active !== false).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: 'Total Admins', value: admins.length, sub: `${activeAdmins} active`, icon: Shield, color: '#6366f1' },
        { label: 'Total Teachers', value: totalTeachers, sub: 'across all admins', icon: GraduationCap, color: '#0ea5e9' },
        { label: 'Total Classes', value: totalClasses, sub: 'across all admins', icon: BookOpen, color: '#f59e0b' },
        { label: 'Total Students', value: totalStudents, sub: 'across all admins', icon: Users, color: '#10b981' },
      ].map(s => (
        <div key={s.label} className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${s.color}15` }}>
            <s.icon className="w-4.5 h-4.5" style={{ color: s.color }} />
          </div>
          <div>
            <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Admin Row Card ─────────────────────────────────────────────────────────
function AdminCard({ admin, stats, me, toggling, onToggle, onDelete, onViewDetail, onEdit }) {
  const isMe = admin.id === me?.id;
  const isActive = admin.is_active !== false;
  const maxStudents = Math.max(stats?.student_count ?? 0, 1);

  return (
    <div className="card transition-all duration-200 hover:shadow-md"
      style={{ borderColor: isActive ? 'var(--card-border)' : 'rgba(239,68,68,0.2)' }}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isActive ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#9ca3af',
            boxShadow: isActive ? '0 4px 12px rgba(99,102,241,0.35)' : 'none',
          }}>
          <Shield className="w-5 h-5 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{admin.name}</p>
            {admin.is_super_admin && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Super Admin
              </span>
            )}
            {isMe && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                You
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: isActive ? '#ecfdf5' : '#fef2f2',
                color: isActive ? '#059669' : '#ef4444',
              }}>
              {isActive ? '● Active' : '● Inactive'}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{admin.email}</p>

          {/* Stats row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatPill icon={GraduationCap} label="teachers" value={stats?.teacher_count ?? '…'} color="#6366f1" />
            <StatPill icon={BookOpen} label="classes" value={stats?.class_count ?? '…'} color="#0ea5e9" />
            <StatPill icon={Users} label="students" value={stats?.student_count ?? '…'} color="#10b981" />
          </div>

          {stats && (
            <div className="mt-2">
              <MiniBar value={stats.student_count ?? 0} max={maxStudents} color="#10b981" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1 flex-wrap justify-end">
          {/* View details */}
          <button
            onClick={() => onViewDetail(admin)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: '#6366f115', color: '#6366f1' }}
            title="View details">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Details</span>
          </button>

          {/* Edit — visible for all including self only if super admin */}
          {!admin.is_super_admin && (
            <button
              onClick={() => onEdit(admin)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#8b5cf615', color: '#7c3aed' }}
              title="Edit admin">
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {!isMe && (
            <>
              {/* Toggle status */}
              <button
                onClick={() => onToggle(admin)}
                disabled={toggling === admin.id}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: isActive ? '#fef3c7' : '#ecfdf5',
                  color: isActive ? '#d97706' : '#059669',
                  opacity: toggling === admin.id ? 0.6 : 1,
                  cursor: toggling === admin.id ? 'not-allowed' : 'pointer',
                }}
                title={isActive ? 'Deactivate' : 'Activate'}>
                {toggling === admin.id
                  ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : isActive
                    ? <ToggleRight className="w-3.5 h-3.5" />
                    : <ToggleLeft className="w-3.5 h-3.5" />
                }
                <span className="hidden sm:inline">{isActive ? 'Deactivate' : 'Activate'}</span>
              </button>

              {/* Delete */}
              <button
                onClick={() => onDelete(admin)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Delete admin">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ManageAdmins() {
  const { user: me } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [allStats, setAllStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Modal states
  const [editAdmin, setEditAdmin] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'delete'|'deactivate'|'activate', admin }
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [adminsRes, statsRes] = await Promise.all([
        api.get('/admin/admins'),
        api.get('/admin/admins/stats').catch(() => ({ data: { stats: [] } })),
      ]);
      setAdmins(adminsRes.data.admins);
      setAllStats(statsRes.data.stats ?? []);
    } catch {
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim())
      return toast.error('All fields are required');
    if (form.password.length < 6)
      return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      await api.post('/admin/admins', form);
      toast.success('Admin account created successfully');
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create admin');
    } finally { setSaving(false); }
  };

  // Opens confirm modal for toggle
  const handleToggleRequest = (admin) => {
    const isActive = admin.is_active !== false;
    setConfirmModal({ type: isActive ? 'deactivate' : 'activate', admin });
  };

  // Actually performs toggle after confirmation
  const handleToggleConfirm = async () => {
    if (!confirmModal?.admin || toggling) return;
    setConfirmLoading(true);
    setToggling(confirmModal.admin.id);
    try {
      const res = await api.patch(`/admin/admins/${confirmModal.admin.id}/toggle-status`);
      toast.success(res.data.message);
      setConfirmModal(null);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setToggling(null);
      setConfirmLoading(false);
    }
  };

  // Opens delete confirmation modal
  const handleDeleteRequest = (admin) => {
    setConfirmModal({ type: 'delete', admin });
  };

  // Actually deletes after confirmation
  const handleDeleteConfirm = async () => {
    if (!confirmModal?.admin) return;
    setConfirmLoading(true);
    try {
      await api.delete(`/admin/admins/${confirmModal.admin.id}`);
      toast.success('Admin deleted');
      setConfirmModal(null);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete admin');
    } finally { setConfirmLoading(false); }
  };

  const handleConfirm = () => {
    if (confirmModal?.type === 'delete') handleDeleteConfirm();
    else handleToggleConfirm();
  };

  // After edit save — update local state
  const handleEditSave = (updatedAdmin) => {
    setAdmins(prev => prev.map(a => a.id === updatedAdmin.id ? { ...a, ...updatedAdmin } : a));
    setEditAdmin(null);
  };

  const getStats = (adminId) => allStats.find(s => s.admin_id === adminId || s.admin_id?.toString() === adminId?.toString());

  const filtered = admins.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' ? a.is_active !== false : a.is_active === false);
    return matchSearch && matchFilter;
  });

  const activeCount = admins.filter(a => a.is_active !== false).length;
  const inactiveCount = admins.filter(a => a.is_active === false).length;

  return (
    <>
      {/* Modal animation keyframe injected once */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
              Admin Accounts
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Manage and monitor all admin accounts, their teachers, classes, and students.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-surface-100"
              style={{ border: '1px solid var(--card-border)' }}
              title="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <UserPlus className="w-4 h-4" /> New Admin
            </button>
          </div>
        </div>

        {/* Summary stats */}
        {!loading && <SummaryBar admins={admins} allStats={allStats} />}

        {/* Info card */}
        <div className="card" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.2)' }}>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Admin Isolation Model</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Each admin operates in a fully isolated workspace. Teachers, students, and classes created by one admin are invisible to others.
                Use separate admin accounts for each school branch or department. Click <strong>Details</strong> on any admin to inspect their full data.
              </p>
            </div>
          </div>
        </div>

        {/* Search + filter toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <input
              className="input-field pl-9 text-sm"
              placeholder="Search admins by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
            {[
              { id: 'all', label: `All (${admins.length})` },
              { id: 'active', label: `Active (${activeCount})` },
              { id: 'inactive', label: `Inactive (${inactiveCount})` },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={filter === f.id
                  ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff' }
                  : { color: 'var(--text-secondary)' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Create form modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="card w-full max-w-md" style={{ background: 'var(--card-bg)', animation: 'modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Create Admin Account</h2>
                </div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100">
                  <X className="w-4 h-4 text-muted" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input
                    className="input-field"
                    placeholder="e.g. Admin Kigali Branch"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="admin@school.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="input-field pr-10"
                      placeholder="Min. 6 characters"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1">
                    {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    <Plus className="w-4 h-4" /> Create Admin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Admins list */}
        <div className="space-y-3">
          {loading ? (
            <div className="card flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading admin accounts…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-100)' }}>
                <Shield className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {search || filter !== 'all' ? 'No admins match your filter' : 'No admins found'}
                </p>
                {(search || filter !== 'all') && (
                  <button onClick={() => { setSearch(''); setFilter('all'); }}
                    className="text-xs text-indigo-500 hover:underline mt-1">
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            filtered.map(admin => (
              <AdminCard
                key={admin.id}
                admin={admin}
                stats={getStats(admin.id)}
                me={me}
                toggling={toggling}
                onToggle={handleToggleRequest}
                onDelete={handleDeleteRequest}
                onViewDetail={setSelectedAdmin}
                onEdit={setEditAdmin}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        {selectedAdmin && (
          <AdminDetailPanel
            admin={selectedAdmin}
            onClose={() => setSelectedAdmin(null)}
          />
        )}
      </div>

      {/* Edit Modal */}
      {editAdmin && (
        <EditAdminModal
          admin={editAdmin}
          onSave={handleEditSave}
          onClose={() => setEditAdmin(null)}
        />
      )}

      {/* Confirm Modal (delete / deactivate / activate) */}
      {confirmModal && (
        <ConfirmModal
          type={confirmModal.type}
          admin={confirmModal.admin}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmModal(null)}
          loading={confirmLoading}
        />
      )}
    </>
  );
}