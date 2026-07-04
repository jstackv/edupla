import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  User, Mail, Save, Shield, ShieldCheck, GraduationCap, BookOpen,
  Edit3, CheckCircle, Star, Layers, Award, Zap,
  Lock, Crown, Hexagon, Circle, Triangle,
  Fingerprint, Activity, Sparkles, Settings as SettingsIcon } from 'lucide-react';

/* ─── gradient palette keyed by first char ─── */
const PALETTES = [
  { a: '#f97316', b: '#ea580c', c: '#fed7aa' },
  { a: '#0ea5e9', b: '#0284c7', c: '#bae6fd' },
  { a: '#10b981', b: '#059669', c: '#a7f3d0' },
  { a: '#8b5cf6', b: '#7c3aed', c: '#ddd6fe' },
  { a: '#ec4899', b: '#db2777', c: '#fbcfe8' },
  { a: '#f59e0b', b: '#d97706', c: '#fde68a' },
];
const palette = (name) => PALETTES[(name?.charCodeAt(0) || 0) % PALETTES.length];
const initials = (name) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';

/* ─── format a date the user actually has (created_at) ─── */
function formatJoined(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}


/* ════════════════════════════════════════════════════════════════
   ADMIN PROFILE  — "The Console"
   A credential-grade access console. Etched hexagonal seal, a live
   clearance gauge, and a permissions matrix that actually reflects
   what the account can touch. Super Admin runs in a violet/gold
   "Sovereign" finish; Admin runs in a steel/cyan "Sentinel" finish.
════════════════════════════════════════════════════════════════ */
const ADMIN_MODULES = [
  { key: 'teachers',    label: 'Teachers',         icon: BookOpen },
  { key: 'students',    label: 'Students',         icon: GraduationCap },
  { key: 'classes',     label: 'Classes',          icon: Layers },
  { key: 'assessments', label: 'Assessments',      icon: Award },
  { key: 'settings',    label: 'Settings',         icon: SettingsIcon },
  { key: 'admins',      label: 'Admin Management', icon: Crown,       superOnly: true },
  { key: 'maintenance', label: 'System Core',      icon: Fingerprint, superOnly: true },
];

function AdminProfile({ user, dark }) {
  const { refreshUser } = useAuth();
  const isSuperAdmin = user?.is_super_admin;
  const isActive = user?.is_active !== false;
  const joined = formatJoined(user?.created_at);
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email are required');
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: form.name, email: form.email });
      await refreshUser();
      toast.success('Profile updated');
      setEditMode(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  // ── Sovereign (super admin) vs Sentinel (admin) finish ──
  const accentA   = isSuperAdmin ? '#c4b5fd' : '#7dd3fc';
  const accentB   = isSuperAdmin ? '#a78bfa' : '#38bdf8';
  const accentGold= isSuperAdmin ? '#fbbf24' : '#22d3ee';
  const accentDim = isSuperAdmin ? '#6d28d9' : '#0369a1';
  const SealIcon  = isSuperAdmin ? Crown : ShieldCheck;
  const clearance = Math.round((ADMIN_MODULES.filter(m => !m.superOnly || isSuperAdmin).length / ADMIN_MODULES.length) * 100);
  const R = 42, CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - clearance / 100);

  const panelBg = dark ? '#07070a' : '#0a0a14';

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <style>{`
        .cns * { box-sizing: border-box; }
        @keyframes cns-rotate { to { transform: rotate(360deg); } }
        @keyframes cns-rotate-rev { to { transform: rotate(-360deg); } }
        @keyframes cns-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes cns-drift { 0% { background-position: 0 0; } 100% { background-position: 120px 120px; } }
        @keyframes cns-holo { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes cns-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .cns-panel {
          background: ${panelBg};
          border: 1px solid ${accentB}26;
          border-radius: 6px;
          position: relative;
          overflow: hidden;
          margin-bottom: 14px;
        }
        .cns-eyebrow {
          font-family: 'Space Grotesk', 'DM Sans', sans-serif;
          font-size: 10.5px; letter-spacing: 0.22em; text-transform: uppercase;
          color: ${accentA}b0; font-weight: 600;
        }
        .cns-mono { font-family: 'Space Grotesk', 'DM Sans', monospace; }
        .cns-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 20px; border-radius: 4px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
          letter-spacing: 0.06em;
        }
        .cns-btn-primary { background: linear-gradient(120deg, ${accentA}, ${accentB}); border: none; color: #05050a; }
        .cns-btn-primary:hover { filter: brightness(1.12); }
        .cns-btn-ghost { background: transparent; border: 1px solid ${accentB}55; color: ${accentA}; }
        .cns-btn-ghost:hover { border-color: ${accentA}; background: ${accentB}12; }
        .cns-field {
          width: 100%; padding: 10px 14px;
          background: #ffffff08; border: 1px solid ${accentB}30;
          border-radius: 4px; color: #f1f5f9;
          font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cns-field:focus { border-color: ${accentA}; box-shadow: 0 0 0 3px ${accentB}18; }
        .cns-field::placeholder { color: #ffffff30; }
        .cns-mod {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-radius: 5px;
          animation: cns-rise 0.4s ease both;
        }
        .cns-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 0; border-bottom: 1px solid ${accentB}12; }
        .cns-row:last-child { border-bottom: none; }
      `}</style>

      <div className="cns">
        {/* ── Hero: identity console ── */}
        <div className="cns-panel" style={{ padding: 0 }}>
          {/* Ambient backdrop: dot grid + holographic aurora sweep */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.5,
              backgroundImage: `radial-gradient(${accentB}22 1px, transparent 1px)`,
              backgroundSize: '22px 22px',
              animation: 'cns-drift 14s linear infinite',
            }} />
            <div style={{
              position: 'absolute', top: '-40%', left: '-10%', width: '70%', height: '180%',
              background: `linear-gradient(115deg, ${accentA}22, ${accentGold}14, transparent 60%)`,
              backgroundSize: '200% 200%',
              animation: 'cns-holo 9s ease-in-out infinite',
              filter: 'blur(30px)',
            }} />
            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
              <div key={pos} style={{
                position: 'absolute',
                [pos.includes('top') ? 'top' : 'bottom']: 14,
                [pos.includes('left') ? 'left' : 'right']: 14,
                width: 22, height: 22,
                borderTop: pos.includes('top') ? `2px solid ${accentA}70` : 'none',
                borderBottom: pos.includes('bottom') ? `2px solid ${accentA}70` : 'none',
                borderLeft: pos.includes('left') ? `2px solid ${accentA}70` : 'none',
                borderRight: pos.includes('right') ? `2px solid ${accentA}70` : 'none',
              }} />
            ))}
          </div>

          <div style={{ padding: '38px 34px 30px', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Hexagonal clearance seal */}
              <div style={{ position: 'relative', width: 108, height: 108, flexShrink: 0 }}>
                <svg width="108" height="108" viewBox="0 0 108 108" style={{ position: 'absolute', inset: 0, animation: 'cns-rotate 16s linear infinite' }}>
                  <circle cx="54" cy="54" r="52" fill="none" stroke={accentA} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 7" />
                </svg>
                <svg width="108" height="108" viewBox="0 0 108 108" style={{ position: 'absolute', inset: 0, animation: 'cns-rotate-rev 22s linear infinite' }}>
                  <circle cx="54" cy="54" r="46" fill="none" stroke={accentGold} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="1 5" />
                </svg>
                <div style={{
                  position: 'absolute', top: 9, left: 9, right: 9, bottom: 9,
                  clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
                  background: `linear-gradient(150deg, ${accentDim}, #05050a 75%)`,
                  border: `1px solid ${accentA}60`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <SealIcon size={34} color={accentA} strokeWidth={1.5} />
                </div>
                <div style={{
                  position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, borderRadius: '50%',
                  background: isActive ? '#10b981' : '#ef4444', border: `2px solid ${panelBg}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle size={11} color="#fff" />
                </div>
              </div>

              {/* Identity */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Sparkles size={12} color={accentGold} />
                  <span className="cns-eyebrow">{isSuperAdmin ? 'Sovereign Clearance' : 'Sentinel Clearance'}</span>
                  <span style={{ width: 40, height: 1, background: `linear-gradient(90deg, ${accentA}, transparent)` }} />
                </div>
                <h1 className="cns-mono" style={{
                  margin: 0, fontSize: 34, fontWeight: 700,
                  lineHeight: 1.05, letterSpacing: '-0.02em',
                  backgroundImage: `linear-gradient(100deg, #f8fafc, ${accentA}, ${accentGold}, #f8fafc)`,
                  backgroundSize: '250% 100%',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  animation: 'cns-holo 7s ease-in-out infinite',
                }}>
                  {user?.name}
                </h1>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: '#7d8aa3' }}>{user?.email}</p>
              </div>

              {/* Clearance gauge */}
              <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
                <svg width="104" height="104" viewBox="0 0 104 104">
                  <circle cx="52" cy="52" r={R} fill="none" stroke={`${accentB}20`} strokeWidth="7" />
                  <circle cx="52" cy="52" r={R} fill="none" stroke={accentA} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={CIRC} strokeDashoffset={dashOffset}
                    transform="rotate(-90 52 52)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="cns-mono" style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{clearance}%</span>
                  <span style={{ fontSize: 8.5, letterSpacing: '0.1em', color: '#7d8aa3', textTransform: 'uppercase' }}>Access</span>
                </div>
              </div>

              <button className="cns-btn cns-btn-ghost" onClick={() => setEditMode(e => !e)}>
                <Edit3 size={12} />
                {editMode ? 'Cancel' : 'Edit Identity'}
              </button>
            </div>

            {/* Live status strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginTop: 30, background: `${accentB}14`, borderRadius: 4, overflow: 'hidden' }}>
              {[
                { k: 'Status',   v: isActive ? 'Active' : 'Inactive', dot: isActive ? '#10b981' : '#ef4444', icon: Activity },
                { k: 'Rank',     v: isSuperAdmin ? 'Super Admin' : 'Admin', dot: accentA, icon: SealIcon },
                { k: 'Session',  v: now.toLocaleTimeString(), dot: accentGold, icon: Fingerprint, mono: true },
                { k: 'Enrolled', v: joined || 'Unknown', dot: '#7d8aa3', icon: Star },
              ].map(({ k, v, dot, icon: Icon, mono }) => (
                <div key={k} style={{ padding: '13px 14px', background: panelBg, textAlign: 'left' }}>
                  <span className="cns-eyebrow" style={{ display: 'block', marginBottom: 6, fontSize: 9.5 }}>{k}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={12} color={dot} style={{ flexShrink: 0 }} />
                    <span className={mono ? 'cns-mono' : ''} style={{ fontSize: 12.5, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Edit form ── */}
        {editMode && (
          <div className="cns-panel" style={{ padding: '26px 30px' }}>
            <p className="cns-eyebrow" style={{ marginBottom: 18 }}>Modify Credential</p>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label className="cns-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Display Name</label>
                  <input className="cns-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label className="cns-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Email Address</label>
                  <input className="cns-field" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="cns-btn cns-btn-ghost" onClick={() => setEditMode(false)}>Discard</button>
                <button type="submit" className="cns-btn cns-btn-primary" disabled={saving}>
                  {saving ? <div style={{ width: 12, height: 12, border: '2px solid #00000040', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Save size={12} />}
                  {saving ? 'Writing…' : 'Commit Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Permissions matrix ── */}
        <div className="cns-panel" style={{ padding: '22px 28px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <ShieldCheck size={14} color={accentA} />
            <span className="cns-eyebrow">System Access Matrix</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
            {ADMIN_MODULES.map(({ key, label, icon: Icon, superOnly }, i) => {
              const unlocked = !superOnly || isSuperAdmin;
              return (
                <div key={key} className="cns-mod" style={{
                  background: unlocked ? `${accentB}0f` : '#ffffff05',
                  border: `1px solid ${unlocked ? accentB + '35' : '#ffffff12'}`,
                  animationDelay: `${i * 0.05}s`,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                    background: unlocked ? `${accentA}20` : 'transparent',
                    border: `1px solid ${unlocked ? accentA + '50' : '#ffffff18'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unlocked ? <Icon size={15} color={accentA} /> : <Lock size={13} color="#565f75" />}
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: unlocked ? '#e2e8f0' : '#565f75' }}>{label}</span>
                  {superOnly && (
                    <span className="cns-mono" style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: '0.05em', color: unlocked ? accentGold : '#565f75', textTransform: 'uppercase' }}>
                      {unlocked ? 'Sovereign' : 'Locked'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Account ledger ── */}
        <div className="cns-panel" style={{ padding: '22px 28px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Fingerprint size={14} color={accentA} />
            <span className="cns-eyebrow">Account Record</span>
          </div>
          {[
            ['Identifier',    `#${user?.id || user?._id || '—'}`],
            ['Role Class',    isSuperAdmin ? 'super_admin' : 'admin'],
            ['Email',         user?.email],
            ['Phone',         user?.phone || '—'],
            ['Auth Level',    isSuperAdmin ? 'Full System Access' : 'Admin Access'],
            ['Account Status', isActive ? 'Active' : 'Inactive'],
            ['Joined',        joined || '—'],
          ].map(([k, v]) => (
            <div key={k} className="cns-row">
              <span style={{ fontSize: 12, color: '#7d8aa3', fontWeight: 500 }}>{k}</span>
              <span className="cns-mono" style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   TEACHER PROFILE — Warm Editorial / Luxury Magazine
   Cream tones, editorial typography, refined & confident
════════════════════════════════════════════════════════════════ */
function TeacherProfile({ user, dark }) {
  const { refreshUser } = useAuth();
  const isActive = user?.is_active !== false;
  const joined = formatJoined(user?.created_at);
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const pal = palette(user?.name);
  const ini = initials(user?.name);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email are required');
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: form.name, email: form.email });
      await refreshUser();
      toast.success('Profile updated');
      setEditMode(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const bg = dark ? '#0d0c0b' : '#faf8f5';
  const card = dark ? '#161412' : '#ffffff';
  const border = dark ? '#2a2520' : '#e8e0d5';
  const text = dark ? '#f5f0e8' : '#1a1208';
  const muted = dark ? '#6b5d4f' : '#9c8a78';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <style>{`
        .tch-card { background: ${card}; border: 1px solid ${border}; border-radius: 16px; overflow: hidden; margin-bottom: 14px; }
        .tch-field { width: 100%; padding: 12px 16px; border-radius: 10px; font-size: 14px; outline: none; transition: all 0.2s; background: ${dark ? '#1a1410' : '#faf8f5'}; border: 1.5px solid ${border}; color: ${text}; font-family: 'DM Sans', sans-serif; }
        .tch-field:focus { border-color: ${pal.a}; box-shadow: 0 0 0 4px ${pal.a}12; }
        .tch-field::placeholder { color: ${muted}80; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes tch-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
      `}</style>

      {/* Hero — split layout with oversized initial */}
      <div className="tch-card" style={{ position: 'relative', overflow: 'visible' }}>
        {/* Decorative top rule */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${pal.a}, ${pal.b}, ${pal.a})` }} />

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr' }}>
          {/* Left panel */}
          <div style={{
            background: `linear-gradient(160deg, ${pal.a}15, ${pal.b}08)`,
            borderRight: `1px solid ${border}`,
            padding: '36px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            position: 'relative', overflow: 'hidden' }}>
            {/* Big decorative letter behind */}
            <div style={{
              position: 'absolute', top: -10, left: -10,
              fontSize: 160, fontWeight: 700,
              color: `${pal.a}08`, lineHeight: 1,
              userSelect: 'none', pointerEvents: 'none' }}>
              {ini?.[0]}
            </div>

            {/* Avatar circle */}
            <div style={{
              width: 88, height: 88, borderRadius: '50%',
              background: `linear-gradient(135deg, ${pal.a}, ${pal.b})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 700, color: '#fff',
              boxShadow: `0 16px 40px ${pal.a}40`,
              position: 'relative', zIndex: 1,
              border: `4px solid ${card}`,
              marginBottom: 16 }}>
              {ini}
            </div>

            <div style={{ padding: '5px 14px', borderRadius: 30, background: `${pal.a}18`, border: `1px solid ${pal.a}30`, marginBottom: 10, zIndex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: pal.a, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Educator</span>
            </div>

            <div style={{ width: 1, height: 20, background: `linear-gradient(180deg, ${pal.a}40, transparent)`, margin: '4px 0' }} />

            {[
              { icon: CheckCircle, label: isActive ? 'Active' : 'Inactive', color: isActive ? '#10b981' : '#ef4444' },
              { icon: BookOpen, label: 'Teacher', color: pal.a },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', zIndex: 1 }}>
                <Icon size={13} color={color} />
                <span style={{ fontSize: 12, color: muted }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Right content */}
          <div style={{ padding: '36px 32px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 500, color: muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Faculty Profile
            </p>
            <h1 style={{
              margin: '0 0 10px',
              fontSize: 36, fontWeight: 700,
              color: text, lineHeight: 1.1,
              letterSpacing: '-0.01em' }}>
              {user?.name}
            </h1>

            <div style={{ width: 48, height: 2, background: `linear-gradient(90deg, ${pal.a}, transparent)`, marginBottom: 12 }} />

            <p style={{ margin: '0 0 20px', fontSize: 13, color: muted }}>
              {user?.email}{user?.phone ? ` · ${user.phone}` : ''}
            </p>

            {/* Metrics row */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              {[
                { n: isActive ? 'Active' : 'Inactive', s: 'Status' },
                { n: joined || '—', s: 'Joined' },
                { n: 'Teacher', s: 'Role' },
              ].map(({ n, s }) => (
                <div key={s} style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: text }}>{n}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setEditMode(e => !e)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8,
                border: `1.5px solid ${border}`,
                background: 'transparent', color: muted,
                fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = pal.a; e.currentTarget.style.color = pal.a; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = muted; }}
            >
              <Edit3 size={13} />
              {editMode ? 'Cancel editing' : 'Edit profile'}
            </button>
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="tch-card" style={{ padding: '28px 28px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: text }}>Update information</h3>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Full Name', key: 'name', type: 'text', ph: 'Your name' },
                { label: 'Email', key: 'email', type: 'email', ph: 'Your email' },
              ].map(({ label, key, type, ph }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: muted, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</label>
                  <input className="tch-field" type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditMode(false)} style={{ padding: '10px 20px', borderRadius: 8, border: `1.5px solid ${border}`, background: 'transparent', color: muted, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${pal.a}, ${pal.b})`, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: `0 4px 16px ${pal.a}35` }}>
                {saving ? <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Save size={13} />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Details */}
      <div className="tch-card" style={{ padding: '24px 28px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 700, color: text, fontStyle: 'italic' }}>Account details</h3>
        {[
          ['Account ID', `#${user?.id || user?._id || '—'}`],
          ['Full Name', user?.name],
          ['Email', user?.email],
          ['Phone', user?.phone || '—'],
          ['Role', 'Teacher'],
          ['Status', isActive ? 'Active' : 'Inactive'],
          ['Joined', joined || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${border}` }}>
            <span style={{ fontSize: 12, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: text, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   STUDENT PROFILE — Playful Gen-Z / Vibrant Dashboard
   Bold colors, big typography, fun + energetic. READ-ONLY.
════════════════════════════════════════════════════════════════ */
function StudentProfile({ user, dark }) {
  const pal = palette(user?.name);
  const ini = initials(user?.name);
  const isActive = user?.is_active !== false;
  const joined = formatJoined(user?.created_at);

  const bg = dark ? '#0a0a10' : '#f0f0f7';
  const card = dark ? '#111118' : '#ffffff';
  const border = dark ? '#1e1e2e' : '#e4e4f0';
  const text = dark ? '#e8e8f8' : '#0d0d1a';
  const muted = dark ? '#4a4a6a' : '#8888aa';

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <style>{`
        .stu-card { background: ${card}; border: 1px solid ${border}; border-radius: 24px; overflow: hidden; margin-bottom: 14px; }
        .stu-tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 100px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em; font-family: 'DM Sans', sans-serif; }
        .stu-badge { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 16px; border-radius: 18px; text-align: center; }
        @keyframes stu-bounce { 0%,100% { transform: scale(1) } 50% { transform: scale(1.04) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Hero card with big gradient splash */}
      <div className="stu-card" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Background blobs */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 250, height: 250, borderRadius: '50%', background: `radial-gradient(circle, ${pal.a}30, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${pal.b}20, transparent 70%)`, pointerEvents: 'none' }} />

        <div style={{ padding: '36px 32px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24 }}>
            {/* Avatar */}
            <div style={{
              width: 96, height: 96, borderRadius: 28,
              background: `linear-gradient(145deg, ${pal.a}, ${pal.b})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34, fontWeight: 800, color: '#fff',
              flexShrink: 0,
              animation: 'stu-bounce 3s ease-in-out infinite' }}>
              {ini}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="stu-tag" style={{ background: `${pal.a}18`, border: `1.5px solid ${pal.a}30`, color: pal.a }}>
                  <GraduationCap size={12} /> Student
                </span>
                <span className="stu-tag" style={{ background: dark ? '#1e1e2e' : '#f4f4ff', border: `1.5px solid ${border}`, color: muted }}>
                  EDUPLA
                </span>
              </div>
              <h1 style={{
                margin: '0 0 6px',
                fontSize: 30, fontWeight: 800,
                color: text, lineHeight: 1,
                letterSpacing: '-0.03em' }}>
                {user?.name}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: muted }}>{user?.email}{user?.phone ? ` · ${user.phone}` : ''}</p>
            </div>
          </div>

          {/* Info chips row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {user?.level && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 12, background: dark ? '#1e1e2e' : '#f4f4ff', border: `1.5px solid ${border}` }}>
                <Layers size={14} color={pal.a} />
                <span style={{ fontSize: 13, fontWeight: 700, color: text }}>Level {user.level}</span>
              </div>
            )}
            {user?.trade && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 12, background: dark ? '#1e1e2e' : '#f4f4ff', border: `1.5px solid ${border}` }}>
                <Award size={14} color={pal.a} />
                <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{user.trade}</span>
              </div>
            )}
            {user?.class_year && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 12, background: dark ? '#1e1e2e' : '#f4f4ff', border: `1.5px solid ${border}` }}>
                <GraduationCap size={14} color={pal.a} />
                <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{user.class_year}</span>
              </div>
            )}

            {/* Real active status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 12, background: isActive ? '#10b98115' : '#ef444415', border: `1.5px solid ${isActive ? '#10b98130' : '#ef444430'}` }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#10b981' : '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#10b981' : '#ef4444' }}>{isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { icon: GraduationCap, label: 'Academic Level', value: user?.level || 'Not assigned', color: pal.a },
          { icon: Award,         label: 'Trade / Field',  value: user?.trade || 'Not assigned', color: '#10b981' },
          { icon: Star,          label: 'Class Year',     value: user?.class_year || 'Not assigned', color: '#f59e0b' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="stu-card stu-badge" style={{ margin: 0 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: `${color}15`, border: `1.5px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon size={20} color={color} />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: text }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Read-only notice */}
      <div className="stu-card" style={{ padding: '16px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: dark ? '#1e1e2e' : '#f4f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Lock size={16} color={muted} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text }}>Profile is read-only</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: muted }}>Contact your school administrator to update your information.</p>
        </div>
      </div>

      {/* Account table */}
      <div className="stu-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${border}` }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: text }}>Account Information</h3>
        </div>
        <div style={{ padding: '0 24px 10px' }}>
          {[
            ['Account ID', `#${user?.id || user?._id || '—'}`],
            ['Full Name', user?.name],
            ['Email', user?.email],
            ['Phone', user?.phone || '—'],
            ['Role', 'Student'],
            ['Level', user?.level || '—'],
            ['Trade', user?.trade || '—'],
            ['Class Year', user?.class_year || '—'],
            ['Status', isActive ? 'Active' : 'Inactive'],
            ['Joined', joined || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${border}` }}>
              <span style={{ fontSize: 12, color: muted, fontWeight: 500 }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: text, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ── Router ─────────────────────────────────────────── */
export default function Profile() {
  const { user } = useAuth();
  const { dark } = useTheme();
  if (user?.role === 'admin')   return <AdminProfile   user={user} dark={dark} />;
  if (user?.role === 'teacher') return <TeacherProfile user={user} dark={dark} />;
  return <StudentProfile user={user} dark={dark} />;
}