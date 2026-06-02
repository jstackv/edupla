import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, Shield, Sun, Moon, Bell, Globe, Palette } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { dark, toggleTheme } = useTheme();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [notifs, setNotifs] = useState({ assignments: true, announcements: true, documents: false });

  const notifItems = [
    { key: 'assignments', label: 'New assignments', desc: 'Get notified when a teacher posts an assignment' },
    { key: 'announcements', label: 'Announcements', desc: 'Receive class and school-wide announcements' },
    { key: 'documents', label: 'Document uploads', desc: 'Alerts when new study materials are shared' },
  ];

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!form.currentPassword) return toast.error('Enter your current password');
    if (!form.newPassword) return toast.error('Enter a new password');
    if (form.newPassword.length < 6) return toast.error('New password must be at least 6 characters');
    if (form.newPassword !== form.confirmPassword) return toast.error('New passwords do not match');
    setChangingPassword(true);
    try {
      await api.put('/auth/profile', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setChangingPassword(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Appearance */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Palette className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>Appearance</h3>
            <p className="text-xs text-muted">Customize how EDUPLA looks for you</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-3">
            {dark ? <Moon className="w-5 h-5 text-indigo-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{dark ? 'Dark Mode' : 'Light Mode'}</p>
              <p className="text-xs text-muted">Toggle between light and dark theme</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative w-12 h-6 rounded-full transition-colors ${dark ? 'bg-primary-500' : 'bg-surface-200'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${dark ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Notifications placeholder */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Bell className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
            <p className="text-xs text-muted">Manage your notification preferences</p>
          </div>
        </div>
        {notifItems.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
              <p className="text-xs text-muted">{desc}</p>
            </div>
            <button onClick={() => setNotifs(n => ({ ...n, [key]: !n[key] }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${notifs[key] ? 'bg-primary-500' : 'bg-surface-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${notifs[key] ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>Change Password</h3>
            <p className="text-xs text-muted">Keep your account secure with a strong password</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="input-field pl-10 pr-10"
                placeholder="Enter current password"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary-600 transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type={showNew ? 'text' : 'password'}
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                className="input-field pl-10 pr-10"
                placeholder="Min. 6 characters"
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary-600 transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="input-field pl-10 pr-10"
                placeholder="Repeat new password"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary-600 transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.newPassword && form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={changingPassword} className="btn-primary">
              {changingPassword && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <Shield className="w-4 h-4" /> Update Password
            </button>
          </div>
        </form>
      </div>

      {/* Account info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900/30 flex items-center justify-center">
            <Globe className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>Account Info</h3>
            <p className="text-xs text-muted">Your account details on EDUPLA</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Role', value: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—' },
            { label: 'Account ID', value: `#${user?.id || '—'}` },
            { label: 'Platform', value: 'EDUPLA v1.0' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <span className="text-sm text-muted">{label}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
