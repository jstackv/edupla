import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import {
  GraduationCap, Mail, Lock, Eye, EyeOff, Sun, Moon,
  ArrowRight, ArrowLeft, BookOpen, Users, BarChart2, Zap,
  CheckCircle, UserCircle, BookMarked, Settings, ShieldCheck,
  Wifi, TrendingUp, Award, Clock, ChevronRight,
} from 'lucide-react';

/* ─── static data ─── */
const STATS = [
  { label: 'Students', value: 2400, display: '2.4K', icon: Users,     color: '#818cf8' },
  { label: 'Courses',  value: 180,  display: '180',  icon: BookOpen,  color: '#06b6d4' },
  { label: 'Teachers', value: 120,  display: '120',  icon: Award,     color: '#a78bfa' },
  { label: 'Pass Rate',value: 96,   display: '96%',  icon: TrendingUp,color: '#10b981' },
];

const DEMO_ROLES = [
  {
    role: 'student',
    label: 'Student',
    sub: 'Access courses & assignments',
    icon: UserCircle,
    color: '#818cf8',
    colorBg: 'rgba(129,140,248,0.12)',
    colorBorder: 'rgba(129,140,248,0.3)',
    email: 'student@demo.edu',
    password: 'demo123',
  },
  {
    role: 'teacher',
    label: 'Teacher',
    sub: 'Manage classes & marks',
    icon: BookMarked,
    color: '#06b6d4',
    colorBg: 'rgba(6,182,212,0.12)',
    colorBorder: 'rgba(6,182,212,0.3)',
    email: 'teacher@demo.edu',
    password: 'demo123',
  },
  {
    role: 'admin',
    label: 'Admin',
    sub: 'School-wide oversight',
    icon: Settings,
    color: '#f59e0b',
    colorBg: 'rgba(245,158,11,0.12)',
    colorBorder: 'rgba(245,158,11,0.3)',
    email: 'admin@demo.edu',
    password: 'demo123',
  },
  {
    role: 'superadmin',
    label: 'Super Admin',
    sub: 'Full platform control',
    icon: ShieldCheck,
    color: '#f43f5e',
    colorBg: 'rgba(244,63,94,0.12)',
    colorBorder: 'rgba(244,63,94,0.3)',
    email: 'superadmin@demo.edu',
    password: 'demo123',
  },
];

const ACTIVITY_FEED = [
  'Sarah K. submitted Chemistry assignment',
  'Mr. Osei published new quiz — Mathematics',
  'Class 10B results are ready to view',
  'James M. achieved 100% on Physics test',
  'New course: Advanced Biology added',
  'Admin approved 3 leave requests',
  'Amara T. joined Smart Classrooms',
  'Term report cards are now available',
];

/* ─── theme tokens ─── */
const T = {
  dark: {
    page:           '#07091a',
    leftBg:         'rgba(10,13,28,0.85)',
    leftBorder:     'rgba(255,255,255,0.06)',
    card:           'rgba(16,20,42,0.92)',
    cardBorder:     'rgba(255,255,255,0.08)',
    cardGlass:      'rgba(255,255,255,0.03)',
    inputBg:        'rgba(255,255,255,0.05)',
    inputBorder:    'rgba(255,255,255,0.1)',
    text:           '#f0f2ff',
    text2:          '#7480a8',
    text3:          '#38405e',
    statBg:         'rgba(255,255,255,0.04)',
    statBorder:     'rgba(255,255,255,0.07)',
    divLine:        'rgba(255,255,255,0.07)',
    tickerBg:       'rgba(255,255,255,0.04)',
    tickerBorder:   'rgba(255,255,255,0.07)',
    themeBtnBg:     'rgba(255,255,255,0.06)',
    shadow:         '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
    strengthEmpty:  'rgba(255,255,255,0.1)',
  },
  light: {
    page:           '#eef1ff',
    leftBg:         'rgba(255,255,255,0.85)',
    leftBorder:     'rgba(0,0,0,0.07)',
    card:           'rgba(255,255,255,0.95)',
    cardBorder:     'rgba(79,70,229,0.12)',
    cardGlass:      'rgba(255,255,255,0.5)',
    inputBg:        '#f5f7ff',
    inputBorder:    '#dde5f5',
    text:           '#0f172a',
    text2:          '#475569',
    text3:          '#94a3b8',
    statBg:         '#f5f7ff',
    statBorder:     '#e2e8f4',
    divLine:        '#e2e8f4',
    tickerBg:       '#f5f7ff',
    tickerBorder:   '#e2e8f4',
    themeBtnBg:     '#f5f7ff',
    shadow:         '0 24px 64px rgba(79,70,229,0.12), 0 0 0 1px rgba(79,70,229,0.1)',
    strengthEmpty:  '#e2e8f4',
  },
};

/* ─── password strength ─── */
function getStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#ef4444', '#f59e0b', '#06b6d4', '#10b981'];

/* ─── animated canvas ─── */
function AnimatedBg({ dark }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const accent = dark ? 'rgba(99,102,241,' : 'rgba(79,70,229,';
    const DOTS = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      a: Math.random() * Math.PI * 2,
      as: (Math.random() - 0.5) * 0.012,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      DOTS.forEach(d => {
        d.x += d.vx; d.y += d.vy; d.a += d.as;
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;
      });
      for (let i = 0; i < DOTS.length; i++) {
        for (let j = i + 1; j < DOTS.length; j++) {
          const dx = DOTS[i].x - DOTS[j].x;
          const dy = DOTS[i].y - DOTS[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `${accent}${(1 - dist / 120) * (dark ? 0.15 : 0.08)})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(DOTS[i].x, DOTS[i].y);
            ctx.lineTo(DOTS[j].x, DOTS[j].y);
            ctx.stroke();
          }
        }
      }
      DOTS.forEach(d => {
        const pulse = Math.sin(d.a) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r + pulse * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `${accent}${dark ? 0.6 : 0.4})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [dark]);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

/* ─── live counter ─── */
function useLiveCount(base) {
  const [count, setCount] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setCount(c => c + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 2));
    }, 3200);
    return () => clearInterval(id);
  }, []);
  return count;
}

/* ─── ticker ─── */
function ActivityTicker({ dark, t }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % ACTIVITY_FEED.length);
        setFade(true);
      }, 320);
    }, 3500);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', borderRadius: 100,
      background: t.tickerBg, border: `1px solid ${t.tickerBorder}`,
      overflow: 'hidden', maxWidth: '100%',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0, animation: 'livePulse 2s infinite' }} />
      <span style={{
        fontSize: 11.5, color: t.text2, whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: fade ? 1 : 0, transition: 'opacity 0.3s',
      }}>
        {ACTIVITY_FEED[idx]}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════
   MAIN LOGIN
════════════════════════════════════════════════ */
export default function Login() {
  const [step, setStep]             = useState('role'); // 'role' | 'creds'
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm]             = useState({ email: '', password: '' });
  const [loading, setLoading]       = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [remember, setRemember]     = useState(false);
  const [focused, setFocused]       = useState(null);
  const [deactivationMsg, setDeactivationMsg] = useState('');
  const onlineCount = useLiveCount(247);

  useEffect(() => {
    const msg = sessionStorage.getItem('deactivation_message');
    if (msg) { setDeactivationMsg(msg); sessionStorage.removeItem('deactivation_message'); }
  }, []);

  const { login }             = useAuth();
  const { dark, toggleTheme } = useTheme();
  const navigate              = useNavigate();
  const t                     = dark ? T.dark : T.light;
  const strength              = getStrength(form.password);

  const handleRoleSelect = (r) => {
    setSelectedRole(r);
    setForm({ email: r.email, password: r.password });
    setStep('creds');
  };

  const handleManualCreds = () => {
    setSelectedRole(null);
    setForm({ email: '', password: '' });
    setStep('creds');
  };

  const handleBack = () => {
    setStep('role');
    setSelectedRole(null);
    setForm({ email: '', password: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      const dest =
        user.role === 'teacher'    ? '/teacher/dashboard'    :
        user.role === 'admin'      ? '/admin/dashboard'      :
        user.role === 'superadmin' ? '/superadmin/dashboard' :
        '/student/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
    }
    setLoading(false);
  };

  const inputStyle = (field) => ({
    width: '100%',
    padding: field === 'password' ? '12px 44px 12px 42px' : '12px 14px 12px 42px',
    borderRadius: 12,
    border: `1.5px solid ${focused === field ? '#5b6ef5' : t.inputBorder}`,
    background: t.inputBg,
    color: t.text,
    fontSize: 13.5,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    boxShadow: focused === field ? '0 0 0 3px rgba(91,110,245,0.15)' : 'none',
    backdropFilter: 'blur(4px)',
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ep-page {
          height: 100vh; overflow: hidden;
          display: flex;
          font-family: 'DM Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .ep-left {
          width: 44%;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 28px 32px;
          position: relative;
          overflow: hidden;
          border-right: 1px solid;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .ep-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .geo-ring {
          position: absolute; border-radius: 50%; pointer-events: none;
          animation: ringBreath 8s ease-in-out infinite;
        }
        @keyframes ringBreath { 0%,100%{opacity:0.4;} 50%{opacity:0.9;} }

        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.3;transform:scale(0.8);} }
        @keyframes lspin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmerBtn {
          0%   { left: -60%; }
          100% { left: 140%; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ep-card {
          width: 100%; max-width: 400px;
          border-radius: 26px;
          position: relative; z-index: 1;
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          overflow: hidden;
          animation: slideUp 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }

        .ep-step {
          padding: 28px 26px;
          animation: slideUp 0.38s cubic-bezier(0.22,1,0.36,1) both;
        }

        .role-card {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 14px;
          border: 1.5px solid; cursor: pointer;
          transition: transform 0.18s, border-color 0.18s, background 0.18s, box-shadow 0.18s;
          background: none;
          font-family: 'DM Sans', sans-serif;
          width: 100%; text-align: left;
        }
        .role-card:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .submit-btn {
          width: 100%; padding: 14px;
          border-radius: 14px; border: none;
          background: linear-gradient(135deg, #5b6ef5 0%, #7c3aed 55%, #06b6d4 100%);
          color: #fff; font-size: 14px; font-weight: 700;
          font-family: 'Sora', sans-serif; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          letter-spacing: -0.01em;
          box-shadow: 0 6px 24px rgba(91,110,245,0.4);
          transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
          position: relative; overflow: hidden;
        }
        .submit-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .submit-btn .shimmer {
          position: absolute; top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          animation: shimmerBtn 3.5s ease-in-out infinite;
          pointer-events: none;
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 10px 32px rgba(91,110,245,0.5); }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .back-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 10px; border-radius: 9px;
          background: none; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 500;
          transition: background 0.15s, transform 0.15s;
        }
        .back-btn:hover { transform: translateX(-2px); }

        .stat-pill {
          display: flex; flex-direction: column; align-items: center;
          gap: 3px; padding: 12px 6px;
          animation: countUp 0.6s both;
        }

        .feat-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 11px;
          transition: transform 0.15s, background 0.15s;
          cursor: default;
        }
        .feat-row:hover { transform: translateX(4px); }

        .online-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 100px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
        }

        .ssl-row {
          display: flex; align-items: center; justify-content: center; gap: 16px;
          padding-top: 12px;
        }
        .ssl-item {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600;
        }

        @media (max-width: 900px) {
          .ep-left { display: none !important; }
          .ep-right { padding: 20px 16px; }
        }
      `}</style>

      <div className="ep-page" style={{ background: t.page }}>
        {/* ── shared canvas bg ── */}
        <AnimatedBg dark={dark} />

        {/* ═══════════════ LEFT PANEL ═══════════════ */}
        <div
          className="ep-left"
          style={{ background: t.leftBg, borderColor: t.leftBorder }}
        >
          {/* geo rings */}
          {[
            { w:340,h:340,t:-100,r:-100,delay:'0s'  },
            { w:200,h:200,t:-40, r:-40, delay:'2.5s' },
            { w:500,h:500,b:-220,l:-130,delay:'5s'  },
          ].map((r, i) => (
            <div key={i} className="geo-ring" style={{
              width: r.w, height: r.h,
              top: r.t, right: r.r, bottom: r.b, left: r.l,
              border: `1px solid ${dark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.1)'}`,
              animationDelay: r.delay,
            }} />
          ))}
          <div style={{ position:'absolute', width:280,height:280,top:-60,right:-60,borderRadius:'50%',background:'radial-gradient(circle,rgba(91,110,245,0.12),transparent 70%)',pointerEvents:'none' }} />

          {/* Brand */}
          <div style={{ display:'flex',alignItems:'center',gap:12,position:'relative',zIndex:1 }}>
            <div style={{
              width:42,height:42,borderRadius:13,flexShrink:0,
              background:'linear-gradient(135deg,#5b6ef5,#7c3aed)',
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:'0 0 0 1px rgba(91,110,245,0.4),0 6px 20px rgba(91,110,245,0.35)',
            }}>
              <GraduationCap size={20} color="#fff" />
            </div>
            <div>
              <p style={{fontFamily:"'Sora',sans-serif",fontSize:15,fontWeight:800,color:t.text,letterSpacing:'0.05em',margin:0}}>EDUPLA</p>
              <p style={{fontSize:10,color:t.text3,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',margin:'1px 0 0'}}>Education Platform</p>
            </div>
            {/* live badge */}
            <div className="online-badge" style={{
              marginLeft:'auto',
              background: dark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
              border:'1px solid rgba(16,185,129,0.25)',
              color:'#10b981',
            }}>
              <Wifi size={9} />
              {onlineCount} online
            </div>
          </div>

          {/* Hero */}
          <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'22px 0',position:'relative',zIndex:1}}>
            <div style={{
              display:'inline-flex',alignItems:'center',gap:7,
              padding:'5px 14px',borderRadius:100,marginBottom:20,width:'fit-content',
              background:dark?'rgba(91,110,245,0.12)':'rgba(91,110,245,0.07)',
              border:'1px solid rgba(91,110,245,0.25)',
              fontSize:10.5,fontWeight:600,color:'#818cf8',letterSpacing:'0.05em',
            }}>
              <div style={{width:5,height:5,borderRadius:'50%',background:'#10b981',animation:'livePulse 2s infinite',flexShrink:0}} />
              Trusted by 120+ educators
            </div>

            <h1 style={{
              fontFamily:"'Sora',sans-serif",
              fontSize:'clamp(22px,2.8vw,32px)',
              fontWeight:800,lineHeight:1.1,letterSpacing:'-0.035em',
              color:t.text,margin:'0 0 12px',
            }}>
              Where Learning<br />
              <span style={{background:'linear-gradient(135deg,#818cf8,#a78bfa,#06b6d4)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
                Meets Innovation
              </span>
            </h1>

            <p style={{fontSize:13,lineHeight:1.72,color:t.text2,maxWidth:300,margin:'0 0 22px'}}>
              A unified school platform empowering teachers, energizing students, and giving admins total clarity.
            </p>

            {/* Feature list */}
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:22}}>
              {[
                { icon: BookOpen,  label:'Smart Classrooms',   color:'#818cf8', bg: dark?'rgba(129,140,248,0.1)':'rgba(129,140,248,0.08)' },
                { icon: BarChart2, label:'Live Analytics',      color:'#06b6d4', bg: dark?'rgba(6,182,212,0.1)':'rgba(6,182,212,0.08)' },
                { icon: Users,     label:'Team Collaboration',  color:'#a78bfa', bg: dark?'rgba(167,139,250,0.1)':'rgba(167,139,250,0.08)' },
                { icon: Zap,       label:'Instant Feedback',    color:'#10b981', bg: dark?'rgba(16,185,129,0.1)':'rgba(16,185,129,0.08)' },
              ].map(({ icon: Icon, label, color, bg }) => (
                <div key={label} className="feat-row" style={{background: dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.02)'}}>
                  <div style={{width:30,height:30,borderRadius:9,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:bg}}>
                    <Icon size={14} color={color} />
                  </div>
                  <span style={{fontSize:12.5,color:t.text2,fontWeight:500}}>{label}</span>
                  <div style={{marginLeft:'auto',width:18,height:18,borderRadius:'50%',background:'rgba(16,185,129,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <CheckCircle size={10} color="#10b981" />
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div style={{
              display:'grid',gridTemplateColumns:'repeat(4,1fr)',
              background:t.statBg,border:`1px solid ${t.statBorder}`,
              borderRadius:16,overflow:'hidden',
            }}>
              {STATS.map(({ label, display, icon: Icon, color }, i) => (
                <div key={label} className="stat-pill" style={{
                  animationDelay:`${i*0.1}s`,
                  borderRight: i < 3 ? `1px solid ${t.statBorder}` : 'none',
                }}>
                  <Icon size={13} color={color} />
                  <span style={{fontFamily:"'Sora',sans-serif",fontSize:17,fontWeight:800,color:t.text,letterSpacing:'-0.03em'}}>{display}</span>
                  <span style={{fontSize:9.5,color:t.text3,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity ticker */}
          <div style={{position:'relative',zIndex:1,marginBottom:12}}>
            <ActivityTicker dark={dark} t={t} />
          </div>

          {/* Testimonial */}
          <div style={{
            display:'flex',alignItems:'flex-start',gap:11,
            padding:14,borderRadius:14,position:'relative',zIndex:1,
            background: dark?'rgba(91,110,245,0.07)':'rgba(91,110,245,0.04)',
            border:`1px solid ${dark?'rgba(91,110,245,0.18)':'rgba(91,110,245,0.14)'}`,
          }}>
            <div style={{
              width:34,height:34,borderRadius:10,flexShrink:0,
              background:'linear-gradient(135deg,#5b6ef5,#7c3aed)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontFamily:"'Sora',sans-serif",fontSize:11,fontWeight:700,color:'#fff',
            }}>SK</div>
            <div>
              <p style={{fontSize:11.5,lineHeight:1.68,color:t.text2,fontStyle:'italic',margin:'0 0 5px'}}>
                "EDUPLA transformed how we run our school — all in one place."
              </p>
              <p style={{fontSize:10.5,fontWeight:700,color:'#818cf8',margin:0}}>Sarah Kim · Principal, Westbridge Academy</p>
            </div>
          </div>
        </div>

        {/* ═══════════════ RIGHT PANEL ═══════════════ */}
        <div className="ep-right">
          {/* ambient orbs */}
          <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:0}}>
            <div style={{position:'absolute',width:400,height:400,top:-120,right:-100,borderRadius:'50%',background:dark?'radial-gradient(circle,rgba(91,110,245,0.1),transparent 68%)':'radial-gradient(circle,rgba(79,70,229,0.07),transparent 68%)'}} />
            <div style={{position:'absolute',width:300,height:300,bottom:-100,left:-60,borderRadius:'50%',background:dark?'radial-gradient(circle,rgba(124,58,237,0.08),transparent 68%)':'radial-gradient(circle,rgba(124,58,237,0.05),transparent 68%)'}} />
          </div>

          {/* Card */}
          <div
            className="ep-card"
            style={{
              background:t.card,
              border:`1px solid ${t.cardBorder}`,
              boxShadow:t.shadow,
            }}
          >
            {/* Glass shimmer top */}
            <div style={{
              height:2,
              background:'linear-gradient(90deg,transparent,rgba(91,110,245,0.5),rgba(124,58,237,0.4),rgba(6,182,212,0.3),transparent)',
            }} />

            {/* Card top bar */}
            <div style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'18px 26px 0',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{
                  width:36,height:36,borderRadius:11,flexShrink:0,
                  background:'linear-gradient(135deg,#5b6ef5,#7c3aed)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:'0 3px 12px rgba(91,110,245,0.4)',
                }}>
                  <GraduationCap size={16} color="#fff" />
                </div>
                <div>
                  <p style={{fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:800,color:t.text,letterSpacing:'0.04em',margin:0}}>EDUPLA</p>
                  <p style={{fontSize:9.5,color:t.text3,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',margin:'1px 0 0'}}>Secure Portal</p>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {/* step indicator */}
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  {['role','creds'].map((s,i) => (
                    <div key={s} style={{
                      width: step === s ? 20 : 6,
                      height:6,borderRadius:3,
                      background: step === s
                        ? 'linear-gradient(90deg,#5b6ef5,#7c3aed)'
                        : (dark?'rgba(255,255,255,0.12)':'rgba(0,0,0,0.1)'),
                      transition:'width 0.3s,background 0.3s',
                    }} />
                  ))}
                </div>
                <button
                  onClick={toggleTheme}
                  style={{
                    width:32,height:32,borderRadius:9,flexShrink:0,
                    background:t.themeBtnBg,
                    border:`1px solid ${t.cardBorder}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    cursor:'pointer',transition:'all 0.2s',
                  }}
                  title={dark?'Light mode':'Dark mode'}
                >
                  {dark ? <Sun size={13} color={t.text2} /> : <Moon size={13} color={t.text2} />}
                </button>
              </div>
            </div>

            {/* ── STEP: ROLE SELECTION ── */}
            {step === 'role' && (
              <div className="ep-step">
                <p style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,color:t.text,letterSpacing:'-0.025em',margin:'0 0 4px'}}>
                  Who are you?
                </p>
                <p style={{fontSize:12.5,color:t.text2,margin:'0 0 20px'}}>
                  Pick your role to continue
                </p>

                {deactivationMsg && (
                  <div style={{
                    background:'#fef2f2',border:'1.5px solid #fca5a5',
                    borderRadius:12,padding:'11px 14px',marginBottom:14,
                    display:'flex',alignItems:'flex-start',gap:9,
                  }}>
                    <span style={{fontSize:16,lineHeight:1}}>⚠️</span>
                    <div>
                      <div style={{fontWeight:700,color:'#dc2626',fontSize:13,marginBottom:2}}>Account Deactivated</div>
                      <div style={{color:'#b91c1c',fontSize:12}}>{deactivationMsg}</div>
                    </div>
                    <button onClick={() => setDeactivationMsg('')} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#b91c1c',fontSize:18,lineHeight:1}}>×</button>
                  </div>
                )}

                <div style={{display:'flex',flexDirection:'column',gap:9}}>
                  {DEMO_ROLES.map((r) => {
                    const Icon = r.icon;
                    return (
                      <button key={r.role} className="role-card" onClick={() => handleRoleSelect(r)}
                        style={{ borderColor: t.cardBorder, background: dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.02)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = r.colorBorder; e.currentTarget.style.background = r.colorBg; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.cardBorder; e.currentTarget.style.background = dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.02)'; }}
                      >
                        <div style={{
                          width:38,height:38,borderRadius:11,flexShrink:0,
                          background:r.colorBg,border:`1px solid ${r.colorBorder}`,
                          display:'flex',alignItems:'center',justifyContent:'center',
                        }}>
                          <Icon size={18} color={r.color} />
                        </div>
                        <div style={{flex:1}}>
                          <p style={{fontSize:13.5,fontWeight:700,color:t.text,margin:0,fontFamily:"'Sora',sans-serif"}}>{r.label}</p>
                          <p style={{fontSize:11.5,color:t.text2,margin:'2px 0 0'}}>{r.sub}</p>
                        </div>
                        <ChevronRight size={15} color={t.text3} />
                      </button>
                    );
                  })}
                </div>

                {/* manual entry */}
                <div style={{marginTop:18,textAlign:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <div style={{height:1,flex:1,background:t.divLine}} />
                    <span style={{fontSize:10.5,color:t.text3,fontWeight:600,letterSpacing:'0.04em'}}>or</span>
                    <div style={{height:1,flex:1,background:t.divLine}} />
                  </div>
                  <button
                    onClick={handleManualCreds}
                    style={{
                      background:'none',border:`1.5px solid ${t.cardBorder}`,
                      borderRadius:12,padding:'10px 20px',
                      color:t.text2,fontSize:13,fontWeight:600,
                      fontFamily:"'DM Sans',sans-serif",cursor:'pointer',
                      width:'100%',transition:'border-color 0.2s,color 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#5b6ef5'; e.currentTarget.style.color='#818cf8'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=t.cardBorder; e.currentTarget.style.color=t.text2; }}
                  >
                    Sign in with my own credentials
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: CREDENTIALS ── */}
            {step === 'creds' && (
              <div className="ep-step">
                {/* back + role badge */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                  <button className="back-btn" onClick={handleBack}
                    style={{color:t.text2,background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)'}}>
                    <ArrowLeft size={13} />
                    Back
                  </button>
                  {selectedRole && (
                    <div style={{
                      display:'flex',alignItems:'center',gap:6,
                      padding:'4px 10px',borderRadius:100,marginLeft:'auto',
                      background:selectedRole.colorBg,border:`1px solid ${selectedRole.colorBorder}`,
                      fontSize:11.5,fontWeight:600,color:selectedRole.color,
                    }}>
                      {(() => { const Icon = selectedRole.icon; return <Icon size={11} />; })()}
                      {selectedRole.label}
                    </div>
                  )}
                </div>

                <p style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,color:t.text,letterSpacing:'-0.025em',margin:'0 0 4px'}}>
                  Welcome back
                </p>
                <p style={{fontSize:12.5,color:t.text2,margin:'0 0 20px'}}>
                  {selectedRole ? `Signing in as ${selectedRole.label}` : 'Enter your credentials'}
                </p>

                <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}>
                  {/* Email */}
                  <div>
                    <label style={{display:'block',fontSize:10.5,fontWeight:700,letterSpacing:'0.08em',color:t.text3,textTransform:'uppercase',marginBottom:7}}>
                      Email Address
                    </label>
                    <div style={{position:'relative'}}>
                      <Mail size={14} style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',color:focused==='email'?'#818cf8':t.text3,pointerEvents:'none',transition:'color 0.2s'}} />
                      <input
                        type="email" value={form.email}
                        onChange={e => setForm(f=>({...f,email:e.target.value}))}
                        onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                        placeholder="you@school.edu" required autoComplete="email"
                        style={inputStyle('email')}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}>
                      <label style={{fontSize:10.5,fontWeight:700,letterSpacing:'0.08em',color:t.text3,textTransform:'uppercase'}}>Password</label>
                      <a href="#" onClick={e=>e.preventDefault()} style={{fontSize:11.5,color:'#818cf8',fontWeight:600,textDecoration:'none'}}>Forgot?</a>
                    </div>
                    <div style={{position:'relative'}}>
                      <Lock size={14} style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',color:focused==='password'?'#818cf8':t.text3,pointerEvents:'none',transition:'color 0.2s'}} />
                      <input
                        type={showPass?'text':'password'} value={form.password}
                        onChange={e => setForm(f=>({...f,password:e.target.value}))}
                        onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                        placeholder="••••••••" required autoComplete="current-password"
                        style={inputStyle('password')}
                      />
                      <button type="button" onClick={() => setShowPass(s=>!s)}
                        style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:3,display:'flex',color:t.text3}}
                        aria-label="Toggle password">
                        {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    </div>
                    {/* Strength meter */}
                    {form.password.length > 0 && (
                      <div style={{marginTop:8}}>
                        <div style={{display:'flex',gap:4,marginBottom:4}}>
                          {[1,2,3,4].map(n => (
                            <div key={n} style={{
                              flex:1,height:3,borderRadius:2,
                              background: n <= strength ? STRENGTH_COLORS[strength] : t.strengthEmpty,
                              transition:'background 0.3s',
                            }} />
                          ))}
                        </div>
                        <p style={{fontSize:11,color:STRENGTH_COLORS[strength],fontWeight:600,margin:0}}>{STRENGTH_LABELS[strength]} password</p>
                      </div>
                    )}
                  </div>

                  {/* Remember + SSL */}
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:`1px solid ${t.divLine}`,borderBottom:`1px solid ${t.divLine}`}}>
                    <div
                      onClick={() => setRemember(r=>!r)}
                      style={{
                        width:18,height:18,borderRadius:6,flexShrink:0,cursor:'pointer',
                        border:`1.5px solid ${remember?'#5b6ef5':t.inputBorder}`,
                        background: remember ? 'linear-gradient(135deg,#5b6ef5,#7c3aed)' : t.inputBg,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        transition:'all 0.2s',
                      }}
                    >
                      {remember && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span onClick={() => setRemember(r=>!r)} style={{fontSize:12.5,color:t.text2,cursor:'pointer',userSelect:'none'}}>
                      Stay signed in for 30 days
                    </span>
                    <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5}}>
                      <ShieldCheck size={12} color="#10b981" />
                      <span style={{fontSize:11,color:'#10b981',fontWeight:600}}>SSL secured</span>
                    </div>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={loading} className="submit-btn">
                    <div className="shimmer" />
                    {loading ? (
                      <>
                        <div style={{width:15,height:15,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'lspin 0.7s linear infinite',flexShrink:0}} />
                        Signing in…
                      </>
                    ) : (
                      <>Sign In <ArrowRight size={15}/></>
                    )}
                  </button>
                </form>

                {/* Security trust row */}
                <div className="ssl-row" style={{borderTop:`1px solid ${t.divLine}`}}>
                  {[
                    { icon: ShieldCheck, label:'256-bit SSL', color:'#10b981' },
                    { icon: Clock,       label:'Auto logout',  color:'#818cf8' },
                    { icon: Award,       label:'ISO 27001',    color:'#f59e0b' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className="ssl-item" style={{color:t.text3}}>
                      <Icon size={12} color={color} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card bottom */}
            <p style={{fontSize:10.5,textAlign:'center',color:t.text3,paddingBottom:16,margin:0}}>
              © 2025 EDUPLA · All rights reserved
            </p>
          </div>
        </div>
      </div>
    </>
  );
}