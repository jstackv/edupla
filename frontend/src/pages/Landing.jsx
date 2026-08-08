import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import SEO from '../components/common/SEO';
import ownerPhoto from '../assets/owner-jmv.jpg';
import {
  GraduationCap, Sun, Moon, ArrowRight, BookOpen, Users, Award,
  CheckCircle, Zap, Shield, Star, ChevronRight,
  TrendingUp, Bell, FileText, Globe, Menu, X,
  Play, Sparkles, Target, Layers, MessageSquare,
  Rocket, LayoutDashboard, ClipboardList, Megaphone,
  ChevronDown, Mail, Phone, MapPin,
  Eye, BarChart2, Lock,
  User, ClipboardCheck, Workflow, BadgeCheck, FileBarChart2,
  School, ListChecks, FolderKanban, GitBranch, Boxes,
  FileCheck2, UserCog, SlidersHorizontal, ArrowDown, Mic, Timer,
  Code2, Calendar, Quote,
  Coffee, Heart, Cpu, Infinity as InfinityIcon, Sparkle, Terminal
} from 'lucide-react';

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');`;

/* NOTE: all display text for these arrays now lives in i18n under `landing.*`
   (see src/i18n/locales/en.json). Only icon/color/structural data stays here;
   labels/descriptions are looked up at render time via tr(`landing....`). */

const NAV = [
  { key: 'features',     anchor: 'features' },
  { key: 'curriculum',   anchor: 'curriculum' },
  { key: 'howItWorks',   anchor: 'how-it-works' },
  { key: 'testimonials', anchor: 'testimonials' },
  { key: 'owner',        anchor: 'owner', staticLabel: 'Owner' },
];

const FEATURES = [
  { key: 'documentManagement',   icon: FolderKanban,    color: '#8b5cf6' },
  { key: 'assignmentWorkflow',   icon: ClipboardList,   color: '#f97316' },
  { key: 'teacherManagement',    icon: UserCog,         color: '#0ea5e9' },
  { key: 'studentManagement',    icon: Users,           color: '#10b981' },
  { key: 'assessmentModules',    icon: ListChecks,      color: '#6366f1' },
  { key: 'onlineAssessments',    icon: Timer,           color: '#f97316' },
  { key: 'reportManagement',     icon: FileBarChart2,   color: '#14b8a6' },
  { key: 'tvetCurriculumSetup',  icon: SlidersHorizontal, color: '#ec4899' },
  { key: 'markApprovalFlow',     icon: ClipboardCheck,  color: '#22c55e' },
  { key: 'smartAnnouncements',   icon: Megaphone,       color: '#f59e0b' },
  { key: 'groupCollaboration',   icon: MessageSquare,   color: '#0ea5e9' },
  { key: 'enterpriseSecurity',   icon: Shield,          color: '#ef4444' },
  { key: 'anyDevice',            icon: Globe,           color: '#6366f1' },
  { key: 'realTimeNotifications',icon: Bell,            color: '#f59e0b' },
  { key: 'directMessaging',      icon: Mic,             color: '#8b5cf6' },
];

// TVET / competency-based curriculum configuration pipeline
const CURRICULUM_PIPELINE = [
  { key: 'sector',              icon: Layers,     color: '#6366f1' },
  { key: 'trade',                icon: Target,     color: '#0ea5e9' },
  { key: 'qualificationTitle',   icon: Award,      color: '#f59e0b' },
  { key: 'rtqfLevel',            icon: BadgeCheck, color: '#10b981' },
  { key: 'modules',              icon: Boxes,      color: '#8b5cf6' },
];

// Assessment categories used inside a module
const ASSESSMENT_TYPES = [
  { code: 'FA', key: 'fa', color: '#6366f1' },
  { code: 'IA', key: 'ia', color: '#0ea5e9' },
  { code: 'CA', key: 'ca', color: '#10b981' },
];

// Mark review workflow
const MARK_WORKFLOW = [
  { key: 'draft',     color: '#94a3b8', icon: FileText },
  { key: 'submitted', color: '#f59e0b', icon: Workflow },
  { key: 'approved',  color: '#10b981', icon: ClipboardCheck },
  { key: 'rejected',  color: '#ef4444', icon: GitBranch },
];

// Reporting outputs
const REPORT_TYPES = [
  { key: 'studentReportCard',      icon: FileCheck2,    color: '#6366f1' },
  { key: 'assessmentReport',       icon: BarChart2,     color: '#0ea5e9' },
  { key: 'classPerformanceReport', icon: FileBarChart2, color: '#10b981' },
];

const STEPS = [
  { n: '01', key: 'adminConfigures', icon: Target,   color: '#6366f1' },
  { n: '02', key: 'teachersDeliver', icon: BookOpen, color: '#0ea5e9' },
  { n: '03', key: 'studentsThrive',  icon: Rocket,   color: '#10b981' },
];

const TESTIMONIALS = [
  { init: 'SK', name: 'Sarah Kim',     key: 'sarahKim',    stars: 5, color: '#6366f1' },
  { init: 'MR', name: 'Marcus Reid',   key: 'marcusReid',  stars: 5, color: '#0ea5e9' },
  { init: 'AJ', name: 'Aisha Jabari',  key: 'aishaJabari', stars: 5, color: '#10b981' },
  { init: 'DL', name: 'Dr. David Lee', key: 'davidLee',    stars: 5, color: '#f59e0b' },
];

const STATS = [
  { key: 'students',  v: '2,400+', icon: Users,      c: '#6366f1' },
  { key: 'modules',   v: '180+',   icon: BookOpen,   c: '#0ea5e9' },
  { key: 'educators', v: '120+',   icon: Award,      c: '#10b981' },
  { key: 'passRate',  v: '96%',    icon: TrendingUp, c: '#f59e0b' },
];

// FAQs are a straight array in i18n (landing.faqs); indexed by position.
const FAQ_COUNT = 6;

/* ─── OWNER ── */
/* Exact, given owner info — kept as plain constants (not run through i18n)
   since it's factual/legal attribution, not marketing copy that should
   vary by locale. */
const OWNER = {
  name: 'Jean Marie Vianney',
  role: 'Owner, Developer & Designer',
  bio: "The owner and developer of Edupla, where he had the opportunity to build the platform from the ground up and continue improving it every day. He cared deeply about thoughtful design, reliable performance, and the small details that make software simple, intuitive, and enjoyable to use. His goal is to keep learning, building, and creating an experience that genuinely serves his users.",
  phone: '+250785683347',
  phoneDisplay: '+250 785 683 347',
  email: 'jstackvm@gmail.com',
  portfolio: 'https://jstackv.vercel.app/',
  github: 'https://github.com/jstackv',
  location: 'Kigali, Rwanda',
  founded: '2026',
};

/* Dominant tone sampled from the owner photo's backdrop — used to give the
   portrait a glow/background that reads as part of the same photograph
   rather than a cut-out pasted onto the page. */
const OWNER_TINT = { deep: '#02132b', mid: '#0d3258', soft: '#1a5f95' };

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
  var { t: tr } = useTranslation();
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
    { icon: Users,         label: tr('landing.mockup.students'),  v: '247', c: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { icon: BookOpen,      label: tr('landing.mockup.classes'),   v: '18',  c: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
    { icon: ClipboardList, label: tr('landing.mockup.tasks'),     v: '94',  c: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { icon: TrendingUp,    label: tr('landing.mockup.avgGrade'), v: '87%', c: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
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
              <div style={{ fontSize:13, fontWeight:700, color:s.tp, letterSpacing:'-0.02em' }}>{tr('landing.mockup.goodMorning')}</div>
              <div style={{ fontSize:9, color:s.tm, marginTop:1 }}>{tr('landing.mockup.assignmentsDueToday')}</div>
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
              <div style={{ fontSize:9, fontWeight:700, color:s.tp, opacity:0.6, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{tr('landing.mockup.activity')}</div>
              {[
                { icon: ClipboardList, c: '#6366f1', t: tr('landing.mockup.mathHwGraded') },
                { icon: Bell,          c: '#f59e0b', t: tr('landing.mockup.announcementSent') },
                { icon: FileText,      c: '#10b981', t: tr('landing.mockup.notesUploaded') },
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
              <div style={{ fontSize:9, fontWeight:700, color:s.tp, opacity:0.6, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{tr('landing.mockup.submissionsPerWeek')}</div>
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

/* ─── OWNER: contact/link row (icon chip + label, click-through) ── */
function OwnerLinkRow(props) {
  var icon = props.icon;
  var label = props.label;
  var value = props.value;
  var href = props.href;
  var dark = props.dark;
  var t = props.t;
  function onEnter(e) {
    e.currentTarget.style.transform = 'translateX(4px)';
    e.currentTarget.style.borderColor = OWNER_TINT.soft + '55';
    e.currentTarget.style.background = dark ? 'rgba(26,95,149,0.1)' : 'rgba(26,95,149,0.06)';
  }
  function onLeave(e) {
    e.currentTarget.style.transform = 'translateX(0)';
    e.currentTarget.style.borderColor = t.bord;
    e.currentTarget.style.background = 'transparent';
  }
  return (
    
      <a href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 13px', borderRadius:13, border:'1px solid '+t.bord, background:'transparent', textDecoration:'none', transition:'all 0.22s cubic-bezier(0.16,1,0.3,1)' }}
    >
      <div style={{ width:34, height:34, borderRadius:10, background:OWNER_TINT.soft+'1c', border:'1px solid '+OWNER_TINT.soft+'35', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ minWidth:0 }}>
        <p style={{ margin:0, fontSize:10.5, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:700, color:t.tm, opacity:0.75 }}>{label}</p>
        <p style={{ margin:0, fontSize:13.5, fontWeight:600, color:t.tp, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</p>
      </div>
    </a>
  );
}

/* ─── MAIN ── */
export default function Landing() {
  var { t: tr } = useTranslation();
  var themeCtx = useTheme();
  var dark = themeCtx.dark;
  var toggleTheme = themeCtx.toggleTheme;
  var mobState = useState(false); var mob = mobState[0]; var setMob = mobState[1];
  var scrollState = useState(false); var scrolled = scrollState[0]; var setScrolled = scrollState[1];
  var hovFeatState = useState(null); var hovFeat = hovFeatState[0]; var setHovFeat = hovFeatState[1];
  var faqState = useState(null); var faq = faqState[0]; var setFaq = faqState[1];
  var showTopBtnState = useState(false); var showTopBtn = showTopBtnState[0]; var setShowTopBtn = showTopBtnState[1];

  useEffect(function() {
    function fn() { setScrolled(window.scrollY > 20); setShowTopBtn(window.scrollY > 600); }
    window.addEventListener('scroll', fn);
    return function() { window.removeEventListener('scroll', fn); };
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  var t = {
    bg:       dark ? '#080c18' : '#f8faff',
    card:     dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    bord:     dark ? 'rgba(255,255,255,0.07)' : 'rgba(99,102,241,0.12)',
    tp:       dark ? '#f1f5f9' : '#0f172a',
    tm:       dark ? '#64748b' : '#64748b',
    stripeBg: dark ? 'rgba(255,255,255,0.015)' : 'rgba(99,102,241,0.022)',
  };

  var jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Edupla',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description: tr('landing.hero.subtitle'),
  };

  return (
    <div style={{ minHeight:'100vh', background:t.bg, fontFamily:"'Outfit',system-ui,sans-serif", color:t.tp, overflowX:'hidden' }}>
      <SEO
        title="School Management & Online Assessment Platform"
        description={tr('landing.hero.subtitle')}
        path="/"
        jsonLd={jsonLd}
      />
      <style>{`
        ${FONT_IMPORT}
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        @keyframes glow   { 0%,100%{box-shadow:0 0 8px #34d399} 50%{box-shadow:0 0 18px #34d399} }
        .fade-up { animation: fadeUp 0.65s ease both }
        .float   { animation: floatY 3.5s ease-in-out infinite }
        .float2  { animation: floatY 4.2s ease-in-out infinite 1.1s }
        section[id] { scroll-margin-top: 84px; }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#6366f120;border-radius:9px}

        /* ── Owner section ── */
        @keyframes ownerGlowDrift { 0%,100%{ transform:translate(-50%,-50%) scale(1); } 50%{ transform:translate(-48%,-52%) scale(1.08); } }
        @keyframes ownerBorderSpin { to { transform: rotate(360deg); } }
        @keyframes ownerFloatSlow { 0%,100%{ transform:translateY(0) rotate(-2deg); } 50%{ transform:translateY(-10px) rotate(1deg); } }
        @keyframes ownerFloatSlow2 { 0%,100%{ transform:translateY(0) rotate(2deg); } 50%{ transform:translateY(-8px) rotate(-1.5deg); } }
        @keyframes ownerRise { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ownerRiseLeft  { from{opacity:0;transform:translateX(-26px)} to{opacity:1;transform:translateX(0)} }
        @keyframes ownerRiseRight { from{opacity:0;transform:translateX(26px)} to{opacity:1;transform:translateX(0)} }
        @keyframes ownerChipIn { from{opacity:0;transform:translateY(10px) scale(0.94);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes ownerFocusPulseDot { 0%,100%{ opacity:0.55; } 50%{ opacity:1; } }
        .owner-reveal { opacity:0; animation: ownerRise 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .owner-reveal-left { opacity:0; animation: ownerRiseLeft 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
        .owner-reveal-right { opacity:0; animation: ownerRiseRight 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
        .owner-photo-frame { transition: transform 0.5s cubic-bezier(0.16,1,0.3,1); }
        .owner-photo-wrap:hover .owner-photo-frame { transform: perspective(900px) rotateY(-4deg) rotateX(2deg) scale(1.015); }
        .owner-photo-wrap:hover .owner-glow { opacity:1; }
        .owner-badge-float { animation: ownerFloatSlow 5s ease-in-out infinite; }
        .owner-badge-float2 { animation: ownerFloatSlow2 6s ease-in-out infinite 0.6s; }
        .owner-cta-primary { position:relative; overflow:hidden; }
        .owner-cta-primary::after { content:''; position:absolute; inset:0; background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,0.35) 50%,transparent 70%); transform:translateX(-120%); transition:transform 0.7s ease; }
        .owner-cta-primary:hover::after { transform:translateX(120%); }
        .owner-badge-float3 { animation: ownerFloatSlow 5.6s ease-in-out infinite 0.3s; }
        @keyframes ownerStatusPulse { 0%{box-shadow:0 0 0 0 rgba(52,211,153,0.55)} 70%{box-shadow:0 0 0 8px rgba(52,211,153,0)} 100%{box-shadow:0 0 0 0 rgba(52,211,153,0)} }
        .owner-status-dot { animation: ownerStatusPulse 2s infinite; }
        .owner-stat-card { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s, box-shadow 0.3s; }
        .owner-stat-card:hover { transform: translateY(-4px); }
        .owner-chip { opacity:0; animation: ownerChipIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s, box-shadow 0.25s, background 0.25s; cursor:default; }
        .owner-chip:hover { transform: translateY(-3px); }

        @media (prefers-reduced-motion: reduce) {
          .owner-reveal, .owner-reveal-left, .owner-reveal-right, .owner-chip { animation:none !important; opacity:1 !important; }
          .owner-badge-float, .owner-badge-float2, .owner-badge-float3, .owner-photo-frame, .owner-cta-primary::after, .owner-status-dot { animation:none !important; transition:none !important; }
        }

        /* ── Footer ── */
        @keyframes footerBlobDriftA { 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(30px,-24px) scale(1.12); } }
        @keyframes footerBlobDriftB { 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(-26px,20px) scale(1.08); } }
        @keyframes footerLinePan { 0%{ background-position:0% 50%; } 100%{ background-position:200% 50%; } }
        @keyframes footerWordmarkDrift { 0%,100%{ transform:translateX(-50%); } 50%{ transform:translateX(calc(-50% - 14px)); } }
        @keyframes footerStatIn { from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }
        @keyframes backToTopIn { from{opacity:0; transform:translateY(12px) scale(0.9);} to{opacity:1; transform:translateY(0) scale(1);} }
        .footer-blob-a { animation: footerBlobDriftA 14s ease-in-out infinite; }
        .footer-blob-b { animation: footerBlobDriftB 17s ease-in-out infinite; }
        .footer-accent-line { background-size:200% 100%; animation: footerLinePan 6s linear infinite; }
        .footer-wordmark { animation: footerWordmarkDrift 10s ease-in-out infinite; }
        .footer-stat-chip { opacity:0; animation: footerStatIn 0.5s ease forwards; transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease; }
        .footer-stat-chip:hover { transform: translateY(-3px); }
        .footer-newsletter-input:focus { box-shadow: 0 0 0 3px rgba(99,102,241,0.25); border-color:#6366f1 !important; }
        .footer-send-btn { position:relative; overflow:hidden; }
        .footer-send-btn::after { content:''; position:absolute; inset:0; background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,0.4) 50%,transparent 70%); transform:translateX(-120%); transition:transform 0.6s ease; }
        .footer-send-btn:hover::after { transform:translateX(120%); }
        .back-to-top-btn { animation: backToTopIn 0.35s cubic-bezier(0.16,1,0.3,1) both; transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s; }
        .back-to-top-btn:hover { transform: translateY(-4px); }
        @media (prefers-reduced-motion: reduce) {
          .footer-blob-a, .footer-blob-b, .footer-accent-line, .footer-wordmark, .footer-stat-chip, .back-to-top-btn { animation:none !important; opacity:1 !important; }
        }

        /* ── Hero ── */
        @keyframes heroWordmarkDrift { 0%,100%{ transform:translateX(-50%); } 50%{ transform:translateX(calc(-50% - 10px)); } }
        @keyframes heroMeshDriftA { 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(26px,-20px) scale(1.1); } }
        @keyframes heroMeshDriftB { 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(-22px,18px) scale(1.08); } }
        @keyframes heroGridDrift { 0%{ background-position:0 0; } 100%{ background-position:48px 48px; } }
        @keyframes heroChipIn { from{opacity:0;transform:translateY(10px) scale(0.94);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes heroPulseDot { 0%,100%{ opacity:0.5; } 50%{ opacity:1; } }
        @keyframes heroScrollBounce { 0%,100%{ transform:translateY(0); opacity:0.5; } 50%{ transform:translateY(8px); opacity:1; } }
        @keyframes heroBadgeSpin { to { transform: rotate(360deg); } }
        .hero-wordmark { animation: heroWordmarkDrift 11s ease-in-out infinite; }
        .hero-mesh-a { animation: heroMeshDriftA 13s ease-in-out infinite; }
        .hero-mesh-b { animation: heroMeshDriftB 16s ease-in-out infinite; }
        .hero-grid-pattern { animation: heroGridDrift 6s linear infinite; }
        .hero-chip { opacity:0; animation: heroChipIn 0.55s cubic-bezier(0.16,1,0.3,1) forwards; transition: transform 0.28s cubic-bezier(0.16,1,0.3,1), border-color 0.28s, box-shadow 0.28s, background 0.28s; cursor:default; }
        .hero-chip:hover { transform: translateY(-4px) scale(1.03); }
        .hero-scroll-cue { animation: heroScrollBounce 2.2s ease-in-out infinite; }
        .hero-mockup-wrap { transition: transform 0.5s cubic-bezier(0.16,1,0.3,1); }
        .hero-mockup-wrap:hover { transform: perspective(1000px) rotateY(-3deg) rotateX(1.5deg) scale(1.015); }
        .hero-cta-primary { position:relative; overflow:hidden; }
        .hero-cta-primary::after { content:''; position:absolute; inset:0; background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,0.4) 50%,transparent 70%); transform:translateX(-120%); transition:transform 0.7s ease; }
        .hero-cta-primary:hover::after { transform:translateX(120%); }
        .hero-ring-spin { animation: heroBadgeSpin 40s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hero-wordmark, .hero-mesh-a, .hero-mesh-b, .hero-grid-pattern, .hero-chip, .hero-scroll-cue, .hero-mockup-wrap, .hero-cta-primary::after, .hero-ring-spin { animation:none !important; opacity:1 !important; transition:none !important; }
        }

        @media(max-width:900px){
          .hero-grid{grid-template-columns:1fr!important}
          .hero-wordmark{display:none!important}
          .hero-mockup-wrap:hover{transform:none!important}
          .footer-grid{grid-template-columns:1fr 1fr!important; gap:2.25rem!important}
          .footer-brand{grid-column:1/-1}
          .footer-brand-desc{max-width:420px!important}
          .owner-grid{grid-template-columns:1fr!important; text-align:center!important}
          .owner-photo-col{justify-content:center!important; margin:0 auto!important}
          .owner-links-grid{grid-template-columns:1fr!important}
        }
        @media(max-width:768px){
          .nav-links{display:none!important}
          .nav-ctas{display:none!important}
          .mob-btn{display:flex!important}
          .footer-pad{padding-left:1.25rem!important; padding-right:1.25rem!important}
        }
        @media(max-width:640px){
          .footer-grid{grid-template-columns:1fr!important; gap:2.5rem!important; text-align:left}
          .footer-bottom{flex-direction:column!important; align-items:flex-start!important; gap:16px!important}
          .footer-bottom-left{flex-direction:column!important; align-items:flex-start!important; gap:10px!important}
          .footer-divider{display:none!important}
        }
        @media(max-width:480px){
          .owner-badge-float{ right:-8px!important; top:12px!important; }
          .owner-badge-float2{ left:-8px!important; bottom:20px!important; }
          .owner-badge-float3{ left:12px!important; top:-8px!important; }
          .owner-cta-row{ flex-direction:column!important; }
          .owner-cta-row a{ width:100%!important; justify-content:center!important; }
        }
        @media(min-width:769px){.mob-btn{display:none!important}}
      `}</style>

      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', width:800, height:800, borderRadius:'50%', top:'-20%', left:'-15%', background:'radial-gradient(circle,rgba(99,102,241,0.18),transparent)', filter:'blur(120px)' }} />
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', top:'40%', right:'-10%', background:'radial-gradient(circle,rgba(139,92,246,0.15),transparent)', filter:'blur(100px)' }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', bottom:'10%', left:'20%', background:'radial-gradient(circle,rgba(14,165,233,0.12),transparent)', filter:'blur(90px)' }} />
      </div>

      {/* NAVBAR */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, width:'100%', zIndex:100, backdropFilter:'blur(24px)', background:scrolled?(dark?'rgba(8,12,24,0.92)':'rgba(248,250,255,0.92)'):(dark?'rgba(8,12,24,0.55)':'rgba(248,250,255,0.55)'), borderBottom:'1px solid '+(scrolled?t.bord:'transparent'), transition:'all 0.3s' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 2rem', height:66, display:'flex', alignItems:'center', gap:32 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(99,102,241,0.4)', transition:'transform 0.2s' }}
              onMouseEnter={function(e){ e.currentTarget.style.transform='scale(1.1) rotate(-5deg)'; }}
              onMouseLeave={function(e){ e.currentTarget.style.transform='scale(1) rotate(0)'; }}>
              <GraduationCap size={18} color="white" />
            </div>
            <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:22, color:t.tp, letterSpacing:'-0.01em' }}>Edupla</span>
          </Link>

          <LanguageSwitcher dark={dark} />

          <div className="nav-links" style={{ flex:1, display:'flex', alignItems:'center', gap:4 }}>
            {NAV.map(function(item) {
              return (
                <a key={item.key} href={'#'+item.anchor}
                  style={{ padding:'7px 14px', borderRadius:9, fontSize:14, fontWeight:500, color:t.tm, textDecoration:'none', transition:'all 0.2s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.color=dark?'#a5b4fc':'#4f46e5'; e.currentTarget.style.background=dark?'rgba(99,102,241,0.08)':'rgba(99,102,241,0.06)'; }}
                  onMouseLeave={function(e){ e.currentTarget.style.color=t.tm; e.currentTarget.style.background='transparent'; }}
                >{item.staticLabel || tr('landing.nav.'+item.key)}</a>
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
            >{tr('landing.nav.login')}</Link>
            <Link to="/login"
              style={{ padding:'9px 20px', borderRadius:10, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', fontWeight:700, fontSize:13, textDecoration:'none', display:'flex', alignItems:'center', gap:6, boxShadow:'0 4px 14px rgba(99,102,241,0.4)', transition:'all 0.25s' }}
              onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 22px rgba(99,102,241,0.5)'; }}
              onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(99,102,241,0.4)'; }}
            >{tr('landing.nav.getStarted')} <ArrowRight size={13} /></Link>
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
            {NAV.map(function(item) {
              return (
                <a key={item.key} href={'#'+item.anchor} onClick={function(){ setMob(false); }}
                  style={{ padding:'11px 14px', borderRadius:10, fontSize:15, fontWeight:500, color:t.tp, textDecoration:'none' }}
                >{item.staticLabel || tr('landing.nav.'+item.key)}</a>
              );
            })}
            <Link to="/login" onClick={function(){ setMob(false); }} style={{ marginTop:10, padding:'12px', borderRadius:11, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', fontWeight:700, fontSize:14, textDecoration:'none', textAlign:'center' }}>{tr('landing.nav.getStartedFree')}</Link>
          </div>
        )}
      </nav>

      <div style={{ position:'relative', zIndex:1, paddingTop:66 }}>

        {/* HERO */}
        <section style={{ position:'relative', overflow:'hidden' }}>

          {/* ambient mesh gradients, unique to the hero */}
          <div className="hero-mesh-a" style={{ position:'absolute', top:'-12%', left:'6%', width:520, height:520, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.16),transparent 70%)', filter:'blur(90px)', pointerEvents:'none', zIndex:0 }} />
          <div className="hero-mesh-b" style={{ position:'absolute', bottom:'-14%', right:'2%', width:460, height:460, borderRadius:'50%', background:'radial-gradient(circle,rgba(14,165,233,0.14),transparent 70%)', filter:'blur(80px)', pointerEvents:'none', zIndex:0 }} />

          {/* faint drifting dot-grid for texture */}
          <div className="hero-grid-pattern" style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle,'+(dark?'rgba(255,255,255,0.05)':'rgba(79,70,229,0.07)')+' 1px, transparent 1px)', backgroundSize:'24px 24px', opacity:0.5, pointerEvents:'none', zIndex:0, maskImage:'radial-gradient(ellipse 60% 55% at 50% 35%, black, transparent)', WebkitMaskImage:'radial-gradient(ellipse 60% 55% at 50% 35%, black, transparent)' }} />

          <div style={{ maxWidth:1200, margin:'0 auto', padding:'clamp(3.5rem,8vw,6rem) 2rem 4rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4rem', alignItems:'center', position:'relative', zIndex:1 }} className="hero-grid">
            <div className="fade-up">
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:100, background:dark?'rgba(99,102,241,0.12)':'rgba(99,102,241,0.07)', border:'1px solid '+(dark?'rgba(99,102,241,0.28)':'rgba(99,102,241,0.18)'), marginBottom:28 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#34d399', animation:'glow 2s infinite' }} />
                <Sparkles size={12} color={dark?'#a78bfa':'#4f46e5'} />
                <span style={{ fontSize:12, fontWeight:600, color:dark?'#a78bfa':'#4f46e5', letterSpacing:'0.04em' }}>{tr('landing.hero.badge')}</span>
              </div>
              <h1 style={{ margin:0 }}>
                <span style={{ display:'block', fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(3rem,5.5vw,4.8rem)', fontWeight:400, lineHeight:1.06, letterSpacing:'-0.02em', margin:'0 0 10px', color:t.tp }}>{tr('landing.hero.titleLine1')}</span>
                <span style={{ display:'block', fontFamily:"'Outfit',sans-serif", fontSize:'clamp(2.5rem,4.8vw,4.2rem)', fontWeight:900, lineHeight:1, letterSpacing:'-0.05em', margin:'0 0 26px', background:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#0ea5e9 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{tr('landing.hero.titleLine2')}</span>
              </h1>
              <p style={{ fontSize:17, lineHeight:1.78, color:t.tm, maxWidth:470, margin:'0 0 36px' }}>{tr('landing.hero.subtitle')}</p>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:'2.5rem' }}>
                <Link to="/login" className="hero-cta-primary"
                  style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 28px', borderRadius:13, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', fontWeight:700, fontSize:15, textDecoration:'none', boxShadow:'0 8px 28px rgba(99,102,241,0.45)', transition:'all 0.25s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 40px rgba(99,102,241,0.55)'; }}
                  onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(99,102,241,0.45)'; }}
                >{tr('landing.hero.getStarted')} <ArrowRight size={15} /></Link>
                <a href="#features"
                  style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 24px', borderRadius:13, background:t.card, color:t.tp, fontWeight:600, fontSize:15, textDecoration:'none', border:'1px solid '+t.bord, backdropFilter:'blur(12px)', transition:'all 0.2s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.transform='translateY(-2px)'; }}
                  onMouseLeave={function(e){ e.currentTarget.style.borderColor=t.bord; e.currentTarget.style.transform='translateY(0)'; }}
                ><Play size={13} fill="currentColor" /> {tr('landing.hero.seeFeatures')}</a>
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {[
                  { icon:Shield, label:tr('landing.hero.ferpaCompliant'), color:'#10b981' },
                  { icon:Zap,    label:tr('landing.hero.setupIn30Min'),   color:'#f59e0b' },
                  { icon:Lock,   label:tr('landing.hero.uptime'),         color:'#6366f1' },
                  { icon:Globe,  label:'Multi-Language', color:'#0ea5e9' },
                ].map(function(item, i) {
                  var Icon = item.icon;
                  return (
                    <div key={item.label} className="hero-chip" style={{ animationDelay:(0.15+i*0.08)+'s', display:'flex', alignItems:'center', gap:7, padding:'8px 14px', borderRadius:100, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(10px)' }}
                      onMouseEnter={function(e){ e.currentTarget.style.borderColor=item.color+'55'; e.currentTarget.style.boxShadow='0 10px 24px '+item.color+'22'; e.currentTarget.style.background=item.color+'0c'; }}
                      onMouseLeave={function(e){ e.currentTarget.style.borderColor=t.bord; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background=t.card; }}
                    >
                      <Icon size={12} color={item.color} />
                      <span style={{ fontSize:12, fontWeight:600, color:t.tm }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ animation:'fadeUp 0.9s ease both' }}>

              <div className="hero-wordmark" style={{ textAlign:'center', fontFamily:"'Outfit',sans-serif", fontWeight:900, fontSize:'clamp(4.5rem,9vw,8.5rem)', letterSpacing:'-0.05em', lineHeight:1, color:dark?'rgba(255,255,255,0.09)':'rgba(79,70,229,0.11)', whiteSpace:'nowrap', userSelect:'none', marginBottom:'-1.2rem', position:'relative', zIndex:0 }}>Edupla</div>

              <div style={{ position:'relative', marginTop:'2.75rem' }}>
                <div style={{ position:'absolute', top:-30, right:-30, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.25),transparent)', filter:'blur(50px)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', top:'50%', left:'50%', width:400, height:400, transform:'translate(-50%,-50%)', borderRadius:'50%', border:'1px dashed '+(dark?'rgba(99,102,241,0.18)':'rgba(99,102,241,0.14)'), pointerEvents:'none' }} className="hero-ring-spin" />
                <div className="hero-mockup-wrap" style={{ position:'relative', zIndex:1 }}>
                  <MockupCard dark={dark} />
                </div>
                <div className="float" style={{ position:'absolute', top:44, right:-32, padding:'9px 14px', borderRadius:12, background:dark?'rgba(16,185,129,0.12)':'#dcfce7', border:'1px solid rgba(16,185,129,0.3)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:7, boxShadow:'0 8px 24px rgba(16,185,129,0.18)', zIndex:2 }}>
                  <CheckCircle size={13} color="#10b981" />
                  <span style={{ fontSize:11, fontWeight:700, color:'#10b981', whiteSpace:'nowrap' }}>{tr('landing.hero.assignmentGraded')}</span>
                </div>
                <div className="float2" style={{ position:'absolute', bottom:54, left:-36, padding:'9px 14px', borderRadius:12, background:dark?'rgba(99,102,241,0.12)':'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.25)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:7, boxShadow:'0 8px 24px rgba(99,102,241,0.15)', zIndex:2 }}>
                  <Bell size={13} color="#6366f1" />
                  <span style={{ fontSize:11, fontWeight:700, color:dark?'#818cf8':'#4f46e5', whiteSpace:'nowrap' }}>{tr('landing.hero.newSubmissions')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* scroll cue */}
          <a href="#features" aria-label="Scroll to features" className="hero-scroll-cue" style={{ position:'relative', zIndex:1, display:'flex', justifyContent:'center', marginTop:-8, marginBottom:8, textDecoration:'none' }}>
            <div style={{ width:30, height:30, borderRadius:'50%', border:'1px solid '+t.bord, background:t.card, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ArrowDown size={13} color={t.tm} />
            </div>
          </a>
        </section>

        {/* STATS */}
        <section style={{ background:t.stripeBg, borderTop:'1px solid '+t.bord, borderBottom:'1px solid '+t.bord }}>
          <div style={{ maxWidth:1000, margin:'0 auto', padding:'0 2rem', display:'grid', gridTemplateColumns:'repeat(4,1fr)', color:t.tp }}>
            {STATS.map(function(s) { return <StatItem key={s.key} v={s.v} l={tr('landing.stats.'+s.key)} icon={s.icon} c={s.c} />; })}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" style={{ padding:'6rem 2rem' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'4rem' }}>
              <Label icon={Layers} text={tr('landing.featuresSection.badge')} color="#4f46e5" />
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:400, letterSpacing:'-0.02em', margin:'0 0 18px', color:t.tp }}>{tr('landing.featuresSection.title')}</h2>
              <p style={{ fontSize:16, color:t.tm, maxWidth:500, margin:'0 auto', lineHeight:1.75 }}>{tr('landing.featuresSection.subtitle')}</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:16 }}>
              {FEATURES.map(function(feat, i) {
                var Icon = feat.icon;
                return (
                  <div key={feat.key}
                    onMouseEnter={function(){ setHovFeat(i); }}
                    onMouseLeave={function(){ setHovFeat(null); }}
                    style={{ padding:'28px 26px', borderRadius:20, background:t.card, border:'1px solid '+(hovFeat===i?feat.color+'44':t.bord), backdropFilter:'blur(16px)', transition:'all 0.3s', transform:hovFeat===i?'translateY(-5px)':'translateY(0)', boxShadow:hovFeat===i?'0 20px 50px '+feat.color+'22':'none', animation:'fadeUp 0.5s ease '+(i*0.05)+'s both' }}
                  >
                    <div style={{ width:50, height:50, borderRadius:15, background:feat.color+'15', border:'1px solid '+feat.color+'22', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18, transition:'all 0.3s', boxShadow:hovFeat===i?'0 4px 16px '+feat.color+'28':'none' }}>
                      <Icon size={22} color={feat.color} />
                    </div>
                    <h3 style={{ fontWeight:700, fontSize:16, margin:'0 0 10px', color:t.tp, letterSpacing:'-0.02em' }}>{tr('landing.features.'+feat.key+'.label')}</h3>
                    <p style={{ fontSize:14, lineHeight:1.7, color:t.tm, margin:0 }}>{tr('landing.features.'+feat.key+'.desc')}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* TVET CURRICULUM */}
        <section id="curriculum" style={{ padding:'6rem 2rem' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'3.5rem' }}>
              <Label icon={School} text={tr('landing.curriculumSection.badge')} color="#ec4899" />
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:400, letterSpacing:'-0.02em', margin:'0 0 18px', color:t.tp }}>{tr('landing.curriculumSection.title')}</h2>
              <p style={{ fontSize:16, color:t.tm, maxWidth:560, margin:'0 auto', lineHeight:1.75 }}>{tr('landing.curriculumSection.subtitle')}</p>
            </div>

            {/* pipeline */}
            <div style={{ display:'flex', alignItems:'stretch', gap:10, flexWrap:'wrap', justifyContent:'center', marginBottom:'4rem' }}>
              {CURRICULUM_PIPELINE.map(function(step, i) {
                var Icon = step.icon;
                return (
                  <div key={step.key} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:190, padding:'20px 18px', borderRadius:18, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(16px)', animation:'fadeUp 0.5s ease '+(i*0.08)+'s both' }}>
                      <div style={{ width:38, height:38, borderRadius:11, background:step.color+'15', border:'1px solid '+step.color+'25', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                        <Icon size={17} color={step.color} />
                      </div>
                      <h4 style={{ fontWeight:700, fontSize:14, margin:'0 0 6px', color:t.tp }}>{tr('landing.curriculum.'+step.key+'.label')}</h4>
                      <p style={{ fontSize:12, lineHeight:1.55, color:t.tm, margin:0 }}>{tr('landing.curriculum.'+step.key+'.example')}</p>
                    </div>
                    {i < CURRICULUM_PIPELINE.length - 1 && (
                      <ChevronRight size={18} color={t.tm} style={{ opacity:0.4, flexShrink:0 }} />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }} className="hero-grid">
              {/* assessment types */}
              <div style={{ padding:'30px 28px', borderRadius:22, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(16px)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <ListChecks size={18} color="#6366f1" />
                  <h3 style={{ fontWeight:700, fontSize:17, margin:0, color:t.tp }}>{tr('landing.curriculumSection.assessmentTypesTitle')}</h3>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {ASSESSMENT_TYPES.map(function(a) {
                    return (
                      <div key={a.code} style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'12px 14px', borderRadius:14, background:a.color+'0a', border:'1px solid '+a.color+'22' }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:a.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:a.color, flexShrink:0 }}>{a.code}</div>
                        <div>
                          <p style={{ fontWeight:700, fontSize:13.5, margin:'0 0 3px', color:t.tp }}>{tr('landing.assessmentTypes.'+a.key+'.name')}</p>
                          <p style={{ fontSize:12.5, lineHeight:1.6, color:t.tm, margin:0 }}>{tr('landing.assessmentTypes.'+a.key+'.desc')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* mark approval workflow */}
              <div style={{ padding:'30px 28px', borderRadius:22, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(16px)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <Workflow size={18} color="#10b981" />
                  <h3 style={{ fontWeight:700, fontSize:17, margin:0, color:t.tp }}>{tr('landing.curriculumSection.markWorkflowTitle')}</h3>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {MARK_WORKFLOW.map(function(step, i) {
                    var Icon = step.icon;
                    return (
                      <div key={step.key} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                          <div style={{ width:30, height:30, borderRadius:9, background:step.color+'18', border:'1px solid '+step.color+'30', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Icon size={13} color={step.color} />
                          </div>
                          {i < MARK_WORKFLOW.length - 1 && <div style={{ width:1.5, flex:1, minHeight:14, background:t.bord, marginTop:3 }} />}
                        </div>
                        <div style={{ paddingBottom:i < MARK_WORKFLOW.length - 1 ? 6 : 0 }}>
                          <p style={{ fontWeight:700, fontSize:13.5, margin:'0 0 2px', color:t.tp }}>{tr('landing.markWorkflow.'+step.key+'.label')}</p>
                          <p style={{ fontSize:12.5, lineHeight:1.55, color:t.tm, margin:0 }}>{tr('landing.markWorkflow.'+step.key+'.desc')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* report outputs */}
            <div style={{ marginTop:'3rem' }}>
              <div style={{ textAlign:'center', marginBottom:'2rem' }}>
                <h3 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontWeight:400, fontSize:22, margin:'0 0 8px', color:t.tp }}>{tr('landing.curriculumSection.reportsTitle')}</h3>
                <p style={{ fontSize:14.5, color:t.tm, margin:0 }}>{tr('landing.curriculumSection.reportsSubtitle')}</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
                {REPORT_TYPES.map(function(r, i) {
                  var Icon = r.icon;
                  return (
                    <div key={r.key} style={{ padding:'22px 20px', borderRadius:18, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(16px)', animation:'fadeUp 0.5s ease '+(i*0.08)+'s both' }}>
                      <div style={{ width:42, height:42, borderRadius:12, background:r.color+'15', border:'1px solid '+r.color+'25', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                        <Icon size={19} color={r.color} />
                      </div>
                      <h4 style={{ fontWeight:700, fontSize:14.5, margin:'0 0 8px', color:t.tp }}>{tr('landing.reportTypes.'+r.key+'.label')}</h4>
                      <p style={{ fontSize:13, lineHeight:1.65, color:t.tm, margin:0 }}>{tr('landing.reportTypes.'+r.key+'.desc')}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" style={{ background:t.stripeBg, borderTop:'1px solid '+t.bord, borderBottom:'1px solid '+t.bord, padding:'6rem 2rem' }}>
          <div style={{ maxWidth:1100, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'4rem' }}>
              <Label icon={Rocket} text={tr('landing.howItWorksSection.badge')} color="#7c3aed" />
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:400, letterSpacing:'-0.02em', margin:'0 0 18px', color:t.tp }}>{tr('landing.howItWorksSection.title')}</h2>
              <p style={{ fontSize:16, color:t.tm, maxWidth:440, margin:'0 auto', lineHeight:1.75 }}>{tr('landing.howItWorksSection.subtitle')}</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:22 }}>
              {STEPS.map(function(step, i) {
                var Icon = step.icon;
                return (
                  <div key={step.n} style={{ padding:'36px 32px', borderRadius:24, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(16px)', position:'relative', overflow:'hidden', animation:'fadeUp 0.6s ease '+(i*0.12)+'s both' }}>
                    <div style={{ position:'absolute', top:-20, right:-10, fontSize:130, fontWeight:900, color:step.color, opacity:0.04, lineHeight:1, userSelect:'none', fontFamily:"'Outfit',sans-serif" }}>{step.n}</div>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:100, background:step.color+'12', border:'1px solid '+step.color+'28', marginBottom:22 }}>
                      <Icon size={13} color={step.color} />
                      <span style={{ fontSize:12, fontWeight:700, color:step.color, letterSpacing:'0.06em' }}>{tr('landing.howItWorksSection.step')} {step.n}</span>
                    </div>
                    <h3 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontWeight:400, fontSize:24, margin:'0 0 14px', color:t.tp, letterSpacing:'-0.01em' }}>{tr('landing.steps.'+step.key+'.title')}</h3>
                    <p style={{ fontSize:15, lineHeight:1.75, color:t.tm, margin:0 }}>{tr('landing.steps.'+step.key+'.desc')}</p>
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
              <Label icon={MessageSquare} text={tr('landing.testimonialsSection.badge')} color="#0ea5e9" />
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,3rem)', fontWeight:400, letterSpacing:'-0.02em', margin:'0 0 8px', color:t.tp }}>{tr('landing.testimonialsSection.title')}</h2>
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
                    <p style={{ fontSize:14.5, lineHeight:1.75, color:dark?'#cbd5e1':'#475569', margin:'0 0 22px' }}>{tr('landing.testimonials.'+item.key+'.text')}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,'+item.color+','+item.color+'aa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'white', flexShrink:0 }}>{item.init}</div>
                      <div>
                        <p style={{ fontWeight:700, fontSize:14, margin:0, color:t.tp }}>{item.name}</p>
                        <p style={{ fontSize:12, color:t.tm, margin:0 }}>{tr('landing.testimonials.'+item.key+'.role')}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* OWNER / CREATOR */}
        <section id="owner" style={{ padding:'6rem 2rem', position:'relative', overflow:'hidden' }}>
          {/* ambient glow, same family of colors as the portrait's own backdrop */}
          <div style={{ position:'absolute', top:'18%', left:'50%', width:900, height:900, transform:'translate(-50%,-50%)', borderRadius:'50%', background:'radial-gradient(circle,'+OWNER_TINT.soft+'22,transparent 70%)', filter:'blur(70px)', pointerEvents:'none', animation:'ownerGlowDrift 12s ease-in-out infinite' }} />

          <div style={{ maxWidth:1100, margin:'0 auto', position:'relative' }}>
            <div className="owner-reveal" style={{ textAlign:'center', marginBottom:'3.5rem' }}>
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2.6rem,6vw,70px)', fontWeight:400, letterSpacing:'-0.02em', color:t.tp }}>
                Meet the Builder
              </h2>
              <p style={{ fontSize:16, color:t.tm, maxWidth:560, margin:'0 auto 20px', lineHeight:1.75 }}>
                Edupla is built and maintained independently, with care given to every detail.
              </p>
            </div>

            <div className="owner-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1.1fr', gap:'3.5rem', alignItems:'center' }}>

              {/* photo column */}
              <div className="owner-photo-col owner-reveal-left" style={{ display:'flex', justifyContent:'center', animationDelay:'0.05s' }}>
                <div className="owner-photo-wrap" style={{ position:'relative', width:380, maxWidth:'100%' }}>

                  {/* color-matched glow sitting behind the portrait — same
                      navy family sampled from the photo itself, so the
                      photo reads as glowing out of its own background
                      rather than sitting on top of an unrelated one */}
                  <div className="owner-glow" style={{ position:'absolute', top:'50%', left:'50%', width:500, height:500, transform:'translate(-50%,-50%)', borderRadius:'50%', background:'radial-gradient(circle,'+OWNER_TINT.soft+'55 0%,'+OWNER_TINT.mid+'33 45%,transparent 72%)', filter:'blur(42px)', opacity:0.85, transition:'opacity 0.4s ease', pointerEvents:'none', zIndex:0 }} />

                  {/* slow-rotating soft-color ring for depth */}
                  <div style={{ position:'absolute', top:'50%', left:'50%', width:430, height:430, transform:'translate(-50%,-50%)', borderRadius:'50%', border:'1px dashed '+OWNER_TINT.soft+'40', animation:'ownerBorderSpin 30s linear infinite', pointerEvents:'none', zIndex:0 }} />

                  <div className="owner-photo-frame" style={{ position:'relative', zIndex:1, borderRadius:28, overflow:'hidden', border:'1px solid '+OWNER_TINT.soft+'3a', boxShadow:'0 30px 70px -20px '+OWNER_TINT.mid+'70, 0 0 0 1px '+OWNER_TINT.soft+'20' }}>
                    <img
                      src={ownerPhoto}
                      alt={OWNER.name + ' — ' + OWNER.role}
                      style={{
                        display:'block',
                        width:'100%',
                        height:500,
                        objectFit:'cover',
                        objectPosition:'top center',
                        /* the same navy the photo's backdrop already is —
                           painted underneath, then the image itself is
                           faded out at the very bottom edge so it dissolves
                           into that color (and, beyond it, into the page)
                           instead of ending in a hard rectangle */
                        background: 'linear-gradient(180deg,'+OWNER_TINT.deep+' 0%,'+OWNER_TINT.mid+' 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)',
                        maskImage: 'linear-gradient(to bottom, black 78%, transparent 100%)',
                      }}
                    />
                    {/* thin tint wash so the frame's edges and the photo's
                        own navy read as one continuous surface */}
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 55%, '+OWNER_TINT.deep+'55 100%)', pointerEvents:'none' }} />
                  </div>

                  {/* floating badges */}
                  <div className="owner-badge-float" style={{ position:'absolute', top:18, right:-24, zIndex:2, padding:'8px 13px', borderRadius:12, background:dark?'rgba(13,50,88,0.55)':'#eaf4ff', border:'1px solid '+OWNER_TINT.soft+'45', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:7, boxShadow:'0 10px 26px '+OWNER_TINT.mid+'30' }}>
                    <Code2 size={13} color={OWNER_TINT.soft} />
                    <span style={{ fontSize:11, fontWeight:700, color:dark?'#bfe0ff':OWNER_TINT.mid, whiteSpace:'nowrap' }}>Founder of Edupla</span>
                  </div>
                  <div className="owner-badge-float2" style={{ position:'absolute', bottom:34, left:-26, zIndex:2, padding:'8px 13px', borderRadius:12, background:dark?'rgba(13,50,88,0.55)':'#eaf4ff', border:'1px solid '+OWNER_TINT.soft+'45', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:7, boxShadow:'0 10px 26px '+OWNER_TINT.mid+'30' }}>
                    <MapPin size={13} color={OWNER_TINT.soft} />
                    <span style={{ fontSize:11, fontWeight:700, color:dark?'#bfe0ff':OWNER_TINT.mid, whiteSpace:'nowrap' }}>{OWNER.location}</span>
                  </div>
                  <div className="owner-badge-float3" style={{ position:'absolute', top:-18, left:30, zIndex:2, padding:'8px 13px', borderRadius:12, background:dark?'rgba(13,50,88,0.55)':'#eaf4ff', border:'1px solid '+OWNER_TINT.soft+'45', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', gap:7, boxShadow:'0 10px 26px '+OWNER_TINT.mid+'30' }}>
                    <span className="owner-status-dot" style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', flexShrink:0 }} />
                    <span style={{ fontSize:11, fontWeight:700, color:dark?'#bfe0ff':OWNER_TINT.mid, whiteSpace:'nowrap' }}>Created since {OWNER.founded}</span>
                  </div>
                </div>
              </div>

              {/* details column */}
              <div className="owner-reveal-right" style={{ animationDelay:'0.15s' }}>
                <div style={{ padding:'2px 0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                    <h3 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontWeight:400, fontSize:'clamp(1.7rem,2.6vw,2.1rem)', margin:0, color:t.tp }}>{OWNER.name}</h3>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 11px', borderRadius:100, background:OWNER_TINT.soft+'16', border:'1px solid '+OWNER_TINT.soft+'35' }}>
                      <BadgeCheck size={12} color={OWNER_TINT.soft} />
                      <span style={{ fontSize:11, fontWeight:700, color:OWNER_TINT.soft }}>Verified Owner</span>
                    </span>
                  </div>
                  <p style={{ fontSize:14, fontWeight:600, color:t.tm, margin:'0 0 6px', letterSpacing:'0.01em' }}>{OWNER.role}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:22 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:t.tm }}>
                      <MapPin size={13} color={OWNER_TINT.soft} /> {OWNER.location}
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:t.tm }}>
                      <Calendar size={13} color={OWNER_TINT.soft} /> Building Edupla since {OWNER.founded}
                    </span>
                  </div>

                  <div style={{ position:'relative', padding:'18px 20px', borderRadius:16, background:t.card, border:'1px solid '+t.bord, backdropFilter:'blur(16px)', marginBottom:24 }}>
                    <Quote size={26} color={OWNER_TINT.soft} style={{ opacity:0.35, position:'absolute', top:14, right:16 }} />
                    <p style={{ fontSize:14.5, lineHeight:1.8, color:dark?'#cbd5e1':'#475569', margin:0, maxWidth:480 }}>{OWNER.bio}</p>
                  </div>

                  <div className="owner-links-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:26 }}>
                    <OwnerLinkRow t={t} dark={dark} href={'tel:'+OWNER.phone} icon={<Phone size={15} color={OWNER_TINT.soft} />} label="Phone" value={OWNER.phoneDisplay} />
                    <OwnerLinkRow t={t} dark={dark} href={'mailto:'+OWNER.email} icon={<Mail size={15} color={OWNER_TINT.soft} />} label="Email" value={OWNER.email} />
                    <OwnerLinkRow t={t} dark={dark} href={OWNER.portfolio} icon={<Globe size={15} color={OWNER_TINT.soft} />} label="Portfolio" value="jstackv.vercel.app" />
                    <OwnerLinkRow t={t} dark={dark} href={OWNER.github} icon={<GitBranch size={15} color={OWNER_TINT.soft} />} label="GitHub" value="github.com/jstackv" />
                  </div>

                  <div className="owner-cta-row" style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    <a href={OWNER.portfolio} target="_blank" rel="noopener noreferrer" className="owner-cta-primary"
                      style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'14px 26px', borderRadius:13, background:'linear-gradient(135deg,'+OWNER_TINT.mid+','+OWNER_TINT.soft+')', color:'white', fontWeight:700, fontSize:14.5, textDecoration:'none', boxShadow:'0 10px 30px '+OWNER_TINT.mid+'55', transition:'all 0.25s' }}
                      onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 16px 40px '+OWNER_TINT.mid+'70'; }}
                      onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 10px 30px '+OWNER_TINT.mid+'55'; }}
                    >View My Portfolio <ArrowRight size={15} /></a>

                    <a href={OWNER.github} target="_blank" rel="noopener noreferrer"
                      style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'14px 24px', borderRadius:13, background:t.card, color:t.tp, fontWeight:700, fontSize:14.5, textDecoration:'none', border:'1.5px solid '+t.bord, backdropFilter:'blur(12px)', transition:'all 0.2s' }}
                      onMouseEnter={function(e){ e.currentTarget.style.borderColor=OWNER_TINT.soft; e.currentTarget.style.color=OWNER_TINT.soft; e.currentTarget.style.transform='translateY(-2px)'; }}
                      onMouseLeave={function(e){ e.currentTarget.style.borderColor=t.bord; e.currentTarget.style.color=t.tp; e.currentTarget.style.transform='translateY(0)'; }}
                    ><GitBranch size={15} /> View GitHub Profile <ChevronRight size={14} /></a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding:'6rem 2rem' }}>
          <div style={{ maxWidth:740, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'3.5rem' }}>
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,3.5vw,2.8rem)', fontWeight:400, margin:'0 0 14px', color:t.tp }}>{tr('landing.faqSection.title')}</h2>
              <p style={{ fontSize:16, color:t.tm, lineHeight:1.7 }}>{tr('landing.faqSection.subtitle')}</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {tr('landing.faqs', { returnObjects: true }).map(function(item, i) {
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
                <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.9)', letterSpacing:'0.06em' }}>{tr('landing.finalCta.badge')}</span>
              </div>
              <h2 style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:'clamp(2rem,4vw,3.2rem)', fontWeight:400, color:'white', margin:'0 0 18px', letterSpacing:'-0.01em' }}>{tr('landing.finalCta.title')}</h2>
              <p style={{ fontSize:17, color:'rgba(255,255,255,0.75)', margin:'0 0 36px', lineHeight:1.75, maxWidth:500, marginLeft:'auto', marginRight:'auto' }}>{tr('landing.finalCta.subtitle')}</p>
              <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
                <Link to="/login"
                  style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'15px 34px', borderRadius:14, background:'white', color:'#1e1b4b', fontWeight:800, fontSize:15, textDecoration:'none', boxShadow:'0 8px 30px rgba(0,0,0,0.25)', transition:'all 0.25s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.transform='translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow='0 14px 40px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={function(e){ e.currentTarget.style.transform='translateY(0) scale(1)'; e.currentTarget.style.boxShadow='0 8px 30px rgba(0,0,0,0.25)'; }}
                >{tr('landing.finalCta.startFree')} <ArrowRight size={16} /></Link>
                <a href="#features"
                  style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'15px 28px', borderRadius:14, background:'rgba(255,255,255,0.12)', color:'white', fontWeight:700, fontSize:15, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.3)', backdropFilter:'blur(8px)', transition:'all 0.2s' }}
                  onMouseEnter={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.2)'; }}
                  onMouseLeave={function(e){ e.currentTarget.style.background='rgba(255,255,255,0.12)'; }}
                >{tr('landing.finalCta.exploreFeatures')}</a>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop:'1px solid '+t.bord, background:dark?'rgba(8,12,24,0.85)':'rgba(248,250,255,0.92)', backdropFilter:'blur(20px)', position:'relative', overflow:'hidden' }}>

          {/* animated gradient accent line along the very top edge */}
          <div className="footer-accent-line" style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#6366f1,#8b5cf6,#0ea5e9,#8b5cf6,#6366f1)', pointerEvents:'none' }} />

          {/* giant faded wordmark for depth */}
          <div className="footer-wordmark" style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)', fontFamily:"'Outfit',sans-serif", fontWeight:900, fontSize:'clamp(6rem,18vw,15rem)', letterSpacing:'-0.05em', lineHeight:1, color:dark?'rgba(255,255,255,0.025)':'rgba(79,70,229,0.035)', whiteSpace:'nowrap', pointerEvents:'none', userSelect:'none', zIndex:0 }}>Edupla</div>

          <div className="footer-blob-a" style={{ position:'absolute', bottom:-100, left:'10%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.1),transparent)', filter:'blur(80px)', pointerEvents:'none' }} />
          <div className="footer-blob-b" style={{ position:'absolute', top:-60, right:'5%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.08),transparent)', filter:'blur(60px)', pointerEvents:'none' }} />

          <div style={{ position:'relative', zIndex:1 }}>

            {/* quick stats strip */}
            <div style={{ borderBottom:'1px solid '+t.bord, padding:'1.75rem 2rem' }} className="footer-pad">
              <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', flexWrap:'wrap', justifyContent:'center', gap:12 }}>
                {STATS.map(function(s, i) {
                  var Icon = s.icon;
                  return (
                    <div key={s.key} className="footer-stat-chip" style={{ animationDelay:(i*0.08)+'s', display:'flex', alignItems:'center', gap:9, padding:'9px 18px', borderRadius:100, background:t.card, border:'1px solid '+t.bord }}
                      onMouseEnter={function(e){ e.currentTarget.style.borderColor=s.c+'55'; e.currentTarget.style.boxShadow='0 10px 26px '+s.c+'22'; }}
                      onMouseLeave={function(e){ e.currentTarget.style.borderColor=t.bord; e.currentTarget.style.boxShadow='none'; }}
                    >
                      <Icon size={13} color={s.c} />
                      <span style={{ fontSize:13, fontWeight:800, color:t.tp }}>{s.v}</span>
                      <span style={{ fontSize:11.5, color:t.tm, fontWeight:500 }}>{tr('landing.stats.'+s.key)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ borderBottom:'1px solid '+t.bord, padding:'3rem 2rem 2.5rem' }} className="footer-pad">
              <div className="footer-grid" style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'2.2fr 1fr 1fr 1.2fr', gap:'3rem' }}>

                <div className="footer-brand">
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                    <div style={{ width:40, height:40, borderRadius:13, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(99,102,241,0.45)' }}>
                      <GraduationCap size={18} color="white" />
                    </div>
                    <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:'italic', fontSize:22, color:t.tp, letterSpacing:'-0.01em' }}>Edupla</span>
                  </div>
                  <p className="footer-brand-desc" style={{ fontSize:14, lineHeight:1.8, color:t.tm, maxWidth:270, marginBottom:28 }}>
                    {tr('landing.footer.brandDesc')}
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
                  <p style={{ display:'flex', alignItems:'center', gap:7, fontWeight:700, fontSize:11, letterSpacing:'0.09em', textTransform:'uppercase', color:t.tp, opacity:0.55, margin:'0 0 20px' }}><Layers size={13} color="#6366f1" />{tr('landing.footer.product')}</p>
                  <FooterLink label={tr('landing.nav.features')}  dark={dark} tm={t.tm} />
                  <FooterLink label={tr('landing.footer.changelog')} dark={dark} tm={t.tm} />
                  <FooterLink label={tr('landing.footer.roadmap')}   dark={dark} tm={t.tm} />
                  <FooterLink label={tr('landing.footer.apiDocs')}  dark={dark} tm={t.tm} />
                </div>

                <div>
                  <p style={{ display:'flex', alignItems:'center', gap:7, fontWeight:700, fontSize:11, letterSpacing:'0.09em', textTransform:'uppercase', color:t.tp, opacity:0.55, margin:'0 0 20px' }}><Users size={13} color="#0ea5e9" />{tr('landing.footer.company')}</p>
                  <FooterLink label={tr('landing.footer.about')}    dark={dark} tm={t.tm} />
                  <FooterLink label={tr('landing.footer.blog')}     dark={dark} tm={t.tm} />
                  <FooterLink label={tr('landing.footer.careers')}  dark={dark} tm={t.tm} />
                  <FooterLink label={tr('landing.footer.press')}    dark={dark} tm={t.tm} />
                  <FooterLink label={tr('landing.footer.partners')} dark={dark} tm={t.tm} />
                </div>
                <div>
                  <p style={{ display:'flex', alignItems:'center', gap:7, fontWeight:700, fontSize:11, letterSpacing:'0.09em', textTransform:'uppercase', color:t.tp, opacity:0.55, margin:'0 0 20px' }}><Mail size={13} color="#10b981" />{tr('landing.footer.contact')}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Mail size={13} color="#6366f1" />
                    </div>
                    <span style={{ fontSize:13.5, color:t.tm }}>edupla@yahoo.fr</span>
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
                    <span style={{ fontSize:13.5, color:t.tm }}>{tr('landing.footer.location')}</span>
                  </div>
                </div>

              </div>
            </div>

            <div style={{ padding:'1.25rem 2rem' }} className="footer-pad">
              <div className="footer-bottom" style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
                <div className="footer-bottom-left" style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                  <p style={{ fontSize:13, color:t.tm, margin:0 }}>
                    © {OWNER.founded} Edupla. Created, designed, and owned by{' '}
                    <a href={OWNER.portfolio} target="_blank" rel="noopener noreferrer"
                      style={{ color:'inherit', fontWeight:700, textDecoration:'underline', textDecorationColor:t.bord, textUnderlineOffset:3, transition:'color 0.2s' }}
                      onMouseEnter={function(e){ e.currentTarget.style.color = dark ? '#a5b4fc' : '#4f46e5'; }}
                      onMouseLeave={function(e){ e.currentTarget.style.color = 'inherit'; }}
                    >{OWNER.name}</a>. All rights reserved.
                  </p>
                  <div className="footer-divider" style={{ width:1, height:14, background:t.bord }} />
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', animation:'glow 2s infinite' }} />
                    <span style={{ fontSize:12, color:'#10b981', fontWeight:600 }}>{tr('landing.footer.systemsOperational')}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:22, flexWrap:'wrap' }}>
                  <BottomLink label={tr('landing.footer.privacyPolicy')}    dark={dark} tm={t.tm} />
                  <BottomLink label={tr('landing.footer.termsOfService')}  dark={dark} tm={t.tm} />
                  <BottomLink label={tr('landing.footer.support')}           dark={dark} tm={t.tm} />
                </div>
              </div>
            </div>

          </div>
        </footer>

        {showTopBtn && (
          <button
            className="back-to-top-btn"
            onClick={scrollToTop}
            aria-label="Back to top"
            style={{ position:'fixed', bottom:26, right:26, zIndex:90, width:46, height:46, borderRadius:14, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 12px 30px rgba(99,102,241,0.45)' }}
          >
            <ArrowRight size={17} color="white" style={{ transform:'rotate(-90deg)' }} />
          </button>
        )}

      </div>
    </div>
  );
}