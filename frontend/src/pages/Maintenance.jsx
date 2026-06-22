import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMaintenance } from '../context/MaintenanceContext';
import toast from 'react-hot-toast';
import {
  GraduationCap, Settings, Clock, RefreshCw, ShieldCheck,
  LogOut, ArrowRight, Sun, Moon, Sparkles,
  Mail, Lock, Eye, EyeOff, AlertCircle, X,
} from 'lucide-react';

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');

  @keyframes mp-orb {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(26px,-18px) scale(1.05); }
    66%     { transform: translate(-18px,14px) scale(0.96); }
  }
  @keyframes mp-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes mp-pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.45); }
    70%  { box-shadow: 0 0 0 14px rgba(99,102,241,0); }
    100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  }
  @keyframes mp-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes mp-panel-in { from { opacity:0; transform:translateY(-6px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes mp-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }
  .mp-fade { animation: mp-fade-up 0.5s ease both; }
  .mp-panel { animation: mp-panel-in 0.28s cubic-bezier(0.16,1,0.3,1) both; }
  .mp-shake { animation: mp-shake 0.4s ease; }

  .mp-admin-toggle { transition: background .2s, border-color .2s, color .2s, transform .2s; }
  .mp-admin-toggle:hover { transform: translateY(-1px); }

  .mp-input { transition: border-color .2s, box-shadow .2s, background .2s; }
  .mp-input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }

  .mp-eye-btn { transition: transform .15s, opacity .15s; }
  .mp-eye-btn:hover { opacity: 1 !important; transform: scale(1.1); }

  .mp-close-btn { transition: background .2s, transform .2s; }
  .mp-close-btn:hover { transform: rotate(90deg); }

  .mp-submit-btn { transition: transform .2s, box-shadow .2s, filter .2s; }
  .mp-submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(79,70,229,0.35); filter: brightness(1.05); }
  .mp-submit-btn:active:not(:disabled) { transform: translateY(0); }
`;

function formatEta(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export default function Maintenance() {
  const { user, login, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const { maintenance, refresh } = useMaintenance();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const eta = formatEta(maintenance?.estimated_back_at);

  const handleCheckAgain = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  const closeAdminLogin = () => {
    setShowAdminLogin(false);
    setError('');
    setForm({ email: '', password: '' });
    setShowPassword(false);
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      setError('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      // On success, AuthContext's user updates and the app gate re-renders
      // straight into the dashboard — nothing else to do here.
      toast.success('Welcome back!');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    }
    setSubmitting(false);
  };

  const inputBase = {
    width: '100%',
    padding: '11px 14px 11px 40px',
    borderRadius: 12,
    border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#dde5f5'}`,
    background: dark ? 'rgba(255,255,255,0.05)' : '#f8f9ff',
    color: dark ? '#f1f5f9' : '#0f172a',
    fontSize: 13.5,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{
        minHeight: '100vh', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        background: dark
          ? 'radial-gradient(circle at 20% 20%, #161b30 0%, #0b0f1a 55%, #060810 100%)'
          : 'radial-gradient(circle at 20% 20%, #eef0ff 0%, #f4f6ff 55%, #ffffff 100%)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        {/* Drifting orbs */}
        <div style={{
          position: 'absolute', top: '-8%', right: '-6%', width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          animation: 'mp-orb 9s ease-in-out infinite', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-8%', width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)',
          animation: 'mp-orb 12s ease-in-out infinite reverse', pointerEvents: 'none',
        }} />

        {/* Theme toggle, top-right */}
        <button onClick={toggleTheme} title={dark ? 'Switch to light' : 'Switch to dark'} style={{
          position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          {dark ? <Sun size={15} color="#94a3b8" /> : <Moon size={15} color="#64748b" />}
        </button>

        <div className="mp-fade" style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 480,
          background: dark ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.92)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.12)'}`,
          borderRadius: 28, padding: '2.5rem 2.25rem',
          boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.55)' : '0 30px 70px rgba(79,70,229,0.16)',
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
        }}>
          {/* Brand mark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#4338ca)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={16} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', color: dark ? '#f1f5f9' : '#1e1b4b' }}>
              EDUPLA
            </span>
          </div>

          {/* Animated icon */}
          <div style={{
            width: 76, height: 76, borderRadius: '50%', margin: '0 auto 22px',
            background: dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.10)',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'mp-pulse-ring 2.6s infinite',
          }}>
            <Settings size={32} color="#6366f1" style={{ animation: 'mp-spin-slow 7s linear infinite' }} />
          </div>

          <h1 style={{
            fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 24,
            color: dark ? '#f1f5f9' : '#1e1b4b', marginBottom: 10, letterSpacing: '-0.01em',
          }}>
            We'll be right back
          </h1>

          <p style={{
            fontSize: 14, lineHeight: 1.6, color: dark ? '#94a3b8' : '#475569',
            marginBottom: eta ? 18 : 24, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto',
          }}>
            {maintenance?.message || "We're performing scheduled maintenance to improve EDUPLA. We'll be back online shortly — thank you for your patience."}
          </p>

          {eta && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12,
              padding: '8px 16px', marginBottom: 24, fontSize: 12.5, fontWeight: 700,
              color: '#6366f1',
            }}>
              <Clock size={13} /> Estimated back online: {eta}
            </div>
          )}

          {/* Check again */}
          <button onClick={handleCheckAgain} disabled={checking} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
            borderRadius: 12, padding: '10px 20px', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, color: dark ? '#e2e8f0' : '#334155',
            marginBottom: 6,
          }}>
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            Check again
          </button>

          <p style={{ fontSize: 11, color: dark ? '#475569' : '#94a3b8', marginBottom: 24 }}>
            This page checks automatically every 20 seconds.
          </p>

          {/* Logged-in but blocked: offer sign out */}
          {user && (
            <button onClick={logout} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, color: dark ? '#64748b' : '#94a3b8',
              marginBottom: 4,
            }}>
              <LogOut size={12} /> Sign out ({user.name})
            </button>
          )}

          {/* Anonymous: subtle admin sign-in affordance */}
          {!user && !showAdminLogin && (
            <button onClick={() => setShowAdminLogin(true)} className="mp-admin-toggle" style={{
              background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.05)',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.15)'}`,
              borderRadius: 999, cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              color: dark ? '#9aa3c4' : '#6b7299',
              padding: '8px 16px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <ShieldCheck size={13} /> Administrator sign in
            </button>
          )}

          {!user && showAdminLogin && (
            <div className="mp-panel" style={{
              textAlign: 'left', marginTop: 8, paddingTop: 22,
              borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
            }}>
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: dark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ShieldCheck size={15} color="#6366f1" />
                  </div>
                  <div>
                    <p style={{
                      fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14,
                      color: dark ? '#f1f5f9' : '#1e1b4b', margin: 0, lineHeight: 1.3,
                    }}>
                      Administrator sign in
                    </p>
                    <p style={{ fontSize: 11.5, color: dark ? '#64748b' : '#94a3b8', margin: 0 }}>
                      Manage maintenance mode
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAdminLogin}
                  className="mp-close-btn"
                  aria-label="Close"
                  style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                    background: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: dark ? '#94a3b8' : '#64748b',
                  }}
                >
                  <X size={13} />
                </button>
              </div>

              <form onSubmit={handleAdminSubmit}>
                {/* Email */}
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <Mail size={15} style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: dark ? '#5b6485' : '#9aa3c4', pointerEvents: 'none',
                  }} />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="Administrator email"
                    className="mp-input"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    style={inputBase}
                  />
                </div>

                {/* Password */}
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: dark ? '#5b6485' : '#9aa3c4', pointerEvents: 'none',
                  }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Password"
                    className="mp-input"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ ...inputBase, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="mp-eye-btn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: 12, top: '50%', marginTop: -8,
                      background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                      color: dark ? '#5b6485' : '#9aa3c4', opacity: 0.85,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {error && (
                  <div className="mp-shake" style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: dark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.07)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 10, padding: '8px 12px', marginBottom: 14,
                  }}>
                    <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
                  </div>
                )}

                <button type="submit" disabled={submitting} className="mp-submit-btn" style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '11px 14px', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 700,
                  opacity: submitting ? 0.75 : 1,
                }}>
                  {submitting ? 'Signing in…' : 'Sign in'}
                  {!submitting && <ArrowRight size={14} />}
                </button>
              </form>
            </div>
          )}
        </div>

        <div style={{
          position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center',
          fontSize: 11, color: dark ? '#3a4060' : '#b6bedb',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Sparkles size={11} /> EDUPLA Platform Status — Under Maintenance
        </div>
      </div>
    </>
  );
}