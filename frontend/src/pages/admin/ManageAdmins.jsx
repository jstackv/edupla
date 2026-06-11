import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Shield, Plus, Trash2, X, Eye, EyeOff, UserPlus, Users,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
  GraduationCap, BookOpen, User, Search, Activity,
  TrendingUp, AlertCircle, CheckCircle, Clock,
  Building2, BarChart3, RefreshCw, Filter, Pencil,
  AlertTriangle, PowerOff, Power, Save, Lock,
  Zap, Globe, Mail, Calendar, ArrowUpRight, Sparkles,
  LayoutGrid, List, SlidersHorizontal, Download, Copy,
  CheckCheck, ChevronUp, MoreVertical, Badge, Star,
  Layers, Network, Signal, Wifi, Server, Database,
  KeyRound, ShieldCheck, ShieldAlert, Crown, Flame,
  MousePointerClick, Bell, Hash, Tag, Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ── Design tokens ──────────────────────────────────────────────────────────
const TOKENS = {
  purple: '#6366f1',
  purpleDark: '#4f46e5',
  purpleGlass: 'rgba(99,102,241,0.08)',
  sky: '#0ea5e9',
  skyGlass: 'rgba(14,165,233,0.08)',
  emerald: '#10b981',
  emeraldGlass: 'rgba(16,185,129,0.08)',
  amber: '#f59e0b',
  amberGlass: 'rgba(245,158,11,0.08)',
  rose: '#f43f5e',
  roseGlass: 'rgba(244,63,94,0.08)',
  violet: '#8b5cf6',
  violetGlass: 'rgba(139,92,246,0.08)',
};

// ── Keyframe injection ─────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.93) translateY(12px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(40px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
    70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
    100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-4px); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .admin-card-enter { animation: fadeUp 0.3s ease both; }
  .shimmer-bone {
    background: linear-gradient(90deg, var(--surface-100) 25%, var(--card-border) 50%, var(--surface-100) 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s ease infinite;
    border-radius: 6px;
  }
  .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
  .stat-card-glow:hover { box-shadow: 0 0 20px rgba(99,102,241,0.2); }
  .clickable-row { cursor: pointer; transition: background 0.15s ease; }
  .clickable-row:hover { background: var(--surface-100) !important; }
`;

// ── Tiny helpers ───────────────────────────────────────────────────────────
const pct = (val, max) => (max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0);

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy email"
      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
      style={{ color: copied ? TOKENS.emerald : 'var(--text-secondary)' }}
    >
      {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Skeleton loader ────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem' }}>
      <div className="flex items-start gap-3">
        <div className="shimmer-bone w-11 h-11 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="shimmer-bone h-4 w-36 rounded" />
          <div className="shimmer-bone h-3 w-52 rounded" />
          <div className="flex gap-2 mt-2">
            <div className="shimmer-bone h-6 w-20 rounded-lg" />
            <div className="shimmer-bone h-6 w-20 rounded-lg" />
            <div className="shimmer-bone h-6 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Avatar with initials ───────────────────────────────────────────────────
function AdminAvatar({ name, isActive, size = 44, gradient }) {
  const initials = name ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';
  const bg = gradient || (isActive
    ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
    : 'linear-gradient(135deg,#9ca3af,#6b7280)');
  return (
    <div
      className="rounded-2xl flex items-center justify-center flex-shrink-0 select-none"
      style={{
        width: size, height: size,
        background: bg,
        boxShadow: isActive ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
        fontSize: size * 0.33,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </div>
  );
}

// ── Stat Pill ──────────────────────────────────────────────────────────────
const StatPill = ({ icon: Icon, label, value, color = TOKENS.purple }) => (
  <div
    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
    style={{ background: `${color}15`, color }}
  >
    <Icon className="w-3 h-3" />
    <span>{value}</span>
    <span className="font-medium opacity-70">{label}</span>
  </div>
);

// ── Sparkline bar ──────────────────────────────────────────────────────────
function SparkBar({ value, max, color = TOKENS.purple, showLabel = true, height = 6 }) {
  const p = pct(value, max);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height, background: 'var(--card-border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${p}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-secondary)', minWidth: 28 }}>
          {p}%
        </span>
      )}
    </div>
  );
}

// ── Activity sparkline (mini bars) ─────────────────────────────────────────
function MiniSparkline({ data = [], color = TOKENS.purple }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height: 24 }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max(15, pct(v, max))}%`,
            background: i === data.length - 1 ? color : `${color}55`,
          }}
        />
      ))}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ isActive, pulse = false }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: isActive ? '#ecfdf5' : '#fef2f2',
        color: isActive ? '#059669' : '#ef4444',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          background: isActive ? '#059669' : '#ef4444',
          animation: pulse && isActive ? 'pulse-ring 2s infinite' : 'none',
        }}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Toast-style alert banner ───────────────────────────────────────────────
function AlertBanner({ type = 'info', children, onDismiss }) {
  const cfg = {
    info: { color: TOKENS.purple, bg: TOKENS.purpleGlass, icon: Info },
    warning: { color: TOKENS.amber, bg: TOKENS.amberGlass, icon: AlertTriangle },
    success: { color: TOKENS.emerald, bg: TOKENS.emeraldGlass, icon: CheckCircle },
  }[type];
  const Icon = cfg.icon;
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}25` }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
      <div className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} className="flex-shrink-0">
          <X className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
        </button>
      )}
    </div>
  );
}

// ── Confirm Modal ──────────────────────────────────────────────────────────
function ConfirmModal({ type, admin, onConfirm, onCancel, loading }) {
  const config = {
    delete: {
      icon: Trash2, iconBg: 'linear-gradient(135deg,#f43f5e,#e11d48)', iconShadow: '0 4px 14px rgba(244,63,94,0.4)',
      accentColor: '#f43f5e', accentBg: 'rgba(244,63,94,0.06)', accentBorder: 'rgba(244,63,94,0.15)',
      title: 'Delete Admin Account', subtitle: 'This action is permanent and irreversible',
      message: 'You are about to permanently delete the admin account for',
      warning: 'All associated data — teachers, students, classes, and sessions — will be permanently erased.',
      confirmLabel: 'Delete Account',
      confirmStyle: { background: 'linear-gradient(135deg,#f43f5e,#e11d48)', boxShadow: '0 4px 14px rgba(244,63,94,0.35)' },
    },
    deactivate: {
      icon: PowerOff, iconBg: 'linear-gradient(135deg,#f59e0b,#d97706)', iconShadow: '0 4px 14px rgba(245,158,11,0.4)',
      accentColor: '#d97706', accentBg: 'rgba(245,158,11,0.06)', accentBorder: 'rgba(245,158,11,0.15)',
      title: 'Deactivate Admin', subtitle: 'Access will be suspended immediately',
      message: 'You are about to deactivate the admin account for',
      warning: 'All teachers and students under this admin will be immediately deactivated and their active sessions terminated.',
      confirmLabel: 'Deactivate',
      confirmStyle: { background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' },
    },
    activate: {
      icon: Power, iconBg: 'linear-gradient(135deg,#10b981,#059669)', iconShadow: '0 4px 14px rgba(16,185,129,0.4)',
      accentColor: '#059669', accentBg: 'rgba(16,185,129,0.06)', accentBorder: 'rgba(16,185,129,0.15)',
      title: 'Activate Admin', subtitle: 'Full workspace access will be restored',
      message: 'You are about to reactivate the admin account for',
      warning: 'The admin will regain full access to their workspace, teachers, classes, and students.',
      confirmLabel: 'Activate',
      confirmStyle: { background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' },
    },
  };

  const c = config[type];
  const Icon = c.icon;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
          animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div className="h-1 w-full" style={{ background: c.confirmStyle.background }} />
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: c.iconBg, boxShadow: c.iconShadow }}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.subtitle}</p>
              </div>
            </div>
            <button onClick={onCancel} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100 transition-colors">
              <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          <div className="rounded-xl p-4 mb-4" style={{ background: c.accentBg, border: `1px solid ${c.accentBorder}` }}>
            <div className="flex items-center gap-3">
              <AdminAvatar name={admin?.name} isActive={admin?.is_active !== false} size={40} />
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{admin?.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{admin?.email}</p>
              </div>
            </div>
          </div>

          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            {c.message} <strong style={{ color: 'var(--text-primary)' }}>{admin?.name}</strong>.
          </p>

          <AlertBanner type="warning">
            {c.warning}
          </AlertBanner>

          <div className="flex gap-3 mt-5">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ ...c.confirmStyle, opacity: loading ? 0.7 : 1 }}>
              {loading
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Icon className="w-4 h-4" />}
              {c.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FormField — stable top-level to prevent focus loss on every keystroke ─
function FormField({ label, icon: Icon, error, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        {Icon && <Icon className="w-3 h-3" />} {label}
      </label>
      {children}
      {error
        ? <p className="text-xs flex items-center gap-1 text-rose-500"><AlertCircle className="w-3 h-3" />{error}</p>
        : hint && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>{hint}</p>
      }
    </div>
  );
}

// ── Edit Admin Modal ───────────────────────────────────────────────────────
function EditAdminModal({ admin, onSave, onClose }) {
  const [form, setForm] = useState({ name: admin.name || '', email: admin.email || '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7)' }} />
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Edit Admin Account</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Update admin information</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100 transition-colors">
              <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {/* Current admin badge */}
          <div className="flex items-center gap-3 rounded-xl p-3 mb-5"
            style={{ background: TOKENS.purpleGlass, border: '1px solid rgba(99,102,241,0.15)' }}>
            <AdminAvatar name={admin.name} isActive={admin.is_active !== false} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{admin.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{admin.email}</p>
            </div>
            <StatusBadge isActive={admin.is_active !== false} />
          </div>

          <div className="space-y-4">
            <FormField label="Full Name" icon={User} error={errors.name}>
              <input className="input-field" placeholder="e.g. Admin Kigali Branch"
                value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(ev => ({ ...ev, name: '' })); }} />
            </FormField>
            <FormField label="Email Address" icon={Mail} error={errors.email}>
              <input type="email" className="input-field" placeholder="admin@school.com"
                value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(ev => ({ ...ev, email: '' })); }} />
            </FormField>
            <FormField label="New Password" icon={Lock} error={errors.password}
              hint={<><Lock className="w-3 h-3" /> Leave blank to keep current password</>}>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input-field pr-10"
                  placeholder="Min. 6 characters"
                  value={form.password} onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(ev => ({ ...ev, password: '' })); }} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)', opacity: saving ? 0.7 : 1 }}>
              {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
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
  const [searchInPanel, setSearchInPanel] = useState('');

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

  const filterList = (list, keys) => {
    if (!searchInPanel || !list) return list ?? [];
    const q = searchInPanel.toLowerCase();
    return list.filter(item => keys.some(k => (item[k] ?? '').toLowerCase().includes(q)));
  };

  const isActive = admin.is_active !== false;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-2xl h-full max-h-[calc(100vh-1.5rem)] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
          animation: 'slideInRight 0.3s cubic-bezier(0.34,1.2,0.64,1)',
        }}>
        {/* Panel header with gradient accent */}
        <div className="h-1 w-full flex-shrink-0" style={{ background: isActive ? 'linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)' : '#9ca3af' }} />

        <div className="flex items-start justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-3">
            <AdminAvatar name={admin.name} isActive={isActive} size={44} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{admin.name}</h2>
                {admin.is_super_admin && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    <Crown className="w-3 h-3" /> Super Admin
                  </span>
                )}
                <StatusBadge isActive={isActive} pulse />
              </div>
              <p className="text-xs mt-0.5 flex items-center gap-1 group" style={{ color: 'var(--text-secondary)' }}>
                <Mail className="w-3 h-3" />{admin.email}<CopyButton text={admin.email} />
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100 flex-shrink-0 ml-3 transition-colors">
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2.5 border-b flex-shrink-0" style={{ borderColor: 'var(--card-border)', background: 'var(--surface-100)' }}>
          {tabs.map(t => {
            const count = detail
              ? (t.id === 'teachers' ? detail.teachers?.length
                : t.id === 'classes' ? detail.classes?.length
                : t.id === 'students' ? detail.students?.length
                : null)
              : null;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={tab === t.id
                  ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }
                  : { color: 'var(--text-secondary)', background: 'transparent' }}>
                <t.icon className="w-3 h-3" />{t.label}
                {count != null && (
                  <span className="ml-0.5 text-xs rounded-full px-1.5 py-0"
                    style={{
                      background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--card-border)',
                      color: tab === t.id ? '#fff' : 'var(--text-secondary)',
                    }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search within panel */}
        {!loading && detail && tab !== 'overview' && (
          <div className="px-4 pt-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
              <input className="input-field pl-9 text-xs py-2" placeholder={`Search ${tab}…`}
                value={searchInPanel} onChange={e => setSearchInPanel(e.target.value)} />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3 mt-2">
              {[1, 2, 3].map(i => <div key={i} className="shimmer-bone h-14 rounded-xl" />)}
            </div>
          ) : !detail ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Could not load data</p>
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {tab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Teachers', value: detail.teachers?.length ?? 0, icon: GraduationCap, color: TOKENS.purple },
                      { label: 'Classes', value: detail.classes?.length ?? 0, icon: BookOpen, color: TOKENS.sky },
                      { label: 'Students', value: detail.students?.length ?? 0, icon: Users, color: TOKENS.emerald },
                      { label: 'Active Classes', value: detail.classes?.filter(c => c.is_active !== false).length ?? 0, icon: Activity, color: TOKENS.amber },
                    ].map((s, i) => (
                      <div key={s.label} className="rounded-xl p-3 flex flex-col gap-1 hover-lift"
                        style={{ background: `${s.color}0d`, border: `1px solid ${s.color}25`, animationDelay: `${i * 60}ms` }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20` }}>
                          <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                        </div>
                        <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Health score */}
                  {detail.teachers?.length > 0 && detail.classes?.length > 0 && (
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                          Workspace Health
                        </p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: TOKENS.emeraldGlass, color: TOKENS.emerald }}>
                          <Zap className="w-3 h-3 inline mr-0.5" />Operational
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Teacher utilization', value: detail.classes?.length, max: detail.teachers?.length * 5, color: TOKENS.purple },
                          { label: 'Class fill rate', value: detail.students?.length, max: detail.classes?.length * 30, color: TOKENS.sky },
                          { label: 'Active ratio', value: detail.classes?.filter(c => c.is_active !== false).length, max: detail.classes?.length, color: TOKENS.emerald },
                        ].map(m => (
                          <div key={m.label}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                              <span className="text-xs font-semibold tabular-nums" style={{ color: m.color }}>
                                {pct(m.value, m.max)}%
                              </span>
                            </div>
                            <SparkBar value={m.value} max={m.max} color={m.color} showLabel={false} height={4} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.teachers?.length > 0 && (
                    <div className="rounded-xl p-4" style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Teacher Load Distribution
                      </p>
                      <div className="space-y-2.5">
                        {detail.teachers.slice(0, 5).map(t => {
                          const tClasses = detail.classes?.filter(c =>
                            c.teacher_id?.toString() === t.id?.toString() || c.teacher_name === t.name
                          ) ?? [];
                          const maxLoad = Math.max(...detail.teachers.map(tt =>
                            detail.classes?.filter(c => c.teacher_name === tt.name).length ?? 0
                          ), 1);
                          return (
                            <div key={t.id} className="flex items-center gap-3">
                              <AdminAvatar name={t.name} isActive={t.is_active !== false} size={28}
                                gradient={t.is_active !== false ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : undefined} />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between mb-1">
                                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                                  <span className="text-xs ml-2 flex-shrink-0 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                    {tClasses.length} cls
                                  </span>
                                </div>
                                <SparkBar value={tClasses.length} max={maxLoad} color={TOKENS.purple} showLabel={false} height={5} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: TOKENS.purpleGlass }}>
                      <Calendar className="w-4 h-4" style={{ color: TOKENS.purple }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Account created</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {admin.created_at
                          ? new Date(admin.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <span className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ background: TOKENS.purpleGlass, color: TOKENS.purple }}>
                        ID #{admin.id}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TEACHERS TAB */}
              {tab === 'teachers' && (
                <div className="space-y-2 mt-2">
                  {filterList(detail.teachers, ['name', 'email']).length === 0
                    ? <EmptyState icon={GraduationCap} label="No teachers found" />
                    : filterList(detail.teachers, ['name', 'email']).map((t, i) => (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-100 transition-colors"
                        style={{ border: '1px solid var(--card-border)', animationDelay: `${i * 40}ms` }}>
                        <AdminAvatar name={t.name} isActive={t.is_active !== false} size={36}
                          gradient={t.is_active !== false ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : undefined} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                            <StatusBadge isActive={t.is_active !== false} />
                          </div>
                          <p className="text-xs truncate mt-0.5 group flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            {t.email}<CopyButton text={t.email} />
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <StatPill icon={BookOpen} label="cls" value={t.class_count ?? 0} color={TOKENS.sky} />
                          <StatPill icon={Users} label="stu" value={t.student_count ?? 0} color={TOKENS.emerald} />
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* CLASSES TAB */}
              {tab === 'classes' && (
                <div className="space-y-2 mt-2">
                  {filterList(detail.classes, ['name', 'teacher_name', 'level']).length === 0
                    ? <EmptyState icon={BookOpen} label="No classes found" />
                    : filterList(detail.classes, ['name', 'teacher_name', 'level']).map((cls, i) => (
                      <div key={cls.id} className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid var(--card-border)' }}>
                        <button
                          onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface-100 transition-colors">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: cls.is_active !== false ? `${TOKENS.sky}15` : '#9ca3af20' }}>
                            <BookOpen className="w-4 h-4" style={{ color: cls.is_active !== false ? TOKENS.sky : '#9ca3af' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{cls.name}</p>
                              {cls.level && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-indigo-50 text-indigo-600">
                                  {cls.level}
                                </span>
                              )}
                              <StatusBadge isActive={cls.is_active !== false} />
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                              {cls.teacher_name || <em>Unassigned</em>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatPill icon={Users} label="stu" value={cls.student_count ?? 0} color={TOKENS.emerald} />
                            {expandedClass === cls.id
                              ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                              : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
                          </div>
                        </button>
                        {expandedClass === cls.id && (
                          <div className="border-t px-3 pb-3 pt-2 space-y-1.5"
                            style={{ borderColor: 'var(--card-border)', background: 'var(--surface-100)' }}>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                              Enrolled ({cls.student_count ?? 0})
                            </p>
                            {!cls.enrolledStudents || cls.enrolledStudents.length === 0
                              ? <p className="text-xs text-center py-3" style={{ color: 'var(--text-secondary)' }}>No students enrolled</p>
                              : cls.enrolledStudents.map(s => (
                                <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg"
                                  style={{ background: 'var(--card-bg)' }}>
                                  <AdminAvatar name={s.name} isActive={s.is_active !== false} size={24}
                                    gradient={`linear-gradient(135deg,${TOKENS.emerald},#059669)`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{s.email}</p>
                                  </div>
                                  {s.level && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">{s.level}</span>
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
                <div className="space-y-2 mt-2">
                  {filterList(detail.students, ['name', 'email', 'level', 'trade']).length === 0
                    ? <EmptyState icon={Users} label="No students found" />
                    : filterList(detail.students, ['name', 'email', 'level', 'trade']).map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-100 transition-colors"
                        style={{ border: '1px solid var(--card-border)' }}>
                        <AdminAvatar name={s.name} isActive={s.is_active !== false} size={36}
                          gradient={s.is_active !== false ? `linear-gradient(135deg,${TOKENS.emerald},#059669)` : undefined} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                            <StatusBadge isActive={s.is_active !== false} />
                          </div>
                          <p className="text-xs truncate mt-0.5 group flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            {s.email}<CopyButton text={s.email} />
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                          {s.level && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">{s.level}</span>}
                          {s.trade && <span className="text-xs px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 font-medium">{s.trade}</span>}
                          <StatPill icon={BookOpen} label="cls" value={s.class_count ?? 0} color={TOKENS.sky} />
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

// ── Animated Summary Bar ───────────────────────────────────────────────────
function SummaryBar({ admins, allStats }) {
  const totalTeachers = allStats.reduce((s, a) => s + (a.teacher_count ?? 0), 0);
  const totalClasses = allStats.reduce((s, a) => s + (a.class_count ?? 0), 0);
  const totalStudents = allStats.reduce((s, a) => s + (a.student_count ?? 0), 0);
  const activeAdmins = admins.filter(a => a.is_active !== false).length;
  const inactiveAdmins = admins.length - activeAdmins;

  const stats = [
    {
      label: 'Admin Accounts', value: admins.length, sub: `${activeAdmins} active · ${inactiveAdmins} inactive`,
      icon: Shield, color: TOKENS.purple, bg: TOKENS.purpleGlass,
      trend: '+2 this month', trendUp: true,
      sparkData: [3, 5, 4, 7, 6, 8, admins.length],
    },
    {
      label: 'Total Teachers', value: totalTeachers, sub: 'across all workspaces',
      icon: GraduationCap, color: TOKENS.sky, bg: TOKENS.skyGlass,
      trend: 'Active educators', trendUp: true,
      sparkData: [10, 15, 12, 18, 20, 22, totalTeachers],
    },
    {
      label: 'Total Classes', value: totalClasses, sub: 'across all admins',
      icon: BookOpen, color: TOKENS.amber, bg: TOKENS.amberGlass,
      trend: 'Running sessions', trendUp: true,
      sparkData: [5, 8, 10, 14, 18, 20, totalClasses],
    },
    {
      label: 'Total Students', value: totalStudents, sub: 'enrolled platform-wide',
      icon: Users, color: TOKENS.emerald, bg: TOKENS.emeraldGlass,
      trend: 'Enrolled learners', trendUp: true,
      sparkData: [20, 35, 50, 80, 120, 160, totalStudents],
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="card hover-lift stat-card-glow"
          style={{ borderColor: `${s.color}20`, animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <MiniSparkline data={s.sparkData} color={s.color} />
          </div>
          <p className="text-2xl font-bold tabular-nums leading-none mb-0.5" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.65 }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Admin Card (list or grid) ──────────────────────────────────────────────
function AdminCard({ admin, stats, me, toggling, onToggle, onDelete, onViewDetail, onEdit, viewMode, index }) {
  const isMe = admin.id === me?.id;
  const isActive = admin.is_active !== false;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Grid mode ──────────────────────────────────────────────────────────
  if (viewMode === 'grid') {
    return (
      <div
        className="card hover-lift admin-card-enter flex flex-col gap-3"
        style={{
          borderColor: isActive ? `${TOKENS.purple}20` : 'rgba(239,68,68,0.15)',
          animationDelay: `${index * 50}ms`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle gradient background decoration */}
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 pointer-events-none"
          style={{ background: isActive ? TOKENS.purple : '#9ca3af', transform: 'translate(30%, -30%)' }} />

        <div className="flex items-start justify-between">
          <AdminAvatar name={admin.name} isActive={isActive} size={44} />
          <div className="flex items-center gap-1.5">
            <StatusBadge isActive={isActive} pulse={isActive} />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{admin.name}</p>
            {admin.is_super_admin && <Crown className="w-3.5 h-3.5 text-amber-500" />}
            {isMe && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">You</span>}
          </div>
          <p className="text-xs mt-0.5 group flex items-center gap-1 truncate" style={{ color: 'var(--text-secondary)' }}>
            {admin.email}<CopyButton text={admin.email} />
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: GraduationCap, val: stats?.teacher_count ?? '—', color: TOKENS.purple, label: 'Teachers' },
            { icon: BookOpen, val: stats?.class_count ?? '—', color: TOKENS.sky, label: 'Classes' },
            { icon: Users, val: stats?.student_count ?? '—', color: TOKENS.emerald, label: 'Students' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-2 flex flex-col items-center gap-0.5"
              style={{ background: `${s.color}0a`, border: `1px solid ${s.color}20` }}>
              <s.icon className="w-3 h-3" style={{ color: s.color }} />
              <span className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{s.val}</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {stats && (
          <SparkBar value={stats.student_count ?? 0} max={100} color={TOKENS.emerald} height={4} />
        )}

        <div className="flex gap-2 pt-1 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <button onClick={() => onViewDetail(admin)}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: TOKENS.purpleGlass, color: TOKENS.purple }}>
            <Eye className="w-3.5 h-3.5" /> Details
          </button>
          {!admin.is_super_admin && (
            <button onClick={() => onEdit(admin)}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: `${TOKENS.violet}15`, color: TOKENS.violet }}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {!isMe && (
            <button onClick={() => onToggle(admin)}
              disabled={toggling === admin.id}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: isActive ? TOKENS.amberGlass : TOKENS.emeraldGlass, color: isActive ? TOKENS.amber : TOKENS.emerald }}>
              {toggling === admin.id
                ? <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                : isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
            </button>
          )}
          {!isMe && (
            <button onClick={() => onDelete(admin)}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'rgba(244,63,94,0.08)', color: TOKENS.rose }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── List mode (default) ────────────────────────────────────────────────
  return (
    <div
      className="card hover-lift admin-card-enter"
      style={{
        borderColor: isActive ? 'var(--card-border)' : 'rgba(244,63,94,0.15)',
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <AdminAvatar name={admin.name} isActive={isActive} size={44} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{admin.name}</p>
            {admin.is_super_admin && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                <Crown className="w-3 h-3" />Super Admin
              </span>
            )}
            {isMe && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">You</span>
            )}
            <StatusBadge isActive={isActive} pulse={isActive} />
          </div>
          <p className="text-xs mt-0.5 group flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{admin.email}</span>
            <CopyButton text={admin.email} />
          </p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatPill icon={GraduationCap} label="teachers" value={stats?.teacher_count ?? '…'} color={TOKENS.purple} />
            <StatPill icon={BookOpen} label="classes" value={stats?.class_count ?? '…'} color={TOKENS.sky} />
            <StatPill icon={Users} label="students" value={stats?.student_count ?? '…'} color={TOKENS.emerald} />
          </div>

          {stats && (
            <div className="mt-2 max-w-xs">
              <SparkBar value={stats.student_count ?? 0} max={100} color={TOKENS.emerald} height={4} />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-1 flex-wrap justify-end">
          <button onClick={() => onViewDetail(admin)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: TOKENS.purpleGlass, color: TOKENS.purple }}>
            <Eye className="w-3.5 h-3.5" /><span className="hidden sm:inline">Details</span>
          </button>

          {!admin.is_super_admin && (
            <button onClick={() => onEdit(admin)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: `${TOKENS.violet}15`, color: TOKENS.violet }}>
              <Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {!isMe && (
            <>
              <button onClick={() => onToggle(admin)} disabled={toggling === admin.id}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: isActive ? TOKENS.amberGlass : TOKENS.emeraldGlass,
                  color: isActive ? TOKENS.amber : TOKENS.emerald,
                  opacity: toggling === admin.id ? 0.6 : 1,
                  cursor: toggling === admin.id ? 'not-allowed' : 'pointer',
                }}>
                {toggling === admin.id
                  ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isActive ? 'Deactivate' : 'Activate'}</span>
              </button>

              <button onClick={() => onDelete(admin)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: TOKENS.rose }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Admin Modal ─────────────────────────────────────────────────────
function CreateAdminModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Valid email required';
    if (!form.password.trim()) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'At least 6 characters';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await api.post('/admin/admins', form);
      toast.success('Admin account created successfully');
      onCreate();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create admin');
    } finally { setSaving(false); }
  };

  const isValid = form.name.trim() && form.email.trim() && form.password.length >= 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
          animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)' }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Create Admin Account</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>New isolated workspace</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100 transition-colors">
              <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          <AlertBanner type="info">
            Each admin gets a fully isolated workspace. Teachers, classes, and students created by this admin will not be visible to others.
          </AlertBanner>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <FormField label="Full Name" icon={User} error={errors.name}>
              <input className="input-field" placeholder="e.g. Admin Kigali Branch"
                value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(v => ({ ...v, name: '' })); }} />
            </FormField>
            <FormField label="Email Address" icon={Mail} error={errors.email}>
              <input type="email" className="input-field" placeholder="admin@school.com"
                value={form.email} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(v => ({ ...v, email: '' })); }} />
            </FormField>
            <FormField label="Password" icon={Lock} error={errors.password}>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input-field pr-10"
                  placeholder="Min. 6 characters"
                  value={form.password} onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(v => ({ ...v, password: '' })); }} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>

            {/* Password strength */}
            {form.password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(l => {
                    const strength = form.password.length >= 6 ? (form.password.length >= 10 ? (form.password.length >= 14 ? 4 : 3) : 2) : 1;
                    return (
                      <div key={l} className="flex-1 h-1 rounded-full transition-all duration-300"
                        style={{
                          background: l <= strength
                            ? strength === 1 ? TOKENS.rose : strength === 2 ? TOKENS.amber : strength === 3 ? TOKENS.sky : TOKENS.emerald
                            : 'var(--card-border)',
                        }} />
                    );
                  })}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {form.password.length < 6 ? 'Too short' : form.password.length < 10 ? 'Fair' : form.password.length < 14 ? 'Good' : 'Strong'}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="btn-secondary flex-1" disabled={saving}>Cancel</button>
              <button type="submit" disabled={saving || !isValid}
                className="btn-primary flex-1"
                style={{ opacity: !isValid ? 0.6 : 1 }}>
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                <Plus className="w-4 h-4" /> Create Admin
              </button>
            </div>
          </form>
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // name | students | teachers | classes | created
  const [viewMode, setViewMode] = useState('list'); // list | grid
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [editAdmin, setEditAdmin] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setShowSortMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const getStats = (adminId) => allStats.find(s =>
    s.admin_id === adminId || s.admin_id?.toString() === adminId?.toString()
  );

  const filtered = useMemo(() => {
    let list = admins.filter(a => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || (filter === 'active' ? a.is_active !== false : a.is_active === false);
      return matchSearch && matchFilter;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      const sa = getStats(a.id);
      const sb = getStats(b.id);
      if (sortBy === 'students') return (sb?.student_count ?? 0) - (sa?.student_count ?? 0);
      if (sortBy === 'teachers') return (sb?.teacher_count ?? 0) - (sa?.teacher_count ?? 0);
      if (sortBy === 'classes') return (sb?.class_count ?? 0) - (sa?.class_count ?? 0);
      return 0;
    });

    return list;
  }, [admins, search, filter, sortBy, allStats]);

  const handleToggleRequest = (admin) => {
    const isActive = admin.is_active !== false;
    setConfirmModal({ type: isActive ? 'deactivate' : 'activate', admin });
  };

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
    } finally { setToggling(null); setConfirmLoading(false); }
  };

  const handleDeleteRequest = (admin) => setConfirmModal({ type: 'delete', admin });

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

  const handleEditSave = (updatedAdmin) => {
    setAdmins(prev => prev.map(a => a.id === updatedAdmin.id ? { ...a, ...updatedAdmin } : a));
    setEditAdmin(null);
  };

  const activeCount = admins.filter(a => a.is_active !== false).length;
  const inactiveCount = admins.filter(a => a.is_active === false).length;

  const sortOptions = [
    { value: 'name', label: 'Name A–Z' },
    { value: 'students', label: 'Most Students' },
    { value: 'teachers', label: 'Most Teachers' },
    { value: 'classes', label: 'Most Classes' },
    { value: 'created', label: 'Newest First' },
  ];

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div className="space-y-5">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
                <Shield className="w-4.5 h-4.5 text-white" />
              </div>
              <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
                Admin Accounts
              </h1>
              {!loading && (
                <span className="text-sm font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: TOKENS.purpleGlass, color: TOKENS.purple }}>
                  {admins.length}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Manage isolated admin workspaces, their teachers, classes, and students.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--card-border)', background: 'var(--surface-100)' }}>
              {[
                { mode: 'list', icon: List },
                { mode: 'grid', icon: LayoutGrid },
              ].map(({ mode, icon: Icon }) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className="w-8 h-8 flex items-center justify-center transition-all"
                  style={viewMode === mode
                    ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff' }
                    : { color: 'var(--text-secondary)' }}>
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            <button onClick={() => load(true)} disabled={refreshing}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-surface-100"
              style={{ border: '1px solid var(--card-border)' }}
              title="Refresh">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
            </button>

            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <UserPlus className="w-4 h-4" /> New Admin
            </button>
          </div>
        </div>

        {/* ── Summary stats ───────────────────────────────────────────────── */}
        {!loading && <SummaryBar admins={admins} allStats={allStats} />}

        {/* ── Info card ───────────────────────────────────────────────────── */}
        <div className="card" style={{ background: TOKENS.purpleGlass, borderColor: 'rgba(99,102,241,0.2)' }}>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(99,102,241,0.15)' }}>
              <Network className="w-4 h-4" style={{ color: TOKENS.purple }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Isolated Workspace Model</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Each admin operates in a fully isolated workspace. Teachers, students, and classes created by one admin are invisible to others.
                Use separate accounts per school branch or department.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
                style={{ background: TOKENS.emeraldGlass, color: TOKENS.emerald }}>
                <Signal className="w-3 h-3" />{activeCount} Online
              </div>
            </div>
          </div>
        </div>

        {/* ── Toolbar: search + filter + sort ─────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <input className="input-field pl-9 text-sm" placeholder="Search by name or email…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: 'var(--surface-100)', border: '1px solid var(--card-border)' }}>
            {[
              { id: 'all', label: `All (${admins.length})` },
              { id: 'active', label: `Active (${activeCount})` },
              { id: 'inactive', label: `Inactive (${inactiveCount})` },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={filter === f.id
                  ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }
                  : { color: 'var(--text-secondary)' }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative" ref={sortMenuRef}>
            <button onClick={() => setShowSortMenu(p => !p)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-secondary)' }}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {sortOptions.find(o => o.value === sortBy)?.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-20"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', animation: 'fadeUp 0.15s ease' }}>
                {sortOptions.map(o => (
                  <button key={o.value} onClick={() => { setSortBy(o.value); setShowSortMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-between"
                    style={{ color: sortBy === o.value ? TOKENS.purple : 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-100)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    {o.label}
                    {sortBy === o.value && <CheckCircle className="w-3.5 h-3.5" style={{ color: TOKENS.purple }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Result count */}
        {!loading && (search || filter !== 'all') && (
          <div className="flex items-center gap-2">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> of {admins.length} admins
            </p>
            <button onClick={() => { setSearch(''); setFilter('all'); }}
              className="text-xs font-semibold transition-colors"
              style={{ color: TOKENS.purple }}>
              Clear filters
            </button>
          </div>
        )}

        {/* ── Admins List / Grid ─────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--surface-100)' }}>
              <Shield className="w-7 h-7" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {search || filter !== 'all' ? 'No admins match your filter' : 'No admin accounts yet'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {search || filter !== 'all' ? 'Try adjusting your search or filter' : 'Create your first admin account to get started'}
              </p>
            </div>
            {(search || filter !== 'all') && (
              <button onClick={() => { setSearch(''); setFilter('all'); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: TOKENS.purpleGlass, color: TOKENS.purple }}>
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((admin, i) => (
              <AdminCard key={admin.id} admin={admin} stats={getStats(admin.id)} me={me}
                toggling={toggling} onToggle={handleToggleRequest} onDelete={handleDeleteRequest}
                onViewDetail={setSelectedAdmin} onEdit={setEditAdmin} viewMode="grid" index={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((admin, i) => (
              <AdminCard key={admin.id} admin={admin} stats={getStats(admin.id)} me={me}
                toggling={toggling} onToggle={handleToggleRequest} onDelete={handleDeleteRequest}
                onViewDetail={setSelectedAdmin} onEdit={setEditAdmin} viewMode="list" index={i} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <CreateAdminModal
          onClose={() => setShowCreateModal(false)}
          onCreate={() => load(true)}
        />
      )}

      {selectedAdmin && (
        <AdminDetailPanel admin={selectedAdmin} onClose={() => setSelectedAdmin(null)} />
      )}

      {editAdmin && (
        <EditAdminModal admin={editAdmin} onSave={handleEditSave} onClose={() => setEditAdmin(null)} />
      )}

      {confirmModal && (
        <ConfirmModal type={confirmModal.type} admin={confirmModal.admin}
          onConfirm={handleConfirm} onCancel={() => setConfirmModal(null)} loading={confirmLoading} />
      )}
    </>
  );
}