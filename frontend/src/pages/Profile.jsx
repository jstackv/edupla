import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  User, Mail, Save, Shield, GraduationCap, BookOpen,
  Edit3, CheckCircle, Star, Layers, Award, Zap,
  Lock, Crown, Hexagon, Circle, Triangle } from 'lucide-react';

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


/* ════════════════════════════════════════════════════════════════
   ADMIN PROFILE  — Dark Command Center / Brutalist Tech
   Stark black with electric accent lines, authority + precision
════════════════════════════════════════════════════════════════ */
function AdminProfile({ user, dark }) {
  const isSuperAdmin = user?.is_super_admin;
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const accent = isSuperAdmin ? '#a78bfa' : '#38bdf8';
  const accentDim = isSuperAdmin ? '#7c3aed' : '#0284c7';

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email are required');
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: form.name, email: form.email });
      toast.success('Profile updated');
      setEditMode(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      <style>{`
        .adm-wrap * { box-sizing: border-box; }
        .adm-panel {
          background: ${dark ? '#09090b' : '#0f172a'};
          border: 1px solid ${accent}30;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
          margin-bottom: 12px;
        }
        .adm-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${accent}, transparent);
        }
        .adm-label { font-size: 10px; letter-spacing: 0.15em; color: ${accent}99; text-transform: uppercase; margin-bottom: 4px; display: block; font-family: 'DM Sans', sans-serif; }
        .adm-value { font-size: 14px; color: #e2e8f0; font-weight: 500; font-family: 'DM Sans', sans-serif; }
        .adm-field {
          width: 100%; padding: 10px 14px;
          background: #ffffff08;
          border: 1px solid ${accent}30;
          border-radius: 3px;
          color: #e2e8f0;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .adm-field:focus { border-color: ${accent}; box-shadow: 0 0 0 3px ${accent}15; }
        .adm-field::placeholder { color: #ffffff30; }
        .adm-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 20px; border-radius: 3px;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
          letter-spacing: 0.05em;
        }
        .adm-btn-primary { background: ${accent}; border: none; color: #000; }
        .adm-btn-primary:hover { background: #fff; }
        .adm-btn-ghost { background: transparent; border: 1px solid ${accent}50; color: ${accent}; }
        .adm-btn-ghost:hover { border-color: ${accent}; background: ${accent}10; }
        .adm-grid-row { display: grid; grid-template-columns: 140px 1fr; gap: 0; border-bottom: 1px solid ${accent}10; }
        .adm-grid-row:last-child { border-bottom: none; }
        @keyframes adm-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes adm-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
      `}</style>

      <div className="adm-wrap">
        {/* Hero identity block */}
        <div className="adm-panel" style={{ padding: 0 }}>
          {/* Scan line effect */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: '30%', background: `linear-gradient(180deg, transparent, ${accent}06, transparent)`, animation: 'adm-scan 4s linear infinite' }} />
            {/* Corner accents */}
            {['top-left','top-right','bottom-left','bottom-right'].map(pos => (
              <div key={pos} style={{
                position: 'absolute',
                [pos.includes('top') ? 'top' : 'bottom']: 12,
                [pos.includes('left') ? 'left' : 'right']: 12,
                width: 20, height: 20,
                borderTop: pos.includes('top') ? `2px solid ${accent}` : 'none',
                borderBottom: pos.includes('bottom') ? `2px solid ${accent}` : 'none',
                borderLeft: pos.includes('left') ? `2px solid ${accent}` : 'none',
                borderRight: pos.includes('right') ? `2px solid ${accent}` : 'none' }} />
            ))}
          </div>

          <div style={{ padding: '40px 36px', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 90, height: 90, borderRadius: 4,
                  background: `linear-gradient(135deg, ${accentDim}40, ${accent}20)`,
                  border: `1px solid ${accent}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative' }}>
                  <Shield size={38} color={accent} strokeWidth={1.5} />
                  <div style={{ position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, background: '#10b981', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={12} color="#000" />
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.2em', color: accent, textTransform: 'uppercase', fontWeight: 600 }}>
                    {isSuperAdmin ? '⬡ SUPER ADMIN' : '◈ ADMINISTRATOR'}
                  </span>
                  <span style={{ width: 40, height: 1, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                </div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {user?.name}
                </h1>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: '#64748b' }}>{user?.email}</p>
              </div>

              <button className="adm-btn adm-btn-ghost" onClick={() => setEditMode(e => !e)}>
                <Edit3 size={12} />
                {editMode ? 'CANCEL' : 'MODIFY'}
              </button>
            </div>

            {/* Stats strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, marginTop: 28, background: `${accent}15`, borderRadius: 2 }}>
              {[
                { k: 'STATUS', v: 'ONLINE', dot: '#10b981' },
                { k: 'ACCESS', v: isSuperAdmin ? 'LEVEL 99' : 'LEVEL 80', dot: accent },
                { k: 'ROLE', v: isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN', dot: '#f59e0b' },
                { k: 'SYSTEM', v: 'EDUPLA', dot: '#64748b' },
              ].map(({ k, v, dot }) => (
                <div key={k} style={{ padding: '14px 16px', background: dark ? '#09090b' : '#0f172a', textAlign: 'center' }}>
                  <span className="adm-label">{k}</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', animation: k === 'STATUS' ? 'adm-pulse 2s infinite' : 'none' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>{v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Edit form */}
        {editMode && (
          <div className="adm-panel" style={{ padding: '28px 32px' }}>
            <p className="adm-label" style={{ marginBottom: 20 }}>// MODIFY RECORD</p>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label className="adm-label">DISPLAY NAME</label>
                  <input className="adm-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label className="adm-label">EMAIL ADDRESS</label>
                  <input className="adm-field" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEditMode(false)}>ABORT</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                  {saving ? <div style={{ width: 12, height: 12, border: '2px solid #00000040', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Save size={12} />}
                  {saving ? 'WRITING…' : 'COMMIT'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Account data table */}
        <div className="adm-panel">
          <div style={{ padding: '18px 28px 10px', borderBottom: `1px solid ${accent}15` }}>
            <span className="adm-label">// ACCOUNT RECORD</span>
          </div>
          {[
            ['IDENTIFIER', `#${user?.id || user?._id || '—'}`],
            ['ROLE_CLASS', isSuperAdmin ? 'super_admin' : 'admin'],
            ['EMAIL_ADDR', user?.email],
            ['AUTH_LEVEL', isSuperAdmin ? 'FULL_SYSTEM_ACCESS' : 'ADMIN_ACCESS'],
            ['PLATFORM_ID', 'EDUPLA_V2'],
          ].map(([k, v]) => (
            <div key={k} className="adm-grid-row">
              <div style={{ padding: '14px 28px', background: `${accent}05`, borderRight: `1px solid ${accent}10` }}>
                <span className="adm-label" style={{ margin: 0 }}>{k}</span>
              </div>
              <div style={{ padding: '14px 24px' }}>
                <span className="adm-value">{v}</span>
              </div>
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
              { icon: CheckCircle, label: 'Active', color: '#10b981' },
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
              {user?.email}
            </p>

            {/* Metrics row */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              {[
                { n: 'Active', s: 'Status' },
                { n: 'EDUPLA', s: 'Platform' },
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
          ['Role', 'Teacher'],
          ['Platform', 'EDUPLA'],
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
              <p style={{ margin: 0, fontSize: 13, color: muted }}>{user?.email}</p>
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

            {/* Active status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 12, background: '#10b98115', border: '1.5px solid #10b98130' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { icon: GraduationCap, label: 'Academic Level', value: user?.level || 'N/A', color: pal.a },
          { icon: Award,         label: 'Trade / Field',  value: user?.trade || 'N/A', color: '#10b981' },
          { icon: Star,          label: 'Class Year',     value: user?.class_year || 'N/A', color: '#f59e0b' },
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
            ['Role', 'Student'],
            ['Level', user?.level || '—'],
            ['Trade', user?.trade || '—'],
            ['Class Year', user?.class_year || '—'],
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