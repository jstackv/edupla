import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STATS = [
  { value: '2.4K', label: 'Students' },
  { value: '180',  label: 'Courses'  },
  { value: '96%',  label: 'Pass rate' },
  { value: '120',  label: 'Teachers' },
];

const FEATURES = [
  { label: 'Smart classrooms', icon: '📚' },
  { label: 'Live analytics',   icon: '📊' },
  { label: 'Instant feedback', icon: '⚡' },
  { label: 'Team spaces',      icon: '🤝' },
];

const ACTIVITY = [
  'Sarah K. submitted Chemistry assignment',
  'Mr. Osei published new Mathematics quiz',
  'Class 10B results are ready to view',
  'James M. achieved 100% on Physics test',
  'New course: Advanced Biology added',
  'Term report cards are now available',
];

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
  const [idx,  setIdx]  = useState(0);
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => { setIdx(i => (i + 1) % ACTIVITY.length); setShow(true); }, 300);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 13px', borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
      overflow: 'hidden',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: '#10b981',
        flexShrink: 0, animation: 'ep-pulse 2s infinite',
      }} />
      <span style={{
        fontSize: 11.5, color: dark ? '#9ca3af' : '#6b7280',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        opacity: show ? 1 : 0, transition: 'opacity 0.28s',
      }}>
        {ACTIVITY[idx]}
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
      padding: '11px 14px', borderRadius: 12, marginBottom: 14,
      background: isErr ? '#fef2f2' : '#f0fdf4',
      border: `1.5px solid ${isErr ? '#fca5a5' : '#86efac'}`,
      animation: 'ep-slideup 0.25s ease',
    }}>
      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{isErr ? '⚠️' : '✅'}</span>
      <span style={{ fontSize: 12.5, color: isErr ? '#b91c1c' : '#166534', flex: 1, lineHeight: 1.55 }}>{msg}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isErr ? '#b91c1c' : '#166534', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
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

  // ── palette ──
  const C = {
    bg:          dark ? '#080b1a'               : '#f4f6ff',
    panel:       dark ? 'rgba(12,16,36,0.92)'   : 'rgba(255,255,255,0.94)',
    panelBorder: dark ? 'rgba(255,255,255,0.07)': 'rgba(79,70,229,0.1)',
    card:        dark ? 'rgba(12,16,36,0.92)'   : '#ffffff',
    cardBorder:  dark ? 'rgba(255,255,255,0.07)': 'rgba(79,70,229,0.12)',
    cardShadow:  dark ? '0 32px 80px rgba(0,0,0,0.6)' : '0 24px 60px rgba(79,70,229,0.14)',
    input:       dark ? 'rgba(255,255,255,0.06)': '#f5f7ff',
    inputBorder: dark ? 'rgba(255,255,255,0.1)' : '#dde5f5',
    inputFocus:  '#6366f1',
    text:        dark ? '#f0f4ff'               : '#0f172a',
    text2:       dark ? '#7480a8'               : '#475569',
    text3:       dark ? '#3a4060'               : '#94a3b8',
    divider:     dark ? 'rgba(255,255,255,0.07)': '#e2e8f4',
    rowHover:    dark ? 'rgba(255,255,255,0.04)': 'rgba(0,0,0,0.02)',
    accent:      '#6366f1',
    accentDark:  '#4f46e5',
  };

  // ── handlers ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setToast2({ msg: 'Please fill in both fields.', type: 'error' });
      return;
    }
    setLoading(true);
    setToast2({ msg: '', type: '' });
    try {
      // No role passed — backend determines user role from credentials
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      const dest = {
        teacher:    '/teacher/dashboard',
        admin:      '/admin/dashboard',
        superadmin: '/superadmin/dashboard',
        student:    '/student/dashboard',
      }[user.role] ?? '/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid email or password.';
      setToast2({ msg, type: 'error' });
    }
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setToast2({ msg: 'Please enter your email address.', type: 'error' });
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
      setToast2({ msg: 'Could not send reset link. Try again.', type: 'error' });
    }
    setLoading(false);
  };

  // ── input styles ──
  const inputStyle = (field) => ({
    width: '100%',
    padding: '11px 14px 11px 40px',
    ...(field === 'password' && { paddingRight: 42 }),
    borderRadius: 12,
    border: `1.5px solid ${focused === field ? C.inputFocus : C.inputBorder}`,
    background: C.input,
    color: C.text,
    fontSize: 13.5,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.18s, box-shadow 0.18s',
    boxShadow: focused === field ? `0 0 0 3px ${C.accent}22` : 'none',
  });

  const iconStyle = (field) => ({
    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
    color: focused === field ? C.accent : C.text3,
    pointerEvents: 'none', transition: 'color 0.18s',
    display: 'flex',
  });

  /* ── render ── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ep-root {
          min-height: 100vh; width: 100%;
          display: flex; align-items: stretch;
          font-family: 'DM Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative; overflow: hidden;
        }

        .ep-left-panel {
          width: 42%; flex-shrink: 0;
          display: flex; flex-direction: column;
          padding: 32px 36px;
          position: relative; overflow: hidden;
          border-right: 1px solid;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }

        .ep-right-panel {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 24px; position: relative; overflow: hidden;
        }

        .ep-card {
          width: 100%; max-width: 420px;
          border-radius: 28px;
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          position: relative; z-index: 1;
          overflow: hidden;
          animation: ep-slideup 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }

        .ep-step { padding: 28px 28px 20px; animation: ep-slideup 0.36s cubic-bezier(0.22,1,0.36,1) both; }

        .ep-submit {
          width: 100%; padding: 13px;
          border-radius: 14px; border: none;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%);
          color: #fff; font-size: 14.5px; font-weight: 700;
          font-family: 'Sora', sans-serif; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 6px 24px rgba(99,102,241,0.45);
          transition: opacity 0.18s, transform 0.15s, box-shadow 0.18s;
          position: relative; overflow: hidden;
        }
        .ep-submit::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.14) 0%, transparent 55%);
          pointer-events: none;
        }
        .ep-submit:hover:not(:disabled) { opacity: 0.91; transform: translateY(-1px); box-shadow: 0 10px 32px rgba(99,102,241,0.55); }
        .ep-submit:active:not(:disabled) { transform: translateY(0); }
        .ep-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .ep-submit:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

        .ep-back {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 9px;
          background: none; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 500;
          transition: background 0.15s, transform 0.15s;
        }
        .ep-back:hover { transform: translateX(-2px); }
        .ep-back:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }

        .ep-checkbox {
          width: 18px; height: 18px; border-radius: 6px;
          border: 1.5px solid; cursor: pointer; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.18s;
        }

        .ep-feat-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 11px;
          transition: background 0.15s;
        }
        .ep-feat-row:hover { background: rgba(255,255,255,0.04); }

        @keyframes ep-slideup {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ep-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.3; transform: scale(0.75); }
        }
        @keyframes ep-spin { to { transform: rotate(360deg); } }
        @keyframes ep-ring { 0%,100% { opacity: 0.4; } 50% { opacity: 0.9; } }
        @keyframes ep-shimmer { 0% { left: -60%; } 100% { left: 140%; } }

        .ep-spinner {
          width: 15px; height: 15px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: ep-spin 0.7s linear infinite;
        }

        .ep-shimmer {
          position: absolute; top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: ep-shimmer 3.5s ease-in-out infinite;
          pointer-events: none;
        }

        .ep-geo {
          position: absolute; border-radius: 50%; pointer-events: none;
          animation: ep-ring 8s ease-in-out infinite;
        }

        @media (max-width: 860px) {
          .ep-left-panel { display: none !important; }
          .ep-right-panel { padding: 20px 16px; }
        }
      `}</style>

      <div className="ep-root" style={{ background: C.bg }}>
        <ParticleBg dark={dark} />

        {/* ════════════ LEFT PANEL ════════════ */}
        <div
          className="ep-left-panel"
          style={{ background: C.panel, borderColor: C.panelBorder }}
        >
          {/* decorative rings */}
          {[
            { s: 360, t: -120, r: -120, delay: '0s'   },
            { s: 200, t: -40,  r: -40,  delay: '2.5s' },
            { s: 520, b: -220, l: -130, delay: '5s'   },
          ].map((r, i) => (
            <div key={i} className="ep-geo" style={{
              width: r.s, height: r.s,
              top: r.t, right: r.r, bottom: r.b, left: r.l,
              border: `1px solid ${dark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.1)'}`,
              animationDelay: r.delay,
            }} />
          ))}
          <div style={{ position: 'absolute', width: 280, height: 280, top: -60, right: -60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1), transparent 70%)', pointerEvents: 'none' }} />

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 6px 20px rgba(99,102,241,0.4)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '0.05em', margin: 0 }}>EDUPLA</p>
              <p style={{ fontSize: 10.5, color: C.text3, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', margin: '1px 0 0' }}>Education Platform</p>
            </div>
            {/* online pill */}
            <div style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 11px', borderRadius: 100, fontSize: 11, fontWeight: 600,
              color: '#10b981',
              background: dark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'ep-pulse 2s infinite' }} />
              {onlineCount} online
            </div>
          </div>

          {/* Hero content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 0', position: 'relative', zIndex: 1 }}>
            {/* badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '5px 13px', borderRadius: 100, marginBottom: 18, width: 'fit-content',
              background: dark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)',
              border: '1px solid rgba(99,102,241,0.25)',
              fontSize: 10.5, fontWeight: 600, color: '#818cf8', letterSpacing: '0.05em',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'ep-pulse 2s infinite' }} />
              Trusted by 120+ educators
            </div>

            <h1 style={{
              fontFamily: "'Sora',sans-serif",
              fontSize: 'clamp(22px, 2.8vw, 34px)',
              fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.035em',
              color: C.text, margin: '0 0 12px',
            }}>
              Where Learning<br />
              <span style={{ background: 'linear-gradient(135deg,#818cf8,#a78bfa,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Meets Innovation
              </span>
            </h1>

            <p style={{ fontSize: 13, lineHeight: 1.72, color: C.text2, maxWidth: 300, margin: '0 0 22px' }}>
              A unified school platform empowering teachers, energizing students, and giving admins total clarity.
            </p>

            {/* features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 22 }}>
              {FEATURES.map(f => (
                <div key={f.label} className="ep-feat-row">
                  <span style={{ fontSize: 17 }}>{f.icon}</span>
                  <span style={{ fontSize: 12.5, color: C.text2, fontWeight: 500 }}>{f.label}</span>
                  <div style={{ marginLeft: 'auto', width: 17, height: 17, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* stats bar */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              background: dark ? 'rgba(255,255,255,0.04)' : '#f5f7ff',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#e2e8f4'}`,
              borderRadius: 16, overflow: 'hidden',
            }}>
              {STATS.map((s, i) => (
                <div key={s.label} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 3, padding: '12px 4px',
                  borderRight: i < 3 ? `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#e2e8f4'}` : 'none',
                }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>{s.value}</span>
                  <span style={{ fontSize: 9.5, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</span>
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
            display: 'flex', alignItems: 'flex-start', gap: 11,
            padding: 14, borderRadius: 14, position: 'relative', zIndex: 1,
            background: dark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.04)',
            border: `1px solid ${dark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.14)'}`,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, color: '#fff',
            }}>SK</div>
            <div>
              <p style={{ fontSize: 11.5, lineHeight: 1.68, color: C.text2, fontStyle: 'italic', margin: '0 0 5px' }}>
                "EDUPLA transformed how we run our school — all in one place."
              </p>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#818cf8', margin: 0 }}>Sarah Kim · Principal, Westbridge Academy</p>
            </div>
          </div>
        </div>

        {/* ════════════ RIGHT PANEL ════════════ */}
        <div className="ep-right-panel">
          {/* ambient orbs */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
            <div style={{ position: 'absolute', width: 420, height: 420, top: -130, right: -110, borderRadius: '50%', background: dark ? 'radial-gradient(circle,rgba(99,102,241,0.1),transparent 68%)' : 'radial-gradient(circle,rgba(79,70,229,0.06),transparent 68%)' }} />
            <div style={{ position: 'absolute', width: 300, height: 300, bottom: -110, left: -60, borderRadius: '50%', background: dark ? 'radial-gradient(circle,rgba(124,58,237,0.08),transparent 68%)' : 'radial-gradient(circle,rgba(124,58,237,0.05),transparent 68%)' }} />
          </div>

          {/* ── card ── */}
          <div className="ep-card" style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
            {/* gradient top line */}
            <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,#6366f1,#7c3aed,#06b6d4,transparent)' }} />

            {/* card header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 3px 12px rgba(99,102,241,0.45)',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: '0.04em', margin: 0 }}>EDUPLA</p>
                  <p style={{ fontSize: 9.5, color: C.text3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '1px 0 0' }}>Secure Portal</p>
                </div>
              </div>
              {/* theme toggle */}
              <button
                onClick={toggleTheme}
                style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: dark ? 'rgba(255,255,255,0.06)' : '#f5f7ff',
                  border: `1px solid ${C.cardBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                title={dark ? 'Light mode' : 'Dark mode'}
                aria-label="Toggle theme"
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
                <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 21, fontWeight: 800, color: C.text, letterSpacing: '-0.025em', margin: '0 0 4px' }}>
                  Welcome back
                </p>
                <p style={{ fontSize: 12.5, color: C.text2, margin: '0 0 18px' }}>
                  Sign in to your EDUPLA account.
                </p>

                {deactivMsg && (
                  <InlineToast msg={`Account deactivated: ${deactivMsg}`} type="error" onClose={() => setDeactivMsg('')} />
                )}
                <InlineToast msg={toast2.msg} type={toast2.type} onClose={() => setToast2({ msg: '', type: '' })} />

                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* email */}
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase', marginBottom: 7 }}>
                      Email address
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
                        placeholder="Email address"
                        autoComplete="email"
                        style={inputStyle('email')}
                        aria-label="Email address"
                      />
                    </div>
                  </div>

                  {/* password */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase' }}>Password</label>
                      <button
                        type="button"
                        onClick={() => { setStep('forgot'); setForgotEmail(form.email); setForgotSent(false); setToast2({ msg: '', type: '' }); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, color: '#818cf8', fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}
                      >
                        Forgot password?
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
                        placeholder="Edupla password"
                        autoComplete="current-password"
                        style={{ ...inputStyle('password'), paddingRight: 42 }}
                        aria-label="Password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(s => !s)}
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, display: 'flex', padding: 3 }}
                      >
                        {showPass
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>

                  </div>

                  {/* remember + ssl */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 0', borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}`,
                  }}>
                    <div
                      role="checkbox"
                      aria-checked={remember}
                      tabIndex={0}
                      className="ep-checkbox"
                      onClick={() => setRemember(r => !r)}
                      onKeyDown={e => e.key === ' ' && setRemember(r => !r)}
                      style={{
                        borderColor: remember ? '#6366f1' : C.inputBorder,
                        background: remember ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : C.input,
                      }}
                    >
                      {remember && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span onClick={() => setRemember(r => !r)} style={{ fontSize: 12.5, color: C.text2, cursor: 'pointer', userSelect: 'none' }}>
                      Stay signed in for 30 days
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>SSL secured</span>
                    </div>
                  </div>

                  {/* submit */}
                  <button type="submit" disabled={loading} className="ep-submit">
                    <div className="ep-shimmer" />
                    {loading
                      ? <><div className="ep-spinner" />Signing in…</>
                      : <>Sign in <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
                    }
                  </button>
                </form>

                {/* trust strip */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 14, borderTop: `1px solid ${C.divider}`, marginTop: 2 }}>
                  {[
                    { icon: '🔒', label: '256-bit SSL' },
                    { icon: '⏱',  label: 'Auto logout'  },
                    { icon: '🏅', label: 'ISO 27001'    },
                  ].map(t => (
                    <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: C.text3 }}>
                      <span>{t.icon}</span>{t.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP: FORGOT PASSWORD ── */}
            {step === 'forgot' && (
              <div className="ep-step">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <button
                    className="ep-back"
                    onClick={() => { setStep('creds'); setForgotSent(false); setToast2({ msg: '', type: '' }); }}
                    style={{ color: C.text2, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    Back to sign in
                  </button>
                </div>

                {/* icon */}
                <div style={{
                  width: 52, height: 52, borderRadius: 16, marginBottom: 16,
                  background: dark ? 'rgba(99,102,241,0.15)' : '#eef2ff',
                  border: '1px solid rgba(99,102,241,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    <circle cx="12" cy="16" r="1" fill="#6366f1"/>
                  </svg>
                </div>

                <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 21, fontWeight: 800, color: C.text, letterSpacing: '-0.025em', margin: '0 0 4px' }}>Reset password</p>
                <p style={{ fontSize: 12.5, color: C.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
                  Enter your school email address and we'll send you a reset link.
                </p>

                <InlineToast msg={toast2.msg} type={toast2.type} onClose={() => setToast2({ msg: '', type: '' })} />

                {forgotSent ? (
                  <div style={{
                    textAlign: 'center', padding: '24px 12px',
                    background: dark ? 'rgba(16,185,129,0.08)' : '#f0fdf4',
                    border: '1.5px solid rgba(16,185,129,0.25)',
                    borderRadius: 14,
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>✉️</div>
                    <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: '#10b981', margin: '0 0 6px' }}>Check your inbox</p>
                    <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, margin: 0 }}>
                      A reset link was sent to <strong style={{ color: C.text }}>{forgotEmail}</strong>. It expires in 60 minutes.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase', marginBottom: 7 }}>
                        Email address
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
                          placeholder="you@school.edu"
                          autoComplete="email"
                          style={inputStyle('forgot-email')}
                          aria-label="Email address for password reset"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={loading} className="ep-submit">
                      <div className="ep-shimmer" />
                      {loading
                        ? <><div className="ep-spinner" />Sending…</>
                        : <>Send reset link <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
                      }
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* card footer */}
            <p style={{ fontSize: 10.5, textAlign: 'center', color: C.text3, paddingBottom: 16, margin: 0 }}>
              © {new Date().getFullYear()} EDUPLA · All rights reserved
            </p>
          </div>
        </div>
      </div>
    </>
  );
}