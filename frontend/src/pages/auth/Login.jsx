import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import SEO from '../../components/common/SEO';
import BrandMark from '../../components/common/BrandMark';

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STATS_KEYS = [
  { valueKey: '2.4K', labelKey: 'auth.stats.students' },
  { valueKey: '180',  labelKey: 'auth.stats.courses'  },
  { valueKey: '96%',  labelKey: 'auth.stats.passRate' },
  { valueKey: '120',  labelKey: 'auth.stats.teachers' },
];

const FEATURES_KEYS = [
  { labelKey: 'auth.features.smartClassrooms', icon: '📚', color: '#8b5cf6' },
  { labelKey: 'auth.features.liveAnalytics',   icon: '📊', color: '#0ea5e9' },
  { labelKey: 'auth.features.instantFeedback', icon: '⚡', color: '#f59e0b' },
  { labelKey: 'auth.features.teamSpaces',      icon: '🤝', color: '#10b981' },
];

const TRUST_BADGES = [
  { icon: '🔒', color: '#6366f1' },
  { icon: '⏱',  color: '#0ea5e9' },
  { icon: '🏅', color: '#10b981' },
];

/* What signing in unlocks / how access to the system is protected.
   Shown on the left panel so users know exactly what they're getting
   before they type a single character. */
const ACCESS_INFO = [
  { icon: '🔐', textKey: 'auth.accessInfo.encrypted',  default: 'Encrypted sessions',      color: '#6366f1' },
  { icon: '🧭', textKey: 'auth.accessInfo.roleBased',   default: 'Role-based access',       color: '#0ea5e9' },
  { icon: '⏱',  textKey: 'auth.accessInfo.autoLogout',  default: 'Auto-logout protection',  color: '#10b981' },
];

/* NOTE: activity ticker items come from i18n (auth.activity array). */

/* ─────────────────────────────────────────────
   ANIMATED PARTICLES BACKGROUND
───────────────────────────────────────────── */
function ParticleBg({ dark }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let id;
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const pts = Array.from({ length: 40 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r:  Math.random() * 1.5 + 0.5,
    }));
    const accentR = dark ? '99,102,241' : '79,70,229';
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.hypot(dx, dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${accentR},${(1 - d / 110) * (dark ? 0.18 : 0.1)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${accentR},${dark ? 0.55 : 0.35})`;
        ctx.fill();
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', resize);
    };
  }, [dark]);

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

/* ─────────────────────────────────────────────
   ACTIVITY TICKER
───────────────────────────────────────────── */
function Ticker({ dark }) {
  const { t } = useTranslation();
  const activity = t('auth.activity', { returnObjects: true });
  const [idx,  setIdx]  = useState(0);
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => { setIdx(i => (i + 1) % activity.length); setShow(true); }, 300);
    }, 3600);
    return () => clearInterval(id);
  }, [activity.length]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '8px 15px', borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.05)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.12)'}`,
      backdropFilter: 'blur(10px)',
      overflow: 'hidden',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: '#34d399',
        flexShrink: 0, animation: 'ep-glowdot 2s infinite',
      }} />
      <span style={{
        fontSize: 11.5, color: dark ? '#94a3b8' : '#64748b', fontWeight: 500,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(3px)',
        transition: 'opacity 0.28s, transform 0.28s',
      }}>
        {activity[idx]}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   INLINE TOAST
───────────────────────────────────────────── */
function InlineToast({ msg, type, onClose }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  const isErr = type === 'error';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '11px 14px', borderRadius: 13, marginBottom: 14,
      background: isErr ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
      border: `1.5px solid ${isErr ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)'}`,
      animation: 'ep-slideup 0.25s cubic-bezier(0.22,1,0.36,1)',
    }}>
      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{isErr ? '⚠️' : '✅'}</span>
      <span style={{ fontSize: 12.5, color: isErr ? '#f87171' : '#34d399', flex: 1, lineHeight: 1.55, fontWeight: 500 }}>{msg}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isErr ? '#f87171' : '#34d399', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
      >×</button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function Login() {
  // ── state ──
  const [step,        setStep]        = useState('creds');  // 'creds' | 'forgot'
  const [form,        setForm]        = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showPass,    setShowPass]    = useState(false);
  const [remember,    setRemember]    = useState(false);
  const [focused,     setFocused]     = useState(null);
  const [toast2,      setToast2]      = useState({ msg: '', type: '' });
  const [onlineCount, setOnlineCount] = useState(247);
  const [forgotSent,  setForgotSent]  = useState(false);
  const [deactivMsg,  setDeactivMsg]  = useState('');

  // ── hooks ──
  const { login }             = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate              = useNavigate();
  const { t }                 = useTranslation();

  // live count flicker
  useEffect(() => {
    const id = setInterval(() => setOnlineCount(c => c + (Math.random() > 0.5 ? 1 : -1)), 3200);
    return () => clearInterval(id);
  }, []);

  // deactivation message
  useEffect(() => {
    const msg = sessionStorage.getItem('deactivation_message');
    if (msg) { setDeactivMsg(msg); sessionStorage.removeItem('deactivation_message'); }
  }, []);

  // ── palette — unified with the Edupla landing page ──
  const C = {
    bg:          dark ? '#080c18'                : '#f8faff',
    panel:       dark ? 'rgba(8,12,24,0.88)'      : 'rgba(255,255,255,0.9)',
    panelBorder: dark ? 'rgba(255,255,255,0.07)'  : 'rgba(99,102,241,0.12)',
    card:        dark ? 'rgba(10,13,26,0.94)'     : '#ffffff',
    cardBorder:  dark ? 'rgba(255,255,255,0.08)'  : 'rgba(99,102,241,0.14)',
    cardShadow:  dark ? '0 40px 100px rgba(0,0,0,0.65)' : '0 32px 80px rgba(99,102,241,0.16)',
    chip:        dark ? 'rgba(255,255,255,0.04)'  : 'rgba(255,255,255,0.92)',
    input:       dark ? 'rgba(255,255,255,0.05)'  : '#f8faff',
    inputBorder: dark ? 'rgba(255,255,255,0.1)'   : '#e1e7f7',
    inputFocus:  '#6366f1',
    text:        dark ? '#f1f5f9'                 : '#0f172a',
    text2:       dark ? '#8592b4'                 : '#475569',
    text3:       dark ? '#475173'                 : '#94a3b8',
    divider:     dark ? 'rgba(255,255,255,0.07)'  : '#e2e8f4',
    accent:      '#6366f1',
    accentDark:  '#4f46e5',
  };

  // ── handlers ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setToast2({ msg: t('auth.fillBothFields'), type: 'error' });
      return;
    }
    setLoading(true);
    setToast2({ msg: '', type: '' });
    try {
      // No role passed — backend determines user role from credentials
      const user = await login(form.email, form.password);
      toast.success(t('auth.loginSuccess', { name: user.name }));
      const dest = {
        teacher:    '/teacher/dashboard',
        admin:      '/admin/dashboard',
        superadmin: '/superadmin/dashboard',
        student:    '/student/dashboard',
      }[user.role] ?? '/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || t('auth.invalidCredentials');
      setToast2({ msg, type: 'error' });
    }
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setToast2({ msg: t('auth.enterEmail'), type: 'error' });
      return;
    }
    setLoading(true);
    try {
      // Replace with your real endpoint:
      // await api.post('/auth/forgot-password', { email: forgotEmail });
      await new Promise(r => setTimeout(r, 1200));
      setForgotSent(true);
      setToast2({ msg: '', type: '' });
    } catch {
      setToast2({ msg: t('auth.resetLinkFailed'), type: 'error' });
    }
    setLoading(false);
  };

  // ── input styles ──
  const inputStyle = (field) => ({
    width: '100%',
    padding: '12px 14px 12px 42px',
    ...(field === 'password' && { paddingRight: 44 }),
    borderRadius: 13,
    border: `1.5px solid ${focused === field ? C.inputFocus : C.inputBorder}`,
    background: C.input,
    color: C.text,
    fontSize: 13.5,
    fontFamily: "'Outfit', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
    boxShadow: focused === field ? `0 0 0 4px ${C.accent}1c, 0 6px 20px ${C.accent}22` : 'none',
    transform: focused === field ? 'translateY(-1px)' : 'translateY(0)',
  });

  const iconStyle = (field) => ({
    position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
    color: focused === field ? C.accent : C.text3,
    pointerEvents: 'none', transition: 'color 0.2s',
    display: 'flex',
  });

  /* ── render ── */
  return (
    <>
      <SEO
        title="Log In"
        description="Log in to your Edupla account to access your classes, assessments, and dashboard."
        path="/login"
        noindex
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ep-root {
          min-height: 100vh; width: 100%;
          display: flex; align-items: stretch;
          font-family: 'Outfit', sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative; overflow: hidden;
        }

        /* ── ambient mesh, mirrors the landing hero's atmosphere ── */
        .ep-mesh-a { animation: ep-mesh-drift-a 13s ease-in-out infinite; }
        .ep-mesh-b { animation: ep-mesh-drift-b 16s ease-in-out infinite; }
        .ep-grid-pattern { animation: ep-grid-drift 6s linear infinite; }

        .ep-left-panel {
          width: 43%; flex-shrink: 0;
          display: flex; flex-direction: column;
          padding: 34px 40px;
          position: relative; overflow: hidden;
          border-right: 1px solid;
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
        }

        .ep-right-panel {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 24px; position: relative; overflow: hidden;
        }

        /* Giant faded wordmark — lives at the root level so it bleeds
           across BOTH panels and can drift behind the login card itself,
           instead of being trapped inside the left panel only. */
        .ep-wordmark-ghost {
          position: absolute; bottom: -7%; left: 50%;
          transform: translateX(-50%);
          width: 100%;
          text-align: center;
          font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400;
          font-size: clamp(6rem, 15vw, 14rem);
          letter-spacing: -0.04em; line-height: 1; white-space: nowrap;
          pointer-events: none; user-select: none; z-index: 1;
          animation: ep-wordmark-drift 11s ease-in-out infinite;
        }

        .ep-card-wrap { position: relative; z-index: 1; }

        .ep-ring-spin {
          position: absolute; border-radius: 50%; pointer-events: none;
          animation: ep-ring-spin 40s linear infinite;
        }

        .ep-card {
          width: 100%; max-width: 428px;
          border-radius: 30px;
          backdrop-filter: blur(34px);
          -webkit-backdrop-filter: blur(34px);
          position: relative; z-index: 1;
          overflow: hidden;
          animation: ep-fadeup 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }

        .ep-accent-line {
          height: 2.5px;
          background: linear-gradient(90deg,#4f46e5,#7c3aed,#0ea5e9,#7c3aed,#4f46e5);
          background-size: 200% 100%;
          animation: ep-linepan 6s linear infinite;
        }

        .ep-step { padding: 26px 30px 22px; animation: ep-fadeup 0.4s cubic-bezier(0.22,1,0.36,1) both; }

        .ep-logo-badge {
          width: 42px; height: 42px; border-radius: 13px; flex-shrink: 0;
          background: linear-gradient(135deg,#4f46e5,#7c3aed);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 1px rgba(99,102,241,0.35), 0 8px 22px rgba(99,102,241,0.4);
          transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s;
        }
        .ep-logo-badge:hover { transform: rotate(-6deg) scale(1.06); box-shadow: 0 0 0 1px rgba(99,102,241,0.5), 0 12px 30px rgba(99,102,241,0.55); }

        .ep-submit {
          width: 100%; padding: 14px;
          border-radius: 15px; border: none;
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 45%, #7c3aed 100%);
          color: #fff; font-size: 14.5px; font-weight: 700;
          font-family: 'Outfit', sans-serif; letter-spacing: -0.01em; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 10px 28px rgba(99,102,241,0.42);
          transition: opacity 0.18s, transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s;
          position: relative; overflow: hidden;
        }
        .ep-submit::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.16) 0%, transparent 55%);
          pointer-events: none;
        }
        .ep-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(99,102,241,0.55); }
        .ep-submit:active:not(:disabled) { transform: translateY(0); }
        .ep-submit:disabled { opacity: 0.55; cursor: not-allowed; }
        .ep-submit:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

        .ep-back {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 11px; border-radius: 10px;
          background: none; border: none; cursor: pointer;
          font-family: 'Outfit', sans-serif; font-size: 12.5px; font-weight: 600;
          transition: background 0.2s, transform 0.2s;
        }
        .ep-back:hover { transform: translateX(-3px); }
        .ep-back:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }

        .ep-checkbox {
          width: 19px; height: 19px; border-radius: 6.5px;
          border: 1.5px solid; cursor: pointer; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }

        .ep-feat-chip {
          opacity: 0; animation: ep-chipin 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 13px;
          transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), background 0.2s, border-color 0.2s;
          cursor: default;
        }
        .ep-feat-chip:hover { transform: translateX(3px); }

        .ep-stat-card { transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), border-color 0.25s; }
        .ep-stat-card:hover { transform: translateY(-3px); }

        .ep-trust-chip { transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; }
        .ep-trust-chip:hover { transform: translateY(-2px); }

        .ep-theme-toggle { transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), background 0.2s; }
        .ep-theme-toggle:hover { transform: rotate(20deg) scale(1.08); }

        .ep-eye-btn { transition: transform 0.2s, color 0.2s; }
        .ep-eye-btn:hover { transform: translateY(-50%) scale(1.12); }

        @keyframes ep-fadeup {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ep-slideup {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ep-glowdot {
          0%,100% { opacity: 1; transform: scale(1); box-shadow: 0 0 8px #34d399; }
          50%      { opacity: 0.45; transform: scale(0.8); box-shadow: 0 0 2px #34d399; }
        }
        @keyframes ep-spin { to { transform: rotate(360deg); } }
        @keyframes ep-ring-spin { to { transform: rotate(360deg); } }
        @keyframes ep-shimmer { 0% { left: -60%; } 100% { left: 140%; } }
        @keyframes ep-mesh-drift-a { 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(24px,-18px) scale(1.1); } }
        @keyframes ep-mesh-drift-b { 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(-20px,16px) scale(1.08); } }
        @keyframes ep-grid-drift { 0%{ background-position:0 0; } 100%{ background-position:44px 44px; } }
        @keyframes ep-wordmark-drift { 0%,100%{ transform:translateX(-50%); } 50%{ transform:translateX(calc(-50% - 12px)); } }
        @keyframes ep-chipin { from{opacity:0;transform:translateX(-8px);} to{opacity:1;transform:translateX(0);} }
        @keyframes ep-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        .ep-spinner {
          width: 15px; height: 15px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: ep-spin 0.7s linear infinite;
        }

        .ep-shimmer {
          position: absolute; top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          animation: ep-shimmer 3.5s ease-in-out infinite;
          pointer-events: none;
        }

        .ep-badge-float { animation: ep-float 5s ease-in-out infinite; }
        .ep-badge-float2 { animation: ep-float 6s ease-in-out infinite 1s; }

        @media (prefers-reduced-motion: reduce) {
          .ep-mesh-a, .ep-mesh-b, .ep-grid-pattern, .ep-wordmark-ghost, .ep-ring-spin,
          .ep-card, .ep-accent-line, .ep-step, .ep-feat-chip, .ep-badge-float, .ep-badge-float2,
          .ep-shimmer, .ep-submit, .ep-logo-badge, .ep-theme-toggle {
            animation: none !important; transition: none !important;
          }
          .ep-feat-chip { opacity: 1 !important; }
        }

        @media (max-width: 860px) {
          .ep-left-panel { display: none !important; }
          .ep-right-panel { padding: 20px 16px; }
          .ep-wordmark-ghost { font-size: clamp(4.5rem, 22vw, 7rem); bottom: -5%; }
        }
        @media (max-width: 480px) {
          .ep-badge-float, .ep-badge-float2 { display: none !important; }
        }
      `}</style>

      <div className="ep-root" style={{ background: C.bg }}>
        <ParticleBg dark={dark} />

        {/* fixed ambient blobs, same family as the landing page */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div className="ep-mesh-a" style={{ position: 'absolute', top: '-14%', left: '4%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.16),transparent 70%)', filter: 'blur(95px)' }} />
          <div className="ep-mesh-b" style={{ position: 'absolute', bottom: '-16%', right: '2%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,0.13),transparent 70%)', filter: 'blur(85px)' }} />
        </div>

        {/* giant faded wordmark — root-level so it bleeds across the left
            panel AND drifts behind the login card on the right */}
        <div className="ep-wordmark-ghost" style={{ color: dark ? 'rgba(255,255,255,0.035)' : 'rgba(79,70,229,0.045)' }}>
          Edupla
        </div>

        {/* ════════════ LEFT PANEL ════════════ */}
        <div
          className="ep-left-panel"
          style={{ background: C.panel, borderColor: C.panelBorder, zIndex: 2 }}
        >
          {/* dot-grid texture, masked toward the middle */}
          <div className="ep-grid-pattern" style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle,${dark ? 'rgba(255,255,255,0.05)' : 'rgba(79,70,229,0.07)'} 1px, transparent 1px)`, backgroundSize: '22px 22px', opacity: 0.5, pointerEvents: 'none', maskImage: 'radial-gradient(ellipse 65% 55% at 50% 30%, black, transparent)', WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 30%, black, transparent)' }} />
          <div style={{ position: 'absolute', width: 280, height: 280, top: -60, right: -60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)', pointerEvents: 'none' }} />

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1, marginBottom: 8 }}>
            <BrandMark size={40} />
            <div>
              <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '0.04em', margin: 0 }}>EDUPLA</p>
              <p style={{ fontSize: 10, color: C.text3, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', margin: '1px 0 0' }}>{t('auth.educationPlatform')}</p>
            </div>
            {/* online pill */}
            <div style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600,
              color: '#34d399',
              background: dark ? 'rgba(52,211,153,0.1)' : 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(52,211,153,0.25)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'ep-glowdot 2s infinite' }} />
              {t('auth.onlineCount', { count: onlineCount })}
            </div>
          </div>

          {/* Hero content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '18px 0', position: 'relative', zIndex: 1 }}>
            {/* badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 100, marginBottom: 20, width: 'fit-content',
              background: dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)',
              border: '1px solid rgba(99,102,241,0.28)',
              fontSize: 11, fontWeight: 600, color: dark ? '#a78bfa' : '#4f46e5', letterSpacing: '0.04em',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', animation: 'ep-glowdot 2s infinite' }} />
              {t('auth.trustedByEducators')}
            </div>

            <h1 style={{ margin: '0 0 14px' }}>
              <span style={{ display: 'block', fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.02em', color: C.text, margin: '0 0 4px' }}>
                {t('auth.heroTitleLine1')}
              </span>
              <span style={{ display: 'block', fontFamily: "'Outfit',sans-serif", fontSize: 'clamp(1.9rem, 3.4vw, 2.7rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,#818cf8 0%,#a78bfa 50%,#38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {t('auth.heroTitleLine2')}
              </span>
            </h1>

            <p style={{ fontSize: 13.5, lineHeight: 1.75, color: C.text2, maxWidth: 320, margin: '0 0 20px' }}>
              {t('auth.heroSubtitle')}
            </p>

            {/* what unlocks the moment you sign in */}
            <p style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
              color: dark ? '#a5b4fc' : '#4f46e5', margin: '0 0 10px',
            }}>
              {t('auth.unlockedHeading', 'Unlocked the instant you sign in')}
            </p>

            {/* features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
              {FEATURES_KEYS.map((f, i) => (
                <div
                  key={f.labelKey}
                  className="ep-feat-chip"
                  style={{
                    animationDelay: (0.1 + i * 0.08) + 's',
                    background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.08)'}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + '45'; e.currentTarget.style.background = f.color + '0e'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.08)'; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)'; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: f.color + '18', border: '1px solid ' + f.color + '2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>{f.icon}</div>
                  <span style={{ fontSize: 12.5, color: C.text2, fontWeight: 500 }}>{t(f.labelKey)}</span>
                  <div style={{ marginLeft: 'auto', width: 17, height: 17, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* how your access is protected */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text3, margin: '0 0 8px' }}>
                {t('auth.accessInfo.heading', 'Every login is protected by')}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ACCESS_INFO.map(a => (
                  <div
                    key={a.textKey}
                    className="ep-trust-chip"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 12px', borderRadius: 100,
                      fontSize: 11, fontWeight: 600, color: C.text2,
                      background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)',
                      border: `1px solid ${a.color}2a`,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{a.icon}</span>
                    {t(a.textKey, a.default)}
                  </div>
                ))}
              </div>
            </div>

            {/* stats bar */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${C.divider}`,
              borderRadius: 17, overflow: 'hidden',
            }}>
              {STATS_KEYS.map((s, i) => (
                <div key={s.labelKey} className="ep-stat-card" style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 3, padding: '13px 4px',
                  borderRight: i < 3 ? `1px solid ${C.divider}` : 'none',
                }}>
                  <span style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontSize: 19, fontWeight: 400, color: C.text, letterSpacing: '-0.02em' }}>{s.valueKey}</span>
                  <span style={{ fontSize: 9.5, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t(s.labelKey)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ticker */}
          <div style={{ position: 'relative', zIndex: 1, marginBottom: 12 }}>
            <Ticker dark={dark} />
          </div>

          {/* testimonial */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: 15, borderRadius: 16, position: 'relative', zIndex: 1, overflow: 'hidden',
            background: dark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.04)',
            border: `1px solid ${dark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.14)'}`,
          }}>
            <div style={{ position: 'absolute', top: 8, right: 12, fontSize: 46, color: '#6366f1', opacity: 0.08, fontFamily: 'Georgia,serif', lineHeight: 1, userSelect: 'none' }}>"</div>
            <div style={{
              width: 35, height: 35, borderRadius: 11, flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 800, color: '#fff',
            }}>SK</div>
            <div>
              <p style={{ fontSize: 11.5, lineHeight: 1.68, color: C.text2, fontStyle: 'italic', margin: '0 0 5px' }}>
                "{t('auth.testimonialQuote')}"
              </p>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: dark ? '#a5b4fc' : '#4f46e5', margin: 0 }}>{t('auth.testimonialAuthor')}</p>
            </div>
          </div>
        </div>

        {/* ════════════ RIGHT PANEL ════════════ */}
        <div className="ep-right-panel" style={{ zIndex: 2 }}>
          {/* ambient orbs */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
            <div style={{ position: 'absolute', width: 420, height: 420, top: -130, right: -110, borderRadius: '50%', background: dark ? 'radial-gradient(circle,rgba(99,102,241,0.1),transparent 68%)' : 'radial-gradient(circle,rgba(79,70,229,0.06),transparent 68%)' }} />
            <div style={{ position: 'absolute', width: 300, height: 300, bottom: -110, left: -60, borderRadius: '50%', background: dark ? 'radial-gradient(circle,rgba(124,58,237,0.08),transparent 68%)' : 'radial-gradient(circle,rgba(124,58,237,0.05),transparent 68%)' }} />
          </div>

          <div className="ep-card-wrap" style={{ position: 'relative' }}>
            {/* rotating dashed ring behind the card */}
            <div className="ep-ring-spin" style={{ top: '50%', left: '50%', width: 560, height: 560, transform: 'translate(-50%,-50%)', border: `1px dashed ${dark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.1)'}` }} />

            {/* floating access badges — anchored just outside the card's
                top/bottom edges so they never sit on top of the header,
                inputs, or footer */}
            <div className="ep-badge-float" style={{ position: 'absolute', top: -16, right: 20, zIndex: 2, padding: '8px 13px', borderRadius: 12, background: dark ? 'rgba(16,185,129,0.12)' : '#dcfce7', border: '1px solid rgba(16,185,129,0.3)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 8px 24px rgba(16,185,129,0.18)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>{t('auth.trustStrip.accessGranted', 'Access Granted Instantly')}</span>
            </div>
            <div className="ep-badge-float2" style={{ position: 'absolute', bottom: -16, left: 20, zIndex: 2, padding: '8px 13px', borderRadius: 12, background: dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 8px 24px rgba(99,102,241,0.15)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: dark ? '#818cf8' : '#4f46e5', whiteSpace: 'nowrap' }}>{t('auth.trustStrip.systemAccess', '24/7 System Access')}</span>
            </div>

            {/* ── card ── */}
            <div className="ep-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
              <div className="ep-accent-line" />

              {/* card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 30px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div className="ep-logo-badge">
                    <BrandMark size={22} variant="mark" mono />
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: '0.04em', margin: 0 }}>EDUPLA</p>
                    <p style={{ fontSize: 9.5, color: C.text3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '1px 0 0' }}>{t('auth.securePortal')}</p>
                  </div>
                </div>
                {/* theme toggle */}
                <button
                  onClick={toggleTheme}
                  className="ep-theme-toggle"
                  style={{
                    width: 33, height: 33, borderRadius: 10, flexShrink: 0,
                    background: dark ? 'rgba(255,255,255,0.06)' : '#f5f7ff',
                    border: `1px solid ${C.cardBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title={dark ? t('auth.lightMode') : t('auth.darkMode')}
                  aria-label={t('auth.toggleTheme')}
                >
                  {dark
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  }
                </button>
              </div>

              {/* ── STEP: CREDENTIALS ── */}
              {step === 'creds' && (
                <div className="ep-step">
                  <p style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontWeight: 400, fontSize: 27, color: C.text, letterSpacing: '-0.02em', margin: '0 0 5px' }}>
                    {t('auth.welcomeBack')}
                  </p>
                  <p style={{ fontSize: 12.5, color: C.text2, margin: '0 0 20px' }}>
                    {t('auth.signInSubtitle')}
                  </p>

                  {deactivMsg && (
                    <InlineToast msg={t('auth.accountDeactivated', { reason: deactivMsg })} type="error" onClose={() => setDeactivMsg('')} />
                  )}
                  <InlineToast msg={toast2.msg} type={toast2.type} onClose={() => setToast2({ msg: '', type: '' })} />

                  <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    {/* email */}
                    <div>
                      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase', marginBottom: 7 }}>
                        {t('auth.emailAddress')}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={iconStyle('email')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
                        </span>
                        <input
                          type="email"
                          value={form.email}
                          required
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          onFocus={() => setFocused('email')}
                          onBlur={() => setFocused(null)}
                          placeholder={t('auth.emailPlaceholder')}
                          autoComplete="email"
                          style={inputStyle('email')}
                          aria-label={t('auth.emailAddress')}
                        />
                      </div>
                    </div>

                    {/* password */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                        <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase' }}>{t('common.password')}</label>
                        <button
                          type="button"
                          onClick={() => { setStep('forgot'); setForgotEmail(form.email); setForgotSent(false); setToast2({ msg: '', type: '' }); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: dark ? '#a5b4fc' : '#4f46e5', fontWeight: 600, fontFamily: "'Outfit',sans-serif" }}
                        >
                          {t('auth.forgotPassword')}
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={iconStyle('password')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </span>
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={form.password}
                          required
                          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                          onFocus={() => setFocused('password')}
                          onBlur={() => setFocused(null)}
                          placeholder={t('auth.passwordPlaceholder')}
                          autoComplete="current-password"
                          style={{ ...inputStyle('password'), paddingRight: 44 }}
                          aria-label={t('common.password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(s => !s)}
                          className="ep-eye-btn"
                          aria-label={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, display: 'flex', padding: 3 }}
                        >
                          {showPass
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          }
                        </button>
                      </div>
                    </div>

                    {/* submit */}
                    <button type="submit" disabled={loading} className="ep-submit">
                      <div className="ep-shimmer" />
                      {loading
                        ? <><div className="ep-spinner" />{t('auth.signingIn')}</>
                        : <>{t('auth.signIn')} <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
                      }
                    </button>
                  </form>

                 
                </div>
              )}

              {/* ── STEP: FORGOT PASSWORD ── */}
              {step === 'forgot' && (
                <div className="ep-step">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <button
                      className="ep-back"
                      onClick={() => { setStep('creds'); setForgotSent(false); setToast2({ msg: '', type: '' }); }}
                      style={{ color: C.text2, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.06)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      {t('auth.backToSignIn')}
                    </button>
                  </div>

                  {/* icon */}
                  <div style={{
                    width: 54, height: 54, borderRadius: 17, marginBottom: 18,
                    background: dark ? 'rgba(99,102,241,0.15)' : '#eef2ff',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      <circle cx="12" cy="16" r="1" fill="#6366f1"/>
                    </svg>
                  </div>

                  <p style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic', fontWeight: 400, fontSize: 27, color: C.text, letterSpacing: '-0.02em', margin: '0 0 5px' }}>{t('auth.resetPassword')}</p>
                  <p style={{ fontSize: 12.5, color: C.text2, margin: '0 0 22px', lineHeight: 1.6 }}>
                    {t('auth.resetPasswordSubtitle')}
                  </p>

                  <InlineToast msg={toast2.msg} type={toast2.type} onClose={() => setToast2({ msg: '', type: '' })} />

                  {forgotSent ? (
                    <div style={{
                      textAlign: 'center', padding: '26px 14px',
                      background: dark ? 'rgba(52,211,153,0.08)' : '#f0fdf4',
                      border: '1.5px solid rgba(52,211,153,0.25)',
                      borderRadius: 16,
                      animation: 'ep-fadeup 0.4s cubic-bezier(0.22,1,0.36,1)',
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>✉️</div>
                      <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 700, color: '#34d399', margin: '0 0 6px' }}>{t('auth.checkYourInbox')}</p>
                      <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, margin: 0 }}>
                        {t('auth.resetLinkSentPrefix')} <strong style={{ color: C.text }}>{forgotEmail}</strong>{t('auth.resetLinkSentSuffix')}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleForgot} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase', marginBottom: 7 }}>
                          {t('auth.emailAddress')}
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={iconStyle('forgot-email')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
                          </span>
                          <input
                            type="email"
                            value={forgotEmail}
                            required
                            onChange={e => setForgotEmail(e.target.value)}
                            onFocus={() => setFocused('forgot-email')}
                            onBlur={() => setFocused(null)}
                            placeholder={t('auth.emailPlaceholderSchool')}
                            autoComplete="email"
                            style={inputStyle('forgot-email')}
                            aria-label={t('auth.emailAddress')}
                          />
                        </div>
                      </div>
                      <button type="submit" disabled={loading} className="ep-submit">
                        <div className="ep-shimmer" />
                        {loading
                          ? <><div className="ep-spinner" />{t('auth.sending')}</>
                          : <>{t('auth.sendResetLink')} <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
                        }
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* card footer */}
              <p style={{ fontSize: 10.5, textAlign: 'center', color: C.text3, paddingBottom: 18, margin: 0 }}>
                {t('auth.footerRights', { year: new Date().getFullYear() })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}