import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { User, Mail, Save, Shield, GraduationCap, BookOpen, Calendar, Award } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email are required');
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: form.name, email: form.email });
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-rose-500','bg-amber-500','bg-indigo-500'];
  const avatarColor = AVATAR_COLORS[(user?.name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

  const roleLabel = user?.role === 'teacher' ? 'Teacher' : user?.role === 'student' ? 'Student' : 'Administrator';
  const roleIcon = user?.role === 'admin' ? Shield : user?.role === 'teacher' ? BookOpen : GraduationCap;
  const RoleIcon = roleIcon;

  const roleBadgeClass = user?.role === 'admin'
    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
    : user?.role === 'teacher'
    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <div className="card overflow-hidden p-0">
        {/* Banner */}
        <div className="h-24 w-full" style={{ background: 'linear-gradient(135deg, var(--primary-600, #2563eb) 0%, var(--primary-400, #60a5fa) 100%)' }} />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className={`w-20 h-20 rounded-2xl ${user?.role === 'admin' ? 'bg-violet-600' : avatarColor} flex items-center justify-center shadow-xl ring-4 ring-white dark:ring-gray-800 flex-shrink-0`}>
              {user?.role === 'admin'
                ? <Shield className="w-10 h-10 text-white" />
                : <span className="text-white font-bold text-3xl">{user?.name?.[0]?.toUpperCase()}</span>
              }
            </div>
            <div className="pb-1">
              <h2 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{user?.name}</h2>
              <p className="text-sm text-muted">{user?.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${roleBadgeClass}`}>
              <RoleIcon className="w-3 h-3" />
              {roleLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-100 text-muted">
              <Calendar className="w-3 h-3" />
              Member since 2025
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Award, label: 'Status', value: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { icon: RoleIcon, label: 'Role', value: roleLabel, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
          { icon: BookOpen, label: 'Platform', value: 'EDUPLA', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="card text-center py-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-xs text-muted mb-0.5">{label}</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Edit Profile — Teachers & Students can update name/email */}
      {(isTeacher || user?.role === 'student') && (
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <User className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>Profile Information</h3>
              <p className="text-xs text-muted">Update your name and email address</p>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field pl-10"
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="input-field pl-10"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="card">
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)' }}>
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Administrator Account</p>
              <p className="text-xs text-muted">Admin profiles are managed by the system. Contact support for changes.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
