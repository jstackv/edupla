import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import {
  GraduationCap, Mail, Lock, Eye, EyeOff, Sun, Moon,
  ArrowRight, BookOpen, Users, BarChart2, Zap,
  CheckCircle, Shield, TrendingUp,
} from 'lucide-react';

/* ─── static data ─── */
const STATS = [
  { label: 'Students', value: '2.4K' },
  { label: 'Courses',  value: '180'  },
  { label: 'Teachers', value: '120'  },
  { label: 'Pass Rate',value: '96%'  },
];

const FEATURES = [
  { icon: BookOpen,  label: 'Smart Classrooms',    color: '#818cf8' },
  { icon: BarChart2, label: 'Live Analytics',      color: '#06b6d4' },
  { icon: Users,     label: 'Team Collaboration',  color: '#a78bfa' },
  { icon: Zap,       label: 'Instant Feedback',    color: '#10b981' },
];

/* ─── helpers ─── */
const T = {
  dark: {
    page:        'linear-gradient(135deg, #060a12 0%, #0b0f1e 50%, #060c18 100%)',
    leftBg:      '#0d1120',
    leftBorder:  '#1c2440',
    rightBg:     'transparent',
    card:        '#111827',
    cardBorder:  '#1c2440',
    inputBg:     '#0a0e1a',
    inputBorder: '#1e2640',
    text:        '#e2e8f8',
    text2:       '#6b7a9e',
    text3:       '#3a4566',
    geo:         '#1c2440',
    statBg:      '#0e1422',
    statBorder:  '#1c2440',
    testiBg:     'rgba(91,110,245,0.07)',
    testiBorder: 'rgba(91,110,245,0.18)',
    chipBg:      '#0a0e1a',
    chipBorder:  '#1e2640',
    divLine:     '#1c2440',
  },
  light: {
    page:        'linear-gradient(135deg, #eef2ff 0%, #f0f4ff 50%, #f5f0ff 100%)',
    leftBg:      '#ffffff',
    leftBorder:  '#e2e8f4',
    rightBg:     'transparent',
    card:        '#ffffff',
    cardBorder:  '#dde5f5',
    inputBg:     '#f5f7ff',
    inputBorder: '#dde5f5',
    text:        '#0f172a',
    text2:       '#475569',
    text3:       '#94a3b8',
    geo:         '#e8edf8',
    statBg:      '#f5f7ff',
    statBorder:  '#dde5f5',
    testiBg:     'rgba(91,110,245,0.05)',
    testiBorder: 'rgba(91,110,245,0.15)',
    chipBg:      '#f5f7ff',
    chipBorder:  '#dde5f5',
    divLine:     '#e2e8f4',
  },
};

export default function Login() {
  const [form, setForm]           = useState({ email: '', password: '' });
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [activeRole, setActiveRole] = useState(null);
  const [focused, setFocused]     = useState(null);

  const { login }          = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate           = useNavigate();
  const t                  = dark ? T.dark : T.light;

  /* login */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      const dest = user.role === 'teacher' ? '/teacher/dashboard'
        : user.role === 'admin'   ? '/admin/dashboard'
        : '/student/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
    }
    setLoading(false);
  };

  /* demo role fill */
  const fillDemo = (r) => {
    if (activeRole === r.role) { setActiveRole(null); return; }
    setActiveRole(r.role);
    setForm({ email: r.email, password: r.password });
  };

  /* ── shared input style ── */
  const inputStyle = (field) => ({
    width: '100%',
    padding: field === 'password' ? '12px 44px 12px 42px' : '12px 14px 12px 42px',
    borderRadius: 10,
    border: `1.5px solid ${focused === field ? '#5b6ef5' : t.inputBorder}`,
    background: t.inputBg,
    color: t.text,
    fontSize: 13.5,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focused === field ? '0 0 0 3px rgba(91,110,245,0.12)' : 'none',
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .edupla-login-page {
          height: 100vh;
          overflow: hidden;
          display: flex;
        }

        /* left panel */
        .login-left {
          width: 42%;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 28px 32px;
          position: relative;
          overflow: hidden;
        }

        /* decorative rings */
        .geo-ring {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        /* right panel */
        .login-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
        }

        /* feature item hover */
        .feat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          transition: transform 0.15s;
        }
        .feat-item:hover { transform: translateX(3px); }

        /* role chip */
        .role-chip {
          padding: 10px 6px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: all 0.18s;
        }
        .role-chip:hover { transform: translateY(-1px); }

        /* submit btn */
        .login-submit {
          width: 100%;
          padding: 13px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #5b6ef5 0%, #7c3aed 60%, #06b6d4 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Sora', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          letter-spacing: -0.01em;
          margin-top: 6px;
          box-shadow: 0 4px 20px rgba(91,110,245,0.35);
          transition: opacity 0.2s, transform 0.2s;
        }
        .login-submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .login-submit:active { transform: translateY(0); }
        .login-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        /* spin */
        @keyframes lspin { to { transform: rotate(360deg); } }
        .lspin { animation: lspin 0.7s linear infinite; }

        /* badge pulse */
        @keyframes lpulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }

        /* input icon color on focus */
        .inp-icon-email  { color: ${focused === 'email'    ? '#818cf8' : t.text3}; transition: color 0.2s; }
        .inp-icon-password { color: ${focused === 'password' ? '#818cf8' : t.text3}; transition: color 0.2s; }

        @media (max-width: 900px) {
          .login-left { display: none !important; }
          .login-right { padding: 28px 20px; }
        }
      `}</style>

      <div
        className="edupla-login-page"
        style={{ background: t.page, fontFamily: "'DM Sans', sans-serif" }}
      >

        {/* ═══════════════ LEFT PANEL ═══════════════ */}
        <div
          className="login-left"
          style={{ background: t.leftBg, borderRight: `1px solid ${t.leftBorder}` }}
        >
          {/* Geometric rings */}
          <div className="geo-ring" style={{ width: 320, height: 320, top: -80, right: -80, border: `1px solid ${t.geo}` }} />
          <div className="geo-ring" style={{ width: 200, height: 200, top: -30, right: -30, border: `1px solid ${t.geo}` }} />
          <div className="geo-ring" style={{ width: 480, height: 480, bottom: -200, left: -120, border: `1px solid ${t.geo}` }} />

          {/* Accent glow */}
          <div style={{ position: 'absolute', width: 200, height: 200, top: -50, right: -50, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,110,245,0.15), transparent 70%)', pointerEvents: 'none' }} />

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              background: 'linear-gradient(135deg,#5b6ef5,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 1px rgba(91,110,245,0.4), 0 4px 16px rgba(91,110,245,0.3)',
            }}>
              <GraduationCap size={18} color="#fff" />
            </div>
            <div>
              <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: t.text, letterSpacing: '0.04em', margin: 0 }}>EDUPLA</p>
              <p style={{ fontSize: 10, color: t.text3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '1px 0 0' }}>Education Platform</p>
            </div>
          </div>

          {/* Hero */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 0', position: 'relative', zIndex: 1 }}>

            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 100,
              background: dark ? 'rgba(91,110,245,0.12)' : 'rgba(91,110,245,0.07)',
              border: '1px solid rgba(91,110,245,0.25)',
              fontSize: 10.5, fontWeight: 600, color: '#818cf8',
              letterSpacing: '0.05em', marginBottom: 18, width: 'fit-content',
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'lpulse 2s infinite', flexShrink: 0 }} />
              Trusted by 120+ educators
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily: "'Sora',sans-serif",
              fontSize: 'clamp(22px, 2.8vw, 30px)',
              fontWeight: 800, lineHeight: 1.12,
              letterSpacing: '-0.03em', color: t.text,
              margin: '0 0 12px',
            }}>
              Where Learning<br />
              <span style={{
                background: 'linear-gradient(135deg,#818cf8,#a78bfa,#06b6d4)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                Meets Innovation
              </span>
            </h1>

            <p style={{ fontSize: 13, lineHeight: 1.7, color: t.text2, maxWidth: 290, margin: '0 0 22px' }}>
              A unified school platform that empowers teachers, energizes students, and gives administrators total clarity.
            </p>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
              {FEATURES.map(({ icon: Icon, label, color }) => (
                <div key={label} className="feat-item">
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: t.statBg, border: `1px solid ${t.statBorder}`,
                  }}>
                    <Icon size={13} color={color} />
                  </div>
                  <span style={{ fontSize: 12.5, color: t.text2, fontWeight: 500 }}>{label}</span>
                  <div style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle size={9} color="#10b981" />
                  </div>
                </div>
              ))}
            </div>

            {/* Stats strip */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
              background: t.statBg, border: `1px solid ${t.statBorder}`,
              borderRadius: 14, padding: '14px 8px', position: 'relative', zIndex: 1,
            }}>
              {STATS.map(({ label, value }, i) => (
                <div key={label} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '0 4px',
                  borderRight: i < 3 ? `1px solid ${t.statBorder}` : 'none',
                }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.03em' }}>{value}</span>
                  <span style={{ fontSize: 9.5, color: t.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: 14, borderRadius: 12,
            background: t.testiBg, border: `1px solid ${t.testiBorder}`,
            position: 'relative', zIndex: 1,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg,#5b6ef5,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, color: '#fff',
            }}>SK</div>
            <div>
              <p style={{ fontSize: 11.5, lineHeight: 1.6, color: t.text2, fontStyle: 'italic', margin: '0 0 4px' }}>
                "EDUPLA transformed how we run our school — all in one place."
              </p>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#818cf8', margin: 0 }}>Sarah Kim · Principal, Westbridge Academy</p>
            </div>
          </div>
        </div>

        {/* ═══════════════ RIGHT PANEL ═══════════════ */}
        <div className="login-right">
          {/* Ambient orbs */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: 300, height: 300, top: -60, right: -60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,110,245,0.08), transparent 70%)' }} />
            <div style={{ position: 'absolute', width: 250, height: 250, bottom: -80, left: -40, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.07), transparent 70%)' }} />
          </div>

          {/* Form card */}
          <div style={{
            width: '100%', maxWidth: 364,
            background: t.card, border: `1px solid ${t.cardBorder}`,
            borderRadius: 22, padding: '26px 24px 22px',
            position: 'relative', zIndex: 1,
            boxShadow: dark
              ? '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 20px 50px rgba(91,110,245,0.1), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}>

            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: '-0.02em', margin: 0 }}>Welcome back</p>
                <span style={{ fontSize: 11.5, color: t.text2, marginTop: 3, display: 'block' }}>Sign in to continue your journey</span>
              </div>
              <button
                onClick={toggleTheme}
                style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: dark ? '#141b2d' : '#f5f7ff',
                  border: `1px solid ${t.cardBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                title={dark ? 'Switch to Light' : 'Switch to Dark'}
              >
                {dark ? <Sun size={13} color={t.text2} /> : <Moon size={13} color={t.text2} />}
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: t.text3, textTransform: 'uppercase', marginBottom: 7 }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused === 'email' ? '#818cf8' : t.text3, pointerEvents: 'none', transition: 'color 0.2s' }} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                    placeholder="you@school.edu"
                    required
                    autoComplete="email"
                    style={inputStyle('email')}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: t.text3, textTransform: 'uppercase', marginBottom: 7 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused === 'password' ? '#818cf8' : t.text3, pointerEvents: 'none', transition: 'color 0.2s' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    style={inputStyle('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: t.text3 }}
                    aria-label="Toggle password"
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="login-submit">
                {loading ? (
                  <>
                    <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'lspin 0.7s linear infinite' }} />
                    Signing in…
                  </>
                ) : (
                  <>Sign In <ArrowRight size={14} /></>
                )}
              </button>
            </form>
          </div>

          <p style={{ fontSize: 10.5, color: t.text3, marginTop: 14, textAlign: 'center', position: 'relative', zIndex: 1 }}>
            © 2025 EDUPLA · Secure · All rights reserved
          </p>
        </div>
      </div>
    </>
  );
}