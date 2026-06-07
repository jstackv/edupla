import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Lock, Eye, EyeOff, Sun, Moon, Bell, Globe, Palette,
  Shield, Check, ChevronRight, Zap, Monitor,
} from 'lucide-react';

/* ── shared password strength bar ─────────────────── */
function StrengthBar({ password }) {
  const score = !password ? 0 : [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  if (!password) return null;
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', gap:4, marginBottom:4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex:1, height:3, borderRadius:3, background: i <= score ? colors[score] : '#e5e7eb', transition:'background 0.3s' }} />
        ))}
      </div>
      <span style={{ fontSize:11, fontWeight:600, color: colors[score] }}>{labels[score]}</span>
    </div>
  );
}

/* ── toggle switch ──────────────────────────────────── */
function Toggle({ checked, onChange, color = '#6366f1' }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
        background: checked ? color : '#d1d5db',
        position:'relative', transition:'background 0.2s', padding:0, flexShrink:0,
      }}
    >
      <span style={{
        position:'absolute', top:3, left: checked ? 23 : 3,
        width:18, height:18, borderRadius:'50%', background:'#fff',
        boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
        transition:'left 0.2s cubic-bezier(0.4,0,0.2,1)',
      }} />
    </button>
  );
}

/* ══════════════════════════════════════════════════════
   ADMIN SETTINGS  — dark control room aesthetic
══════════════════════════════════════════════════════ */
function AdminSettings({ user, dark, toggleTheme }) {
  const accentColor = user?.is_super_admin ? '#8b5cf6' : '#6366f1';
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [show, setShow] = useState({ cur:false, new_:false, conf:false });
  const [saving, setSaving] = useState(false);
  const [notifs, setNotifs] = useState({ system:true, security:true, updates:false });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!form.currentPassword) return toast.error('Enter your current password');
    if (form.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await api.put('/auth/profile', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password updated successfully');
      setForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update password'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .as-card { border-radius:18px; background:${dark?'#13161f':'#fff'}; border:1px solid ${dark?'#1e2535':'#e5e7eb'}; overflow:hidden; margin-bottom:14px; }
        .as-field { width:100%; padding:11px 14px; border-radius:11px; font-size:13.5px; outline:none; transition:all 0.15s; background:${dark?'#0a0c14':'#f9fafb'}; border:1.5px solid ${dark?'#1a2030':'#e5e7eb'}; color:${dark?'#e2e8f0':'#111827'}; font-family:'DM Sans',sans-serif; }
        .as-field:focus { border-color:${accentColor}; box-shadow:0 0 0 3px ${accentColor}20; }
        .as-section-header { padding:20px 22px 14px; border-bottom:1px solid ${dark?'#1e2535':'#f1f5f9'}; display:flex; align-items:center; gap:12px; }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ margin:'0 0 4px', fontFamily:"'Sora',sans-serif", fontSize:22, fontWeight:800, color:dark?'#f1f5f9':'#0f172a', letterSpacing:'-0.02em' }}>Settings</h1>
        <p style={{ margin:0, fontSize:13, color:dark?'#64748b':'#9ca3af' }}>Control your account preferences and security</p>
      </div>

      {/* Appearance */}
      <div className="as-card">
        <div className="as-section-header">
          <div style={{ width:36, height:36, borderRadius:10, background:`${accentColor}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Palette size={17} color={accentColor} />
          </div>
          <div>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:dark?'#e2e8f0':'#111827', fontFamily:"'Sora',sans-serif" }}>Appearance</p>
            <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Display theme preferences</p>
          </div>
        </div>
        <div style={{ padding:'14px 22px 18px' }}>
          {/* Theme toggle card */}
          <div style={{ display:'flex', gap:12 }}>
            {[
              { id:'light', label:'Light Mode', icon:Sun,     desc:'Clean bright interface' },
              { id:'dark',  label:'Dark Mode',  icon:Moon,    desc:'Easy on the eyes'       },
            ].map(({ id, label, icon:Icon, desc }) => {
              const isActive = (id==='dark')===dark;
              return (
                <div key={id} onClick={() => { if (!isActive) toggleTheme(); }} style={{
                  flex:1, padding:'16px', borderRadius:14, cursor:'pointer',
                  border:`2px solid ${isActive?accentColor:(dark?'#1e2535':'#e5e7eb')}`,
                  background: isActive ? `${accentColor}10` : (dark?'#0f1117':'#f9fafb'),
                  transition:'all 0.15s', position:'relative',
                }}>
                  {isActive && (
                    <div style={{ position:'absolute', top:10, right:10, width:20, height:20, borderRadius:'50%', background:accentColor, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Check size={11} color="#fff" />
                    </div>
                  )}
                  <Icon size={22} color={isActive?accentColor:(dark?'#4a5168':'#9ca3af')} style={{ marginBottom:8 }} />
                  <p style={{ margin:'0 0 3px', fontSize:13.5, fontWeight:700, color:dark?'#e2e8f0':'#0f172a' }}>{label}</p>
                  <p style={{ margin:0, fontSize:11.5, color:dark?'#4a5168':'#9ca3af' }}>{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="as-card">
        <div className="as-section-header">
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Bell size={17} color="#10b981" />
          </div>
          <div>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:dark?'#e2e8f0':'#111827', fontFamily:"'Sora',sans-serif" }}>Notifications</p>
            <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Choose what alerts you receive</p>
          </div>
        </div>
        <div style={{ padding:'6px 22px 14px' }}>
          {[
            { key:'system',   label:'System alerts',    desc:'Critical platform notifications', color:'#ef4444' },
            { key:'security', label:'Security events',  desc:'Login attempts and changes',      color:'#f59e0b' },
            { key:'updates',  label:'Product updates',  desc:'New features and improvements',   color:'#6366f1' },
          ].map(({ key, label, desc, color }) => (
            <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:`1px solid ${dark?'#1e2535':'#f1f5f9'}` }}>
              <div>
                <p style={{ margin:'0 0 2px', fontSize:13.5, fontWeight:600, color:dark?'#e2e8f0':'#111827' }}>{label}</p>
                <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>{desc}</p>
              </div>
              <Toggle checked={notifs[key]} onChange={v => setNotifs(n=>({...n,[key]:v}))} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="as-card">
        <div className="as-section-header">
          <div style={{ width:36, height:36, borderRadius:10, background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Shield size={17} color="#ef4444" />
          </div>
          <div>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:dark?'#e2e8f0':'#111827', fontFamily:"'Sora',sans-serif" }}>Security & Password</p>
            <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Keep your account protected</p>
          </div>
        </div>
        <div style={{ padding:'18px 22px 22px' }}>
          <form onSubmit={handleChangePassword}>
            <div style={{ display:'grid', gap:14, marginBottom:18 }}>
              {[
                { key:'currentPassword', label:'Current Password', show:show.cur, toggle:()=>setShow(s=>({...s,cur:!s.cur})), placeholder:'Enter current password' },
                { key:'newPassword',     label:'New Password',     show:show.new_, toggle:()=>setShow(s=>({...s,new_:!s.new_})), placeholder:'Min. 6 characters', showStrength:true },
                { key:'confirmPassword', label:'Confirm New Password', show:show.conf, toggle:()=>setShow(s=>({...s,conf:!s.conf})), placeholder:'Repeat new password' },
              ].map(({ key, label, show:s, toggle, placeholder, showStrength }) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:dark?'#94a3b8':'#374151', marginBottom:7, letterSpacing:'0.03em' }}>{label}</label>
                  <div style={{ position:'relative' }}>
                    <Lock size={14} color={dark?'#4a5168':'#9ca3af'} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)' }} />
                    <input
                      className="as-field" style={{ paddingLeft:38, paddingRight:40 }}
                      type={s?'text':'password'} value={form[key]}
                      onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                      placeholder={placeholder}
                    />
                    <button type="button" onClick={toggle} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:dark?'#4a5168':'#9ca3af' }}>
                      {s ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {showStrength && <StrengthBar password={form.newPassword} />}
                  {key==='confirmPassword' && form.newPassword && form.confirmPassword && form.newPassword!==form.confirmPassword && (
                    <p style={{ fontSize:11.5, color:'#ef4444', marginTop:5 }}>Passwords do not match</p>
                  )}
                </div>
              ))}
            </div>
            <button type="submit" disabled={saving} style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'11px 24px', borderRadius:12, border:'none',
              background:`linear-gradient(135deg,${accentColor},${user?.is_super_admin?'#6d28d9':'#4338ca'})`,
              color:'#fff', fontSize:13.5, fontWeight:600, cursor:'pointer',
              boxShadow:`0 4px 14px ${accentColor}40`, fontFamily:"'DM Sans',sans-serif",
              transition:'all 0.15s',
            }}>
              {saving ? <div style={{ width:15,height:15,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} /> : <Shield size={15} />}
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* Account info */}
      <div className="as-card">
        <div className="as-section-header">
          <div style={{ width:36, height:36, borderRadius:10, background:dark?'#1a1f2e':'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Globe size={17} color={dark?'#64748b':'#9ca3af'} />
          </div>
          <div>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:dark?'#e2e8f0':'#111827', fontFamily:"'Sora',sans-serif" }}>Account Overview</p>
            <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Your account details</p>
          </div>
        </div>
        <div style={{ padding:'6px 22px 18px' }}>
          {[
            { label:'Role',       value: user?.is_super_admin?'Super Administrator':'Administrator' },
            { label:'Account ID', value:`#${user?.id||user?._id||'—'}` },
            { label:'Platform',   value:'EDUPLA v2.0' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 0', borderBottom:`1px solid ${dark?'#1e2535':'#f1f5f9'}` }}>
              <span style={{ fontSize:13, color:dark?'#64748b':'#9ca3af' }}>{label}</span>
              <span style={{ fontSize:13, fontWeight:600, color:dark?'#e2e8f0':'#111827' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TEACHER SETTINGS  — clean refined professional
══════════════════════════════════════════════════════ */
function TeacherSettings({ dark, toggleTheme }) {
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [show, setShow] = useState({ cur:false, new_:false, conf:false });
  const [saving, setSaving] = useState(false);
  const [notifs, setNotifs] = useState({ assignments:true, announcements:true, documents:false });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!form.currentPassword) return toast.error('Enter your current password');
    if (form.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await api.put('/auth/profile', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password updated');
      setForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update password'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth:640, margin:'0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600&display=swap');
        .ts-card { border-radius:18px; background:${dark?'#13161f':'#fff'}; border:1px solid ${dark?'#1e2535':'#e5e7eb'}; overflow:hidden; margin-bottom:14px; }
        .ts-field { width:100%; padding:11px 14px; border-radius:11px; font-size:13.5px; outline:none; transition:all 0.15s; background:${dark?'#0f1117':'#f9fafb'}; border:1.5px solid ${dark?'#1e2535':'#e5e7eb'}; color:${dark?'#e2e8f0':'#111827'}; font-family:'DM Sans',sans-serif; }
        .ts-field:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
        .ts-row { display:flex; justify-content:space-between; align-items:center; padding:14px 22px; border-bottom:1px solid ${dark?'#1e2535':'#f1f5f9'}; }
      `}</style>

      <div style={{ marginBottom:20 }}>
        <h1 style={{ margin:'0 0 4px', fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:dark?'#f1f5f9':'#0f172a' }}>Settings</h1>
        <p style={{ margin:0, fontSize:13, color:dark?'#64748b':'#9ca3af' }}>Manage your preferences</p>
      </div>

      {/* Appearance */}
      <div className="ts-card">
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px 14px', borderBottom:`1px solid ${dark?'#1e2535':'#f1f5f9'}` }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'rgba(99,102,241,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Palette size={16} color="#6366f1" />
          </div>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:dark?'#e2e8f0':'#111827', fontFamily:"'Playfair Display',serif" }}>Appearance</p>
        </div>
        <div className="ts-row">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {dark ? <Moon size={18} color="#6366f1" /> : <Sun size={18} color="#f59e0b" />}
            <div>
              <p style={{ margin:0, fontSize:13.5, fontWeight:600, color:dark?'#e2e8f0':'#111827' }}>{dark?'Dark Mode':'Light Mode'}</p>
              <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Toggle the interface theme</p>
            </div>
          </div>
          <Toggle checked={dark} onChange={toggleTheme} />
        </div>
      </div>

      {/* Notifications */}
      <div className="ts-card">
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px 14px', borderBottom:`1px solid ${dark?'#1e2535':'#f1f5f9'}` }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'rgba(16,185,129,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Bell size={16} color="#10b981" />
          </div>
          <p style={{ margin:0, fontSize:14, fontWeight:700, color:dark?'#e2e8f0':'#111827', fontFamily:"'Playfair Display',serif" }}>Notifications</p>
        </div>
        {[
          { key:'assignments',   label:'New assignments',     desc:'When students submit work' },
          { key:'announcements', label:'Announcements',       desc:'Class and school-wide news' },
          { key:'documents',     label:'Document activity',   desc:'Uploads and downloads' },
        ].map(({ key, label, desc }) => (
          <div key={key} className="ts-row">
            <div>
              <p style={{ margin:'0 0 2px', fontSize:13.5, fontWeight:600, color:dark?'#e2e8f0':'#111827' }}>{label}</p>
              <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>{desc}</p>
            </div>
            <Toggle checked={notifs[key]} onChange={v => setNotifs(n=>({...n,[key]:v}))} />
          </div>
        ))}
      </div>

      {/* Password */}
      <div className="ts-card">
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 22px 14px', borderBottom:`1px solid ${dark?'#1e2535':'#f1f5f9'}` }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'rgba(245,158,11,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Shield size={16} color="#f59e0b" />
          </div>
          <div>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:dark?'#e2e8f0':'#111827', fontFamily:"'Playfair Display',serif" }}>Change Password</p>
            <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Keep your account secure</p>
          </div>
        </div>
        <div style={{ padding:'18px 22px 22px' }}>
          <form onSubmit={handleChangePassword}>
            <div style={{ display:'grid', gap:13, marginBottom:16 }}>
              {[
                { key:'currentPassword', label:'Current Password', show:show.cur, toggle:()=>setShow(s=>({...s,cur:!s.cur})), placeholder:'Current password' },
                { key:'newPassword',     label:'New Password',     show:show.new_, toggle:()=>setShow(s=>({...s,new_:!s.new_})), placeholder:'New password (min. 6 chars)', showStrength:true },
                { key:'confirmPassword', label:'Confirm Password', show:show.conf, toggle:()=>setShow(s=>({...s,conf:!s.conf})), placeholder:'Repeat new password' },
              ].map(({ key, label, show:s, toggle, placeholder, showStrength }) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:dark?'#94a3b8':'#374151', marginBottom:6 }}>{label}</label>
                  <div style={{ position:'relative' }}>
                    <Lock size={14} color={dark?'#4a5168':'#9ca3af'} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)' }} />
                    <input className="ts-field" style={{ paddingLeft:38, paddingRight:40 }} type={s?'text':'password'} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={placeholder} />
                    <button type="button" onClick={toggle} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:dark?'#4a5168':'#9ca3af' }}>
                      {s ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  {showStrength && <StrengthBar password={form.newPassword} />}
                </div>
              ))}
            </div>
            <button type="submit" disabled={saving} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 22px', borderRadius:11, border:'none', background:'linear-gradient(135deg,#6366f1,#4338ca)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 14px rgba(99,102,241,0.35)', fontFamily:"'DM Sans',sans-serif" }}>
              {saving ? <div style={{ width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} /> : <Shield size={14}/>}
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STUDENT SETTINGS  — friendly, colorful, playful
══════════════════════════════════════════════════════ */
function StudentSettings({ dark, toggleTheme }) {
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [show, setShow] = useState({ cur:false, new_:false, conf:false });
  const [saving, setSaving] = useState(false);
  const [notifs, setNotifs] = useState({ assignments:true, announcements:true, documents:false });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!form.currentPassword) return toast.error('Enter your current password');
    if (form.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await api.put('/auth/profile', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password updated! 🎉');
      setForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update password'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth:620, margin:'0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500;600&display=swap');
        .ss-card { border-radius:20px; background:${dark?'#13161f':'#fff'}; border:1px solid ${dark?'#1e2535':'#e5e7eb'}; overflow:hidden; margin-bottom:14px; }
        .ss-field { width:100%; padding:11px 14px; border-radius:12px; font-size:13.5px; outline:none; transition:all 0.15s; background:${dark?'#0f1117':'#f9fafb'}; border:1.5px solid ${dark?'#1e2535':'#e5e7eb'}; color:${dark?'#e2e8f0':'#111827'}; font-family:'DM Sans',sans-serif; }
        .ss-field:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,0.15); }
      `}</style>

      <div style={{ marginBottom:20 }}>
        <h1 style={{ margin:'0 0 4px', fontFamily:"'Nunito',sans-serif", fontSize:24, fontWeight:900, color:dark?'#f1f5f9':'#0f172a' }}>⚙️ Your Settings</h1>
        <p style={{ margin:0, fontSize:13, color:dark?'#64748b':'#9ca3af' }}>Personalize your EDUPLA experience</p>
      </div>

      {/* Appearance */}
      <div className="ss-card" style={{ padding:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {dark ? <Moon size={18} color="#fff" /> : <Sun size={18} color="#fff" />}
          </div>
          <div>
            <p style={{ margin:0, fontSize:15, fontWeight:800, color:dark?'#e2e8f0':'#0f172a', fontFamily:"'Nunito',sans-serif" }}>Theme</p>
            <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Pick your vibe</p>
          </div>
          <div style={{ marginLeft:'auto' }}>
            <Toggle checked={dark} onChange={toggleTheme} color="#8b5cf6" />
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { id:'light', label:'☀️ Light', desc:'Bright and fresh', active:!dark },
            { id:'dark',  label:'🌙 Dark',  desc:'Easy on eyes',    active:dark  },
          ].map(({ id, label, desc, active }) => (
            <div key={id} onClick={() => { if (!active) toggleTheme(); }} style={{
              padding:'14px', borderRadius:14, cursor:'pointer',
              border:`2px solid ${active?'#8b5cf6':(dark?'#1e2535':'#e5e7eb')}`,
              background: active ? 'rgba(139,92,246,0.08)' : (dark?'#0f1117':'#f9fafb'),
              transition:'all 0.15s', position:'relative',
            }}>
              {active && <div style={{ position:'absolute', top:8, right:8, width:18, height:18, borderRadius:'50%', background:'#8b5cf6', display:'flex', alignItems:'center', justifyContent:'center' }}><Check size={10} color="#fff" /></div>}
              <p style={{ margin:'0 0 3px', fontSize:14, fontWeight:800, color:dark?'#e2e8f0':'#0f172a', fontFamily:"'Nunito',sans-serif" }}>{label}</p>
              <p style={{ margin:0, fontSize:11.5, color:dark?'#64748b':'#9ca3af' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="ss-card" style={{ padding:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Bell size={18} color="#fff" />
          </div>
          <div>
            <p style={{ margin:0, fontSize:15, fontWeight:800, color:dark?'#e2e8f0':'#0f172a', fontFamily:"'Nunito',sans-serif" }}>Notifications</p>
            <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Stay in the loop</p>
          </div>
        </div>
        {[
          { key:'assignments',   label:'📝 Assignments',     desc:'New and upcoming deadlines', color:'#6366f1' },
          { key:'announcements', label:'📢 Announcements',   desc:'Class and school news',       color:'#10b981' },
          { key:'documents',     label:'📁 New Documents',   desc:'Shared study materials',      color:'#f59e0b' },
        ].map(({ key, label, desc, color }) => (
          <div key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:`1px solid ${dark?'#1e2535':'#f1f5f9'}` }}>
            <div>
              <p style={{ margin:'0 0 2px', fontSize:13.5, fontWeight:700, color:dark?'#e2e8f0':'#111827', fontFamily:"'Nunito',sans-serif" }}>{label}</p>
              <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>{desc}</p>
            </div>
            <Toggle checked={notifs[key]} onChange={v => setNotifs(n=>({...n,[key]:v}))} color={color} />
          </div>
        ))}
      </div>

      {/* Password */}
      <div className="ss-card" style={{ padding:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#f59e0b,#d97706)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Lock size={18} color="#fff" />
          </div>
          <div>
            <p style={{ margin:0, fontSize:15, fontWeight:800, color:dark?'#e2e8f0':'#0f172a', fontFamily:"'Nunito',sans-serif" }}>Change Password</p>
            <p style={{ margin:0, fontSize:12, color:dark?'#64748b':'#9ca3af' }}>Keep your account safe</p>
          </div>
        </div>
        <form onSubmit={handleChangePassword}>
          <div style={{ display:'grid', gap:13, marginBottom:16 }}>
            {[
              { key:'currentPassword', label:'Current Password', show:show.cur, toggle:()=>setShow(s=>({...s,cur:!s.cur})), placeholder:'Your current password' },
              { key:'newPassword',     label:'New Password',     show:show.new_, toggle:()=>setShow(s=>({...s,new_:!s.new_})), placeholder:'At least 6 characters', showStrength:true },
              { key:'confirmPassword', label:'Confirm Password', show:show.conf, toggle:()=>setShow(s=>({...s,conf:!s.conf})), placeholder:'Type it again' },
            ].map(({ key, label, show:s, toggle, placeholder, showStrength }) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:dark?'#94a3b8':'#374151', marginBottom:6, fontFamily:"'Nunito',sans-serif" }}>{label}</label>
                <div style={{ position:'relative' }}>
                  <Lock size={14} color={dark?'#4a5168':'#9ca3af'} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)' }} />
                  <input className="ss-field" style={{ paddingLeft:38, paddingRight:40 }} type={s?'text':'password'} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={placeholder} />
                  <button type="button" onClick={toggle} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:dark?'#4a5168':'#9ca3af' }}>
                    {s ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                {showStrength && <StrengthBar password={form.newPassword} />}
                {key==='confirmPassword' && form.newPassword && form.confirmPassword && form.newPassword!==form.confirmPassword && (
                  <p style={{ fontSize:11.5, color:'#ef4444', marginTop:5 }}>⚠️ Passwords don't match</p>
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={saving} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 24px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(16,185,129,0.4)', fontFamily:"'Nunito',sans-serif" }}>
            {saving ? <div style={{ width:15,height:15,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} /> : '🔒'}
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ROUTER
══════════════════════════════════════════════════════ */
export default function Settings() {
  const { user } = useAuth();
  const { dark, toggleTheme } = useTheme();
  if (user?.role === 'admin')   return <AdminSettings   user={user} dark={dark} toggleTheme={toggleTheme} />;
  if (user?.role === 'teacher') return <TeacherSettings dark={dark} toggleTheme={toggleTheme} />;
  return <StudentSettings dark={dark} toggleTheme={toggleTheme} />;
}