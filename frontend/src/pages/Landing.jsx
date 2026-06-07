import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import {
  GraduationCap, Sun, Moon, ArrowRight, BookOpen, Users, Award,
  CheckCircle, Zap, Shield, Star, ChevronRight,
  TrendingUp, Bell, FileText, Globe, Menu, X,
  Play, Sparkles, Target, Layers, MessageSquare,
  Rocket, LayoutDashboard, ClipboardList, Megaphone,
  ChevronDown, Mail, Phone, MapPin,
  Eye, BarChart2, Lock, CheckSquare
} from 'lucide-react';

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');`;

const NAV = ['Features','How It Works','Testimonials','Pricing'];

const FEATURES = [
  { icon: LayoutDashboard, color: '#6366f1', label: 'Unified Dashboard',    desc: 'One intelligent hub for attendance, grades, assignments and communications — all real-time.' },
  { icon: BarChart2,       color: '#0ea5e9', label: 'Live Analytics',        desc: 'Deep performance insights with visual reports, trend analysis, and exportable grade books.' },
  { icon: Users,           color: '#10b981', label: 'Role-Based Portals',    desc: 'Tailored experiences for admins, teachers, and students — each sees exactly what matters.' },
  { icon: Bell,            color: '#f59e0b', label: 'Smart Announcements',   desc: 'Class-wide or school-wide push notifications with priority tags and acknowledgement tracking.' },
  { icon: Eye,             color: '#8b5cf6', label: 'Document Viewer',       desc: 'Upload, organize, and view notes, assignments, PDFs and resources — inline without downloading.' },
  { icon: Shield,          color: '#ef4444', label: 'Enterprise Security',   desc: 'Session-based auth, role permissions, encrypted file storage, and audit trails built in.' },
  { icon: CheckSquare,     color: '#14b8a6', label: 'Smart Grading',         desc: 'Streamlined submission flows, bulk grading tools, and automatic grade calculations.' },
  { icon: Globe,           color: '#f97316', label: 'Any Device',            desc: 'Fully responsive design — works flawlessly on desktop, tablet, and mobile.' },
];

const STEPS = [
  { n: '01', icon: Target,   color: '#6366f1', title: 'Admin Configures', desc: 'Set up classes, enroll students, assign teachers, and configure settings in minutes.' },
  { n: '02', icon: BookOpen, color: '#0ea5e9', title: 'Teachers Deliver',  desc: 'Upload materials, create assignments with due dates, track submissions, and give feedback instantly.' },
  { n: '03', icon: Rocket,   color: '#10b981', title: 'Students Thrive',   desc: 'Access everything in one place — notes, assignments, grades, and announcements always up to date.' },
];

const TESTIMONIALS = [
  { init: 'SK', name: 'Sarah Kim',     role: 'Principal, Westbridge Academy', text: 'EDUPLA transformed how we run our school. Grading, attendance, and communication — all in one beautiful platform.', stars: 5, color: '#6366f1' },
  { init: 'MR', name: 'Marcus Reid',   role: 'Senior Teacher, Lincoln High',  text: 'I used to spend 3 hours on paperwork every evening. Now I upload notes in 30 seconds and students get them instantly.', stars: 5, color: '#0ea5e9' },
  { init: 'AJ', name: 'Aisha Jabari',  role: 'Student, Grade 11',             text: 'Finally a school app that feels good to use. I can see all my assignments, grades, and announcements in one place.', stars: 5, color: '#10b981' },
  { init: 'DL', name: 'Dr. David Lee', role: 'District Superintendent',       text: 'The admin analytics dashboard gives us real-time visibility across all campuses. Decision-making has never been this fast.', stars: 5, color: '#f59e0b' },
];

const PRICING = [
  { name: 'Starter',  price: 'Free',   period: '',    desc: 'Perfect for small schools getting started.', feats: ['Up to 100 students','5 teachers','Basic analytics','2GB storage','Email support'], cta: 'Get Started Free', hot: false },
  { name: 'School',   price: '$99',    period: '/mo', desc: 'Everything a growing school needs.',         feats: ['Unlimited students','Unlimited teachers','Advanced analytics','100GB storage','Priority support','Custom branding','API access'], cta: 'Start Free Trial', hot: true },
  { name: 'District', price: 'Custom', period: '',    desc: 'Multi-school deployment with full control.',  feats: ['Multiple campuses','SSO integration','Dedicated manager','SLA guarantee','Custom integrations','On-site training'], cta: 'Contact Sales', hot: false },
];

const STATS = [
  { v: '2,400+', l: 'Students',  icon: Users,      c: '#6366f1' },
  { v: '180+',   l: 'Courses',   icon: BookOpen,   c: '#0ea5e9' },
  { v: '120+',   l: 'Educators', icon: Award,      c: '#10b981' },
  { v: '96%',    l: 'Pass Rate', icon: TrendingUp, c: '#f59e0b' },
];

const FAQS = [
  { q: 'How quickly can we get started?',   a: 'Most schools are fully set up in under 30 minutes. Our onboarding wizard guides you through creating classes, adding teachers, and enrolling students step by step.' },
  { q: 'Is student data kept private?',     a: 'Absolutely. All data is encrypted at rest and in transit. We never sell user data and comply fully with FERPA guidelines.' },
  { q: 'Can teachers work offline?',        a: 'Lesson planning and document drafting work offline. Submissions and grading sync automatically when back online.' },
  { q: 'Do you support multiple campuses?', a: 'Yes — our District plan supports unlimited campuses with centralised reporting and per-campus admin roles.' },
];

/* ─── COUNTER ── */
function useCountUp(target, started) {
  const [v, setV] = useState('0');
  useEffect(function() {
    if (!started) return;
    var num = parseFloat(target.replace(/[^0-9.]/g, ''));
    var suf = target.replace(/[0-9.,]/g, '');
    var t0 = null;
    var dur = 1600;
    function tick(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      setV(Math.floor(e * num) + suf);
      if (p < 1) requestAnimationFrame(tick); else setV(target);
    }
    requestAnimationFrame(tick);
  }, [started]);
  return v;
}

function StatItem(props) {
  var v = props.v;
  var l = props.l;
  var Icon = props.icon;
  var c = props.c;
  var ref = useRef(null);
  var vis = useState(false);
  var setVis = vis[1];
  vis = vis[0];
  var count = useCountUp(v, vis);
  useEffect(function() {
    var obs = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return function() { obs.disconnect(); };
  }, []);
  return (
    <div ref={ref} style={{ textAlign:'center', padding:'2.5rem 1.5rem' }}>
      <div style={{ width:52, height:52, borderRadius:16, background:c+'18', border:'1px solid '+c+'25', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
        <Icon size={22} color={c} />
      </div>
      <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:'clamp(2.2rem,4vw,3rem)', fontWeight:400, fontStyle:'italic', letterSpacing:'-0.02em', lineHeight:1 }}>{count}</div>
      <div style={{ fontSize:12, letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:600, marginTop:8, opacity:0.6 }}>{l}</div>
    </div>
  );
}

/* ─── MOCKUP ── */
function MockupCard(props) {
  var dark = props.dark;
  var pulseState = useState(0);
  var pulse = pulseState[0];
  var setPulse = pulseState[1];
  useEffect(function() {
    var t = setInterval(function() { setPulse(function(p) { return (p+1)%3; }); }, 1800);
    return function() { clearInterval(t); };
  }, []);
  var s = {
    bg:     dark ? 'rgba(10,12,22,0.97)' : '#fff',
    border: dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.1)',
    tp:     dark ? '#f1f5f9' : '#0f172a',
    tm:     dark ? '#64748b' : '#94a3b8',
    cb:     dark ? 'rgba(255,255,255,0.04)' : 'rgba(248,250,255,0.9)',
  };
  var cards = [
    { icon: Users,         label: 'Students',  v: '247', c: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { icon: BookOpen,      label: 'Classes',   v: '18',  c: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
    { icon: ClipboardList, label: 'Tasks',     v: '94',  c: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { icon: TrendingUp,    label: 'Avg Grade', v: '87%', c: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  ];
  return (
    <div style={{ borderRadius:20, overflow:'hidden', border:'1px solid '+s.border, background:s.bg, boxShadow:dark?'0 40px 100px rgba(0,0,0,0.7)':'0 40px 100px rgba(99,102,241,0.18)', fontFamily:"'Outfit',sans-serif" }}>
      <div style={{ height:34, background:dark?'rgba(255,255,255,0.02)':'rgba(99,102,241,0.03)', borderBottom:'1px solid '+s.border, display:'flex', alignItems:'center', gap:5, padding:'0 12px' }}>
        {['#ef4444','#f59e0b','#10b981'].map(function(c,i) { return <div key={i} style={{ width:9, height:9, borderRadius:'50%', background:c, opacity:0.7 }} />; })}
        <div style={{ margin:'0 auto', height:18, width:180, borderRadius:5, background:dark?'rgba(255,255,255,0.05)':'rgba(99,102,241,0.06)', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 5px #10b981' }} />
          <span style={{ fontSize:9, color:s.tm, fontWeight:500 }}>app.edupla.school</span>
        </div>
      </div>
      <div style={{ display:'flex', height:330 }}>
        <div style={{ width:52, background:dark?'rgba(255,255,255,0.02)':'rgba(99,102,241,0.025)', borderRight:'1px solid '+s.border, display:'flex', flexDirection:'column', alignItems:'center', paddingTop:14, gap:5 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
            <GraduationCap size={13} color="white" />
          </div>
          {[LayoutDashboard, BookOpen, ClipboardList, Megaphone, FileText].map(function(Icon,i) {
            return (
              <div key={i} style={{ width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background:i===0?'rgba(99,102,241,0.15)':'transparent' }}>
                <Icon size={14} color={i===0?'#818cf8':s.tm} />
              </div>
            );
          })}
        </div>
        <div style={{ flex:1, padding:14, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:s.tp, letterSpacing:'-0.02em' }}>Good morning, Sarah 👋</div>
              <div style={{ fontSize:9, color:s.tm, marginTop:1 }}>3 assignments due today</div>
            </div>
            <div style={{ width:26, height:26, borderRadius:8, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', fontSize:9, fontWeight:800, color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>SK</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
            {cards.map(function(card, i) {
              var Icon = card.icon;
              return (
                <div key={i} style={{ padding:'9px 8px', borderRadius:11, background:s.cb, border:'1px solid '+s.border }}>
                  <div style={{ width:24, height:24, borderRadius:7, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:5 }}>
                    <Icon size={12} color={card.c} />
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:s.tp, letterSpacing:'-0.03em', lineHeight:1 }}>{card.v}</div>
                  <div style={{ fontSize:8.5, color:s.tm, marginTop:2 }}>{card.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, flex:1 }}>
            <div style={{ padding:'9px 10px', borderRadius:11, background:s.cb, border:'1px solid '+s.border }}>
              <div style={{ fontSize:9, fontWeight:700, color:s.tp, opacity:0.6, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Activity</div>
              {[
                { icon: ClipboardList, c: '#6366f1', t: 'Math HW graded' },
                { icon: Bell,          c: '#f59e0b', t: 'Announcement sent' },
                { icon: FileText,      c: '#10b981', t: 'Notes uploaded' },
              ].map(function(item, i) {
                var Icon = item.icon;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, opacity:pulse===i?1:0.55, transition:'opacity 0.4s' }}>
                    <div style={{ width:20, height:20, borderRadius:6, background:item.c+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Icon size={10} color={item.c} />
                    </div>
                    <span style={{ fontSize:9.5, color:s.tp, fontWeight:500 }}>{item.t}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ padding:'9px 10px', borderRadius:11, background:s.cb, border:'1px solid '+s.border }}>
              <div style={{ fontSize:9, fontWeight:700, color:s.tp, opacity:0.6, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Submissions / Week</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:58 }}>
                {[40,65,30,85,55,90,70].map(function(h,i) {
                  return <div key={i} style={{ flex:1, borderRadius:'2px 2px 0 0', background:'linear-gradient(180deg,#8b5cf6,#6366f1)', height:h+'%', opacity:0.6+(i/7)*0.4 }} />;
                })}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                {'MTWTFSS'.split('').map(function(d,i) {
                  return <div key={i} style={{ fontSize:7.5, color:s.tm, flex:1, textAlign:'center' }}>{d}</div>;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LABEL ── */
function Label(props) {
  var Icon = props.icon;
  var text = props.text;
  var color = props.color;
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'5px 14px', borderRadius:100, background:color+'10', border:'1px solid '+color+'25', marginBottom:20 }}>
      <Icon size={12} color={color} />
      <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', color:color, textTransform:'uppercase' }}>{text}</span>
    </div>
  );
}

/* ─── SOCIAL LINK ── */
function SocialLink(props) {
  var href = props.href;
  var label = props.label;
  var color = props.color;
  var bg = props.bg;
  var bord = props.bord;
  var icon = props.icon;
  function onEnter(e) {
    e.currentTarget.style.transform = 'translateY(-3px) scale(1.08)';
    e.currentTarget.style.boxShadow = '0 8px 22px ' + color + '50';
    e.currentTarget.style.borderColor = color;
    e.currentTarget.style.background = color + '25';
  }
  function onLeave(e) {
    e.currentTarget.style.transform = 'translateY(0) scale(1)';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.borderColor = bord;
    e.currentTarget.style.background = bg;
  }
  return (
    
      <a href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ width:42, height:42, borderRadius:13, background:bg, border:'1px solid '+bord, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.25s', textDecoration:'none', flexShrink:0 }}
    >
      {icon}
    </a>
  );
}

/* ─── FOOTER LINK ── */
function FooterLink(props) {
  var label = props.label;
  var dark = props.dark;
  var tm = props.tm;
  function onEnter(e) {
    e.currentTarget.style.color = dark ? '#a5b4fc' : '#4f46e5';
    e.currentTarget.style.paddingLeft = '4px';
  }
  function onLeave(e) {
    e.currentTarget.style.color = tm;
    e.currentTarget.style.paddingLeft = '0';
  }
  return (
    
      <a href="#"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ display:'flex', alignItems:'center', gap:7, fontSize:14, color:tm, textDecoration:'none', marginBottom:11, transition:'all 0.2s' }}
    >
      <ChevronRight size={11} style={{ opacity:0.4, flexShrink:0 }} />
      {label}
    </a>
  );
}

/* ─── BOTTOM LINK ── */
function BottomLink(props) {
  var label = props.label;
  var dark = props.dark;
  var tm = props.tm;
  function onEnter(e) { e.currentTarget.style.color = dark ? '#a5b4fc' : '#4f46e5'; }
  function onLeave(e) { e.currentTarget.style.color = tm; }
  return (
    
      <a href="#"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ fontSize:13, color:tm, textDecoration:'none', transition:'color 0.2s' }}
    >
      {label}
    </a>
  );
}

/* ─── MAIN ── */
export default function Landing() {
  var themeCtx = useTheme();
  var dark = themeCtx.dark;
  var toggleTheme = themeCtx.toggleTheme;
  var mobState = useState(false); var mob = mobState[0]; var setMob = mobState[1];
  var scrollState = useState(false); var scrolled = scrollState[0]; var setScrolled = scrollState[1];
  var hovFeatState = useState(null); var hovFeat = hovFeatState[0]; var setHovFeat = hovFeatState[1];
  var hovPlanState = useState(null); var hovPlan = hovPlanState[0]; var setHovPlan = hovPlanState[1];
  var faqState = useState(null); var faq = faqState[0]; var setFaq = faqState[1];

  useEffect(function() {
    function fn() { setScrolled(window.scrollY > 20); }
    window.addEventListener('scroll', fn);
    return function() { window.removeEventListener('scroll', fn); };
  }, []);

  var t = {
    bg:       dark ? '#080c18' : '#f8faff',
    card:     dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    bord:     dark ? 'rgba(255,255,255,0.07)' : 'rgba(99,102,241,0.12)',
    tp:       dark ? '#f1f5f9' : '#0f172a',
    tm:       dark ? '#64748b' : '#64748b',
    stripeBg: dark ? 'rgba(255,255,255,0.015)' : 'rgba(99,102,241,0.022)',
  };

  return (
    <div style={{ minHeight:'100vh', background:t.bg, fontFamily:"'Outfit',system-ui,sans-serif", color:t.tp, overflowX:'hidden' }}>
      <style>{`
        ${FONT_IMPORT}
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        @keyframes glow   { 0%,100%{box-shadow:0 0 8px #34d399} 50%{box-shadow:0 0 18px #34d399} }
        .fade-up { animation: fadeUp 0.65s ease both }
        .float   { animation: floatY 3.5s ease-in-out infinite }
        .float2  { animation: floatY 4.2s ease-in-out infinite 1.1s }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#6366f120;border-radius:9px}
        @media(max-width:900px){.hero-grid{grid-template-columns:1fr!important}}
        @media(max-width:768px){
          .nav-links{display:none!important}
          .nav-ctas{display:none!important}
          .mob-btn{display:flex!important}
          .footer-grid{grid-template-columns:1fr 1fr!important}
        }
        @media(min-width:769px){.mob-btn{display:none!important}}
      `}</style>

      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', width:800, height:800, borderRadius:'50%', top:'-20%', left:'-15%', background:'radial-gradient(circle,rgba(99,102,241,0.18),transparent)', filter:'blur(120px)' }} />
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', top:'40%', right:'-10%', background:'radial-gradient(circle,rgba(139,92,246,0.15),transparent)', filter:'blur(100px)' }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', bottom:'10%', left:'20%', background:'radial-gradient(circle,rgba(14,165,233,0.12),transparent)', filter:'blur(90px)' }} />
      </div>

      {/* NAVBAR */}
      <nav style={{ position:'sticky', top:0, zIndex:100, backdropFilter:'blur(24px)', background:scrolled?(dark?'rgba(8,12,24,0.92)':'rgba(248,250,255,0.92)'):'transparent', borderBottom:'1px solid '+(scrolled?t.bord:'transparent'), transition:'all 0.3s' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 2rem', height:66, display:'flex', alignItems:'center', gap:32 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(99,102,241,0.4)', transition:'transform 0.2s' }}
              onMouseEnter={function(e){ e.currentTarget.style.transform='scale(1.1) rotate(-5deg)'; }}
              onMouseLeave={function(e){ e.currentTarget.style.transform='scale(1) rotate(0)'; }}>
              <GraduationCap size={18} color="white" />
            </div>
            <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:22, color:t.tp, letterSpacing:'-0.01em' }}>Edupla</span>
          </Link>

          <div className="nav-links" style={{ flex:1, display:'flex', alignItems:'center', gap:4 }}>
            {NAV.map(function(l) {
              return (
                <a key={l} href={'#'+l.toLowerCase().replace(/\s+/g,'-')}
                  style={{ padding:'7px 14px', borderRadius:9, fontSize:14, fontWeight:500, color:t.tm, textDecoration:'none', transition:'all 0.2s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.color=dark?'#a5b4fc':'#4f46e5'; e.currentTarget.style.background=dark?'rgba(99,102,241,0.08)':'rgba(99,102,241,0.06)'; }}
                  onMouseLeave={function(e){ e.currentTarget.style.color=t.tm; e.currentTarget.style.background='transparent'; }}
                >{l}</a>
              );
            })}
          </div>

          <div className="nav-ctas" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={toggleTheme} style={{ width:36, height:36, borderRadius:10, background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)', border:'1px solid '+t.bord, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'transform 0.2s' }}
              onMouseEnter={function(e){ e.currentTarget.style.transform='scale(1.1)'; }}
              onMouseLeave={function(e){ e.currentTarget.style.transform='scale(1)'; }}>
              {dark ? <Sun size={14} color="#94a3b8" /> : <Moon size={14} color="#64748b" />}
            </button>
            <Link to="/login"
              style={{ padding:'9px 18px', borderRadius:10, background:'transparent', border:'1.5px solid '+t.bord, color:t.tp, fontWeight:600, fontSize:13, textDecoration:'none', transition:'all 0.2s' }}
              onMouseEnter={function(e){ e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.color='#6366f1'; }}
              onMouseLeave={function(e){ e.currentTarget.style.borderColor=t.bord; e.currentTarget.style.color=t.tp; }}
            >Sign In</Link>
            <Link to="/login"
              style={{ padding:'9px 20px', borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', fontWeight:700, fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(99,102,241,0.4)', transition:'all 0.25s' }}
              onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 22px rgba(99,102,241,0.5)'; }}
              onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(99,102,241,0.4)'; }}
            >Get Started <ArrowRight size={13} /></Link>
          </div>

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={toggleTheme} className="mob-btn" style={{ display:'none', width:36, height:36, borderRadius:10, background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)', border:'1px solid '+t.bord, alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              {dark ? <Sun size={14} color="#94a3b8" /> : <Moon size={14} color="#64748b" />}
            </button>
            <button onClick={function(){ setMob(function(o){ return !o; }); }} className="mob-btn" style={{ display:'none', width:36, height:36, borderRadius:10, background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)', border:'1px solid '+t.bord, alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              {mob ? <X size={15} color={t.tp} /> : <Menu size={15} color={t.tp} />}
            </button>
          </div>
        </div>

        {mob && (
          <div style={{ padding:'12px 1.5rem 20px', borderTop:'1px solid '+t.bord, background:dark?'rgba(8,12,24,0.97)':'rgba(248,250,255,0.97)', display:'flex', flexDirection:'column', gap:2 }}>
            {NAV.map(function(l) {
              return (
                <a key={l} href={'#'+l.toLowerCase().replace(/\s+/g,'-')} onClick={function(){ setMob(false); }}
                  style={{ padding:'11px 14px', borderRadius:10, fontSize:15, fontWeight:500, color:t.tp, textDecoration:'none' }}
                >{l}</a>
              );
            })}
            <Link to="/login" onClick={function(){ setMob(false); }} style={{ marginTop:10, padding:'12px', borderRadius:11, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', fontWeight:700, fontSize:14, textDecoration:'none', textAlign:'center' }}>Get Started Free</Link>
          </div>
        )}
      </nav>

      <div style={{ position:'relative', zIndex:1 }}>

        {/* HERO */}
        <section style={{ maxWidth:1200, margin:'0 auto', padding:'clamp(3.5rem,8vw,6rem) 2rem 3rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4rem', alignItems:'center' }} className="hero-grid">
          <div className="fade-up">
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:100, background:dark?'rgba(99,102,241,0.12)':'rgba(99,102,241,0.07)', border:'1px solid '+(dark?'rgba(99,102,241,0.28)':'rgba(99,102,241,0.18)'), marginBottom:28 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#34d399', animation:'glow 2s infinite' }} />
              <Sparkles size={12} color={dark?'#a78bfa':'#4f46e5'} />
              <span style={{ fontSize:12, fontWeight:600, color:dark?'#a78bfa':'#4f46e5', letterSpacing:'0.04em' }}>The all-in-one school management platform</span>
            </div>
            <h1 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(3rem,5.5vw,4.8rem)', fontWeight:400, lineHeight:1.06, letterSpacing:'-0.02em', margin:'0 0 10px', color:t.tp }}>Reimagine How</h1>
            <h1 style={{ fontFamily:"'Outfit',sans-serif", fontSize:'clamp(2.5rem,4.8vw,4.2rem)', fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', margin:'0 0 26px', background:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#0ea5e9 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Your School Runs</h1>
            <p style={{ fontSize:17, lineHeight:1.78, color:t.tm, maxWidth:450, margin:'0 0 36px' }}>A beautiful unified platform that connects teachers, students, and administrators — with powerful tools that make learning feel effortless.</p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:'2.5rem' }}>
              <Link to="/login"
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 28px', borderRadius:13, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', fontWeight:700, fontSize:15, textDecoration:'none', boxShadow:'0 8px 28px rgba(99,102,241,0.45)', transition:'all 0.25s' }}
                onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 40px rgba(99,102,241,0.55)'; }}
                onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(99,102,241,0.45)'; }}
              >Start for Free <ArrowRight size={15} /></Link>
              <a href="#features"
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 24px', borderRadius:13, background:t.card, color:t.tp, fontWeight:600, fontSize:15, textDecoration:'none', border:'1px solid '+t.bord, backdropFilter:'blur(12px)', transition:'all 0.2s' }}
                onMouseEnter={function(e){ e.currentTarget.style.borderColor='#6366f1'; }}
                onMouseLeave={function(e){ e.currentTarget.style.borderColor=t.bord; }}
              ><Play size={13} fill="currentColor" /> See Features</a>
            </div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {[{icon:Shield,label:'FERPA Compliant'},{icon:Zap,label:'Setup in 30 min'},{icon:Lock,label:'99.9% Uptime'}].map(function(item) {
                var Icon = item.icon;
                return (
                  <div key={item.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Icon size={13} color={dark?'#818cf8':'#4f46e5'} />
                    <span style={{ fontSize:12, fontWeight:500, color:t.tm }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ position:'relative', animation:'fadeUp 0.9s ease both' }}>
            <div style={{ position:'absolute', top:-30, right:-30, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.25),transparent)', filter:'blur(50px)', pointerEvents:'none' }} />
            <MockupCard dark={dark} />
            <div className="float" style={{ position:'absolute', top:44, right:-32, padding:'9px 14px', borderRadius:12, background:dark?'rgba(16,185,129,0.12)':'#dcfce7', border:'1px solid rgba(16,185,129,0.3)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:7, boxShadow:'0 8px 24px rgba(16,185,129,0.18)' }}>
              <CheckCircle size={13} color="#10b981" />
              <span style={{ fontSize:11, fontWeight:700, color:'#10b981', whiteSpace:'nowrap' }}>Assignment graded!</span>
            </div>
            <div className="float2" style={{ position:'absolute', bottom:54, left:-36, padding:'9px 14px', borderRadius:12, background:dark?'rgba(99,102,241,0.12)':'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.25)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:7, boxShadow:'0 8px 24px rgba(99,102,241,0.15)' }}>
              <Bell size={13} color="#6366f1" />
              <span style={{ fontSize:11, fontWeight:700, color:dark?'#818cf8':'#4f46e5', whiteSpace:'nowrap' }}>3 new submissions</span>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section style={{ background:t.stripeBg, borderTop:'1px solid '+t.bord, borderBottom:'1px solid '+t.bord }}>
          <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 2rem', display:'grid', gridTemplateColumns:'repeat(4,1fr)', color:t.tp }}>
            {STATS.map(function(s) { return <StatItem key={s.l} v={s.v} l={s.l} icon={s.icon} c={s.c} />; })}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" style={{ padding:'6rem 2rem' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'4rem' }}>
              <Label icon={Layers} text="Everything You Need" color="#4f46e5" />
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:400, letterSpacing:'-0.02em', margin:'0 0 18px', color:t.tp }}>Built for Modern Education</h2>
              <p style={{ fontSize:16, color:t.tm, maxWidth:500, margin:'0 auto', lineHeight:1.75 }}>Every feature designed with educators in mind — intuitive, fast, and genuinely delightful to use.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:16 }}>
              {FEATURES.map(function(feat, i) {
                var Icon = feat.icon;
                return (
                  <div key={feat.label}
                    onMouseEnter={function(){ setHovFeat(i); }}
                    onMouseLeave={function(){ setHovFeat(null); }}
                    style={{ padding:'28px 26px', borderRadius:20, background:t.card, border:'1px solid '+(hovFeat===i?feat.color+'44':t.bord), backdropFilter:'blur(16px)', transition:'all 0.3s', transform:hovFeat===i?'translateY(-5px)':'translateY(0)', boxShadow:hovFeat===i?'0 20px 50px '+feat.color+'22':'none', animation:'fadeUp 0.5s ease '+(i*0.05)+'s both' }}
                  >
                    <div style={{ width:50, height:50, borderRadius:15, background:feat.color+'15', border:'1px solid '+feat.color+'22', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18, transition:'all 0.3s', boxShadow:hovFeat===i?'0 4px 16px '+feat.color+'28':'none' }}>
                      <Icon size={22} color={feat.color} />
                    </div>
                    <h3 style={{ fontWeight:700, fontSize:16, margin:'0 0 10px', color:t.tp, letterSpacing:'-0.02em' }}>{feat.label}</h3>
                    <p style={{ fontSize:14, lineHeight:1.7, color:t.tm, margin:0 }}>{feat.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" style={{ background:t.stripeBg, borderTop:'1px solid '+t.bord, borderBottom:'1px solid '+t.bord, padding:'6rem 2rem' }}>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'4rem' }}>
              <Label icon={Rocket} text="Simple Onboarding" color="#7c3aed" />
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:400, letterSpacing:'-0.02em', margin:'0 0 18px', color:t.tp }}>Up and Running in Minutes</h2>
              <p style={{ fontSize:16, color:t.tm, maxWidth:440, margin:'0 auto', lineHeight:1.75 }}>No IT team needed. No complicated setup. Just a few clicks and your whole school is online.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:22 }}>
              {STEPS.map(function(step, i) {
                var Icon = step.icon;
                return (
                  <div key={step.n} style={{ padding:'36px 32px', borderRadius:24, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(16px)', position:'relative', overflow:'hidden', animation:'fadeUp 0.6s ease '+(i*0.12)+'s both' }}>
                    <div style={{ position:'absolute', top:-20, right:-10, fontSize:130, fontWeight:900, color:step.color, opacity:0.04, lineHeight:1, userSelect:'none', fontFamily:"'Outfit',sans-serif" }}>{step.n}</div>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:100, background:step.color+'12', border:'1px solid '+step.color+'28', marginBottom:22 }}>
                      <Icon size={13} color={step.color} />
                      <span style={{ fontSize:12, fontWeight:700, color:step.color, letterSpacing:'0.06em' }}>Step {step.n}</span>
                    </div>
                    <h3 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontWeight:400, fontSize:24, margin:'0 0 14px', color:t.tp, letterSpacing:'-0.01em' }}>{step.title}</h3>
                    <p style={{ fontSize:15, lineHeight:1.75, color:t.tm, margin:0 }}>{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" style={{ padding:'6rem 2rem' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'4rem' }}>
              <Label icon={MessageSquare} text="Testimonials" color="#0ea5e9" />
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:400, letterSpacing:'-0.02em', margin:'0 0 8px', color:t.tp }}>Loved by Educators Everywhere</h2>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:18 }}>
              {TESTIMONIALS.map(function(item, i) {
                return (
                  <div key={item.name}
                    style={{ padding:'28px', borderRadius:22, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(16px)', position:'relative', overflow:'hidden', transition:'all 0.25s', animation:'fadeUp 0.5s ease '+(i*0.08)+'s both' }}
                    onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 44px '+item.color+'20'; e.currentTarget.style.borderColor=item.color+'30'; }}
                    onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor=t.bord; }}
                  >
                    <div style={{ position:'absolute', top:12, right:18, fontSize:72, color:item.color, opacity:0.06, fontFamily:'Georgia,serif', lineHeight:1, userSelect:'none' }}>"</div>
                    <div style={{ display:'flex', gap:3, marginBottom:16 }}>
                      {[1,2,3,4,5].map(function(n) { return <Star key={n} size={13} color="#f59e0b" fill="#f59e0b" />; })}
                    </div>
                    <p style={{ fontSize:14.5, lineHeight:1.75, color:dark?'#cbd5e1':'#475569', margin:'0 0 22px' }}>{item.text}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,'+item.color+','+item.color+'aa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'white', flexShrink:0 }}>{item.init}</div>
                      <div>
                        <p style={{ fontWeight:700, fontSize:14, margin:0, color:t.tp }}>{item.name}</p>
                        <p style={{ fontSize:12, color:t.tm, margin:0 }}>{item.role}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" style={{ background:t.stripeBg, borderTop:'1px solid '+t.bord, borderBottom:'1px solid '+t.bord, padding:'6rem 2rem' }}>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'4rem' }}>
              <Label icon={Star} text="Pricing" color="#10b981" />
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:400, letterSpacing:'-0.02em', margin:'0 0 16px', color:t.tp }}>Simple, Transparent Pricing</h2>
              <p style={{ fontSize:16, color:t.tm, maxWidth:400, margin:'0 auto', lineHeight:1.75 }}>No hidden fees. Cancel anytime. Scale as your school grows.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:20, maxWidth:980, margin:'0 auto' }}>
              {PRICING.map(function(plan, i) {
                return (
                  <div key={plan.name}
                    onMouseEnter={function(){ setHovPlan(i); }}
                    onMouseLeave={function(){ setHovPlan(null); }}
                    style={{ padding:'36px 30px', borderRadius:24, position:'relative', background:plan.hot?(dark?'rgba(99,102,241,0.1)':'rgba(99,102,241,0.05)'):t.card, border:plan.hot?'2px solid rgba(99,102,241,0.45)':'1px solid '+t.bord, backdropFilter:'blur(16px)', transition:'all 0.3s', transform:hovPlan===i?'translateY(-5px)':(plan.hot?'translateY(-9px)':'translateY(0)'), boxShadow:hovPlan===i?'0 24px 60px rgba(99,102,241,0.2)':(plan.hot?'0 16px 50px rgba(99,102,241,0.18)':'none'), animation:'fadeUp 0.5s ease '+(i*0.1)+'s both' }}
                  >
                    {plan.hot && <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', fontSize:11, fontWeight:700, padding:'5px 18px', borderRadius:100, letterSpacing:'0.06em', whiteSpace:'nowrap', boxShadow:'0 4px 14px rgba(99,102,241,0.4)' }}>Most Popular</div>}
                    <h3 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontWeight:400, fontSize:22, margin:'0 0 10px', color:t.tp }}>{plan.name}</h3>
                    <div style={{ display:'flex', alignItems:'baseline', gap:3, marginBottom:8 }}>
                      <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:900, fontSize:44, letterSpacing:'-0.06em', color:t.tp }}>{plan.price}</span>
                      {plan.period && <span style={{ fontSize:14, color:t.tm, fontWeight:500 }}>{plan.period}</span>}
                    </div>
                    <p style={{ fontSize:13.5, color:t.tm, margin:'0 0 26px', lineHeight:1.65 }}>{plan.desc}</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
                      {plan.feats.map(function(f) {
                        return (
                          <div key={f} style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ width:20, height:20, borderRadius:6, background:plan.hot?'rgba(99,102,241,0.14)':'rgba(16,185,129,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <CheckCircle size={11} color={plan.hot?'#818cf8':'#10b981'} />
                            </div>
                            <span style={{ fontSize:13.5, color:t.tm }}>{f}</span>
                          </div>
                        );
                      })}
                    </div>
                    <Link to="/login"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px 22px', borderRadius:13, background:plan.hot?'linear-gradient(135deg,#4f46e5,#7c3aed)':t.card, color:plan.hot?'white':t.tp, fontWeight:700, fontSize:14, textDecoration:'none', border:plan.hot?'none':'1.5px solid '+t.bord, boxShadow:plan.hot?'0 6px 20px rgba(99,102,241,0.4)':'none', transition:'all 0.2s' }}
                      onMouseEnter={function(e){ if(!plan.hot){ e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.color='#6366f1'; } }}
                      onMouseLeave={function(e){ if(!plan.hot){ e.currentTarget.style.borderColor=t.bord; e.currentTarget.style.color=t.tp; } }}
                    >{plan.cta} <ChevronRight size={14} /></Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding:'6rem 2rem' }}>
          <div style={{ maxWidth:740, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'3.5rem' }}>
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,2.8rem)', fontWeight:400, margin:'0 0 14px', color:t.tp }}>Frequently Asked Questions</h2>
              <p style={{ fontSize:16, color:t.tm, lineHeight:1.7 }}>Everything you need to know before getting started.</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {FAQS.map(function(item, i) {
                return (
                  <div key={item.q} style={{ borderRadius:16, background:t.card, border:'1px solid '+(faq===i?'rgba(99,102,241,0.35)':t.bord), overflow:'hidden', transition:'border-color 0.2s' }}>
                    <button onClick={function(){ setFaq(faq===i?null:i); }} style={{ width:'100%', padding:'18px 22px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, fontFamily:'inherit', textAlign:'left' }}>
                      <span style={{ fontWeight:600, fontSize:15, color:t.tp, letterSpacing:'-0.01em' }}>{item.q}</span>
                      <ChevronDown size={15} color={t.tm} style={{ flexShrink:0, transition:'transform 0.3s', transform:faq===i?'rotate(180deg)':'rotate(0)' }} />
                    </button>
                    {faq===i && <div style={{ padding:'0 22px 18px', fontSize:14.5, lineHeight:1.78, color:t.tm, animation:'fadeUp 0.2s ease both' }}>{item.a}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding:'2rem 2rem 5rem' }}>
          <div style={{ maxWidth:900, margin:'0 auto', padding:'clamp(3rem,6vw,5rem) clamp(2rem,5vw,4rem)', borderRadius:28, background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 30%,#4f46e5 65%,#7c3aed 100%)', textAlign:'center', position:'relative', overflow:'hidden', boxShadow:'0 32px 80px rgba(79,70,229,0.45)' }}>
            <div style={{ position:'absolute', top:-80, right:-80, width:400, height:400, borderRadius:'50%', background:'rgba(255,255,255,0.06)', filter:'blur(50px)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:-50, left:-60, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.05)', filter:'blur(40px)', pointerEvents:'none' }} />
            <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.07, pointerEvents:'none' }}>
              <defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="white"/></pattern></defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
            <div style={{ position:'relative' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'6px 16px', borderRadius:100, background:'rgba(255,255,255,0.14)', marginBottom:24, backdropFilter:'blur(8px)' }}>
                <Sparkles size={12} color="white" />
                <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.9)', letterSpacing:'0.06em' }}>Join 2,400+ students already learning</span>
              </div>
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,4vw,3.2rem)', fontWeight:400, color:'white', margin:'0 0 18px', letterSpacing:'-0.01em' }}>Ready to Transform Your School?</h2>
              <p style={{ fontSize:17, color:'rgba(255,255,255,0.75)', margin:'0 0 36px', lineHeight:1.75, maxWidth:500, marginLeft:'auto', marginRight:'auto' }}>Join 120+ educators using EDUPLA to save hours each week and improve student outcomes.</p>
              <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
                <Link to="/login"
                  style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'15px 34px', borderRadius:14, background:'white', color:'#1e1b4b', fontWeight:800, fontSize:15, textDecoration:'none', boxShadow:'0 8px 30px rgba(0,0,0,0.25)', transition:'all 0.25s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow='0 14px 40px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0) scale(1)'; e.currentTarget.style.boxShadow='0 8px 30px rgba(0,0,0,0.25)'; }}
                >Start for Free Today <ArrowRight size={16} /></Link>
                <a href="#features"
                  style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'15px 28px', borderRadius:14, background:'rgba(255,255,255,0.12)', color:'white', fontWeight:700, fontSize:15, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.3)', backdropFilter:'blur(8px)', transition:'all 0.2s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.2)'; }}
                  onMouseLeave={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.12)'; }}
                >Explore Features</a>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop:'1px solid '+t.bord, background:dark?'rgba(8,12,24,0.85)':'rgba(248,250,255,0.92)', backdropFilter:'blur(20px)', position:'relative', overflow:'hidden' }}>

          <div style={{ position:'absolute', bottom:-100, left:'10%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.1),transparent)', filter:'blur(80px)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:-60, right:'5%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.08),transparent)', filter:'blur(60px)', pointerEvents:'none' }} />

          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ borderBottom:'1px solid '+t.bord, padding:'3rem 2rem 2.5rem' }}>
              <div style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'2.2fr 1fr 1fr 1.2fr', gap:'3rem' }}>

                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                    <div style={{ width:40, height:40, borderRadius:13, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(99,102,241,0.45)' }}>
                      <GraduationCap size={18} color="white" />
                    </div>
                    <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:22, color:t.tp, letterSpacing:'-0.01em' }}>Edupla</span>
                  </div>
                  <p style={{ fontSize:14, lineHeight:1.8, color:t.tm, maxWidth:270, marginBottom:28 }}>
                    The modern education management platform built to help schools teach better, connect deeper, and grow smarter.
                  </p>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <SocialLink
                      href="https://web.facebook.com/jstackvm"
                      label="Facebook"
                      color="#1877F2"
                      bg="rgba(24,119,242,0.1)"
                      bord="rgba(24,119,242,0.22)"
                      icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="#1877F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    />
                    <SocialLink
                      href="https://www.instagram.com/jstack___/"
                      label="Instagram"
                      color="#E1306C"
                      bg="rgba(225,48,108,0.1)"
                      bord="rgba(225,48,108,0.22)"
                      icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    />
                    <SocialLink
                      href="https://wa.me/250785683347"
                      label="WhatsApp"
                      color="#25D366"
                      bg="rgba(37,211,102,0.1)"
                      bord="rgba(37,211,102,0.22)"
                      icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    />
                    <SocialLink
                      href="https://github.com/jstackv/"
                      label="GitHub"
                      color={dark ? '#e2e8f0' : '#24292e'}
                      bg={dark ? 'rgba(226,232,240,0.08)' : 'rgba(36,41,46,0.08)'}
                      bord={dark ? 'rgba(226,232,240,0.18)' : 'rgba(36,41,46,0.15)'}
                      icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" stroke={dark ? '#e2e8f0' : '#24292e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    />
                  </div>
                </div>

                <div>
                  <p style={{ fontWeight:700, fontSize:11, letterSpacing:'0.09em', textTransform:'uppercase', color:t.tp, opacity:0.45, margin:'0 0 20px' }}>Product</p>
                  <FooterLink label="Features"  dark={dark} tm={t.tm} />
                  <FooterLink label="Pricing"   dark={dark} tm={t.tm} />
                  <FooterLink label="Changelog" dark={dark} tm={t.tm} />
                  <FooterLink label="Roadmap"   dark={dark} tm={t.tm} />
                  <FooterLink label="API Docs"  dark={dark} tm={t.tm} />
                </div>

                <div>
                  <p style={{ fontWeight:700, fontSize:11, letterSpacing:'0.09em', textTransform:'uppercase', color:t.tp, opacity:0.45, margin:'0 0 20px' }}>Company</p>
                  <FooterLink label="About"    dark={dark} tm={t.tm} />
                  <FooterLink label="Blog"     dark={dark} tm={t.tm} />
                  <FooterLink label="Careers"  dark={dark} tm={t.tm} />
                  <FooterLink label="Press"    dark={dark} tm={t.tm} />
                  <FooterLink label="Partners" dark={dark} tm={t.tm} />
                </div>

                <div>
                  <p style={{ fontWeight:700, fontSize:11, letterSpacing:'0.09em', textTransform:'uppercase', color:t.tp, opacity:0.45, margin:'0 0 20px' }}>Contact</p>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Mail size={13} color="#6366f1" />
                    </div>
                    <span style={{ fontSize:13.5, color:t.tm }}>jstackvm@gmail.com</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Phone size={13} color="#10b981" />
                    </div>
                    <span style={{ fontSize:13.5, color:t.tm }}>+250 785 683 347</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:22 }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:'rgba(14,165,233,0.12)', border:'1px solid rgba(14,165,233,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <MapPin size={13} color="#0ea5e9" />
                    </div>
                    <span style={{ fontSize:13.5, color:t.tm }}>Kigali, Rwanda</span>
                  </div>
                  <div style={{ padding:'16px', borderRadius:14, background:dark?'rgba(99,102,241,0.08)':'rgba(99,102,241,0.05)', border:'1px solid '+(dark?'rgba(99,102,241,0.2)':'rgba(99,102,241,0.14)') }}>
                    <p style={{ fontSize:12, fontWeight:700, color:t.tp, margin:'0 0 10px' }}>Stay in the loop</p>
                    <div style={{ display:'flex', gap:6 }}>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        style={{ flex:1, minWidth:0, padding:'8px 11px', borderRadius:9, fontSize:12, background:dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.85)', border:'1px solid '+t.bord, color:t.tp, outline:'none', fontFamily:"'Outfit',sans-serif" }}
                      />
                      <button
                        style={{ padding:'8px 14px', borderRadius:9, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', fontWeight:700, fontSize:13, border:'none', cursor:'pointer', flexShrink:0, fontFamily:"'Outfit',sans-serif", transition:'all 0.2s' }}
                        onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-1px)'; }}
                        onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0)'; }}
                      >↗</button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div style={{ padding:'1.25rem 2rem' }}>
              <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <p style={{ fontSize:13, color:t.tm, margin:0 }}>© 2025 EDUPLA · Built for modern education</p>
                  <div style={{ width:1, height:14, background:t.bord }} />
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', animation:'glow 2s infinite' }} />
                    <span style={{ fontSize:12, color:'#10b981', fontWeight:600 }}>All systems operational</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:22, flexWrap:'wrap' }}>
                  <BottomLink label="Privacy Policy"    dark={dark} tm={t.tm} />
                  <BottomLink label="Terms of Service"  dark={dark} tm={t.tm} />
                  <BottomLink label="Support"           dark={dark} tm={t.tm} />
                </div>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </div>
  );
}