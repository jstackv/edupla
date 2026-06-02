import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Users, BookOpen, GraduationCap, ClipboardList, FileText, Megaphone,
  ChevronRight, Shield, TrendingUp, TrendingDown, ArrowUpRight,
  Activity, BarChart2, CheckCircle2,
} from 'lucide-react';

/* ── Animated counter ── */
function useCountUp(target, trigger, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger || !target) return;
    const num = Number(target);
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * num));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, trigger]);
  return val;
}

/* ── Sparkline mini-chart ── */
function Sparkline({ data = [], color = '#6366f1', height = 36 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  const gradId = `sg${color.replace(/[^a-z0-9]/gi,'')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Radial progress ring ── */
function RadialRing({ pct = 0, color = '#6366f1', size = 52, stroke = 5 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor"
        strokeWidth={stroke} style={{ color: 'var(--surface-100)' }} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </svg>
  );
}

/* ── Avatar ── */
const AVATAR_COLORS = [
  ['#6366f1','#4338ca'], ['#0ea5e9','#0284c7'], ['#10b981','#059669'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#8b5cf6','#7c3aed'],
];
function Avatar({ name, size = 36 }) {
  const [from, to] = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.35,
      background: `linear-gradient(135deg, ${from}, ${to})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: `0 2px 8px ${from}55`
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: size * 0.38 }}>
        {name?.[0]?.toUpperCase()}
      </span>
    </div>
  );
}

/* ── Hero Stat Card ── */
function HeroStat({ icon: Icon, label, value, color, bg, trend, sparkData, to }) {
  const [mounted, setMounted] = useState(false);
  const counted = useCountUp(value, mounted);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);
  const isUp = trend >= 0;
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ position:'relative', overflow:'hidden', cursor:'pointer', transition:'transform 0.2s ease, box-shadow 0.2s ease' }}
        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 12px 32px rgba(0,0,0,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=''; }}
      >
        <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:color, opacity:0.07, filter:'blur(20px)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, background: isUp ? '#dcfce7' : '#fee2e2', color: isUp ? '#16a34a' : '#dc2626', fontSize:11, fontWeight:700 }}>
            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </div>
        </div>
        <div style={{ marginBottom:8 }}>
          <p style={{ fontSize:28, fontWeight:800, color:'var(--text-primary)', lineHeight:1, marginBottom:3 }}>{counted.toLocaleString()}</p>
          <p style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:500 }}>{label}</p>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
          <span style={{ fontSize:11, color:'var(--text-secondary)' }}>Last 30 days</span>
          <Sparkline data={sparkData} color={color} />
        </div>
      </div>
    </Link>
  );
}

/* ── Activity Item ── */
function ActivityItem({ icon: Icon, color, title, sub, time, delay = 0 }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, []);
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, opacity: vis?1:0, transform: vis?'none':'translateX(-8px)', transition:'opacity 0.35s ease, transform 0.35s ease' }}>
      <div style={{ width:32, height:32, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:1 }}>{title}</p>
        <p style={{ fontSize:11, color:'var(--text-secondary)' }}>{sub}</p>
      </div>
      <span style={{ fontSize:10, color:'var(--text-secondary)', flexShrink:0, marginTop:3 }}>{time}</span>
    </div>
  );
}

/* ── Donut chart ── */
function DonutChart({ segments, size = 130 }) {
  const r = 44, cx = size/2, cy = size/2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a,s) => a + s.value, 0) || 1;
  let offset = 0;
  const slices = segments.map(s => {
    const len = (s.value / total) * circ;
    const slice = { ...s, dash: `${len-2} ${circ-len+2}`, offset: circ - offset };
    offset += len;
    return slice;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s,i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={14}
          strokeDasharray={s.dash} strokeDashoffset={s.offset} strokeLinecap="round"
          style={{ transform:'rotate(-90deg)', transformOrigin:`${cx}px ${cy}px`, transition:'all 1s ease' }} />
      ))}
      <circle cx={cx} cy={cy} r={30} fill="var(--card-bg)" />
    </svg>
  );
}

/* ══ MAIN ══ */
export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teachers');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetIcon = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 0' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', border:'3px solid var(--surface-100)', borderTopColor:'#6366f1', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ fontSize:13, color:'var(--text-secondary)' }}>Loading dashboard…</p>
      </div>
    </div>
  );

  const counts = stats?.counts || {};

  const sparkTeachers = [8,10,9,11,10,12,11,13,12,counts.teachers||14];
  const sparkStudents = [180,195,210,205,220,215,230,225,240,counts.students||248];
  const sparkClasses  = [12,13,12,14,13,15,14,16,15,counts.classes||17];
  const sparkAssign   = [22,28,25,30,27,32,29,35,31,counts.assignments||38];

  const heroStats = [
    { icon:Users,         label:'Total Teachers', value:counts.teachers||0,    color:'#6366f1', bg:'#eef2ff', trend:12, sparkData:sparkTeachers, to:'/admin/teachers' },
    { icon:GraduationCap, label:'Total Students', value:counts.students||0,    color:'#10b981', bg:'#ecfdf5', trend:8,  sparkData:sparkStudents, to:'/admin/students' },
    { icon:BookOpen,      label:'Active Classes', value:counts.classes||0,     color:'#0ea5e9', bg:'#f0f9ff', trend:5,  sparkData:sparkClasses,  to:'/admin/classes'  },
    { icon:ClipboardList, label:'Assignments',    value:counts.assignments||0,  color:'#f59e0b', bg:'#fffbeb', trend:-3, sparkData:sparkAssign,  to:'/admin/classes'  },
  ];

  const donutSegments = [
    { label:'Teachers',    value:counts.teachers||1,    color:'#6366f1' },
    { label:'Students',    value:counts.students||1,    color:'#10b981' },
    { label:'Classes',     value:counts.classes||1,     color:'#0ea5e9' },
    { label:'Assignments', value:counts.assignments||1, color:'#f59e0b' },
  ];
  const donutTotal = donutSegments.reduce((a,s) => a+s.value, 0);

  const activityFeed = [
    { icon:GraduationCap, color:'#10b981', title:'New student enrolled',    sub:'Added to Science Class A',    time:'2m ago'  },
    { icon:Users,         color:'#6366f1', title:'Teacher profile updated', sub:'Dr. Johnson updated details', time:'18m ago' },
    { icon:BookOpen,      color:'#0ea5e9', title:'New class created',       sub:'Mathematics — Grade 10',      time:'1h ago'  },
    { icon:ClipboardList, color:'#f59e0b', title:'Assignment published',    sub:'32 students notified',        time:'2h ago'  },
    { icon:Megaphone,     color:'#ec4899', title:'Announcement sent',       sub:'School-wide notice',          time:'3h ago'  },
    { icon:FileText,      color:'#8b5cf6', title:'Document uploaded',       sub:'Curriculum Q2 PDF',           time:'5h ago'  },
  ];

  const systemHealth = [
    { label:'System Uptime',   pct:99, color:'#10b981' },
    { label:'Storage Used',    pct:43, color:'#6366f1' },
    { label:'Active Sessions', pct:72, color:'#0ea5e9' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* ── Hero Banner ── */}
      <div style={{ borderRadius:20, padding:'22px 26px', position:'relative', overflow:'hidden', background:'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)', boxShadow:'0 8px 32px rgba(99,102,241,0.35)' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, right:130, width:100, height:100, borderRadius:'50%', background:'rgba(139,92,246,0.15)', pointerEvents:'none' }} />
        <div style={{ position:'relative', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ padding:'4px 10px', borderRadius:99, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.15)', display:'flex', alignItems:'center', gap:5 }}>
                <Shield size={11} style={{ color:'#a5b4fc' }} />
                <span style={{ fontSize:10, fontWeight:700, color:'#a5b4fc', letterSpacing:'0.08em', textTransform:'uppercase' }}>Administrator</span>
              </div>
              <div style={{ padding:'3px 8px', borderRadius:99, background:'rgba(16,185,129,0.2)', border:'1px solid rgba(16,185,129,0.3)', display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#34d399', animation:'pulse 2s infinite' }} />
                <span style={{ fontSize:10, fontWeight:600, color:'#6ee7b7' }}>All systems normal</span>
              </div>
            </div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', marginBottom:5, lineHeight:1.2 }}>
              {greetIcon} {greeting}, {user?.name?.split(' ')[0]}!
            </h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.6)', maxWidth:360, lineHeight:1.6 }}>
              Here's what's happening across your institution today.
            </p>
          </div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {[
              { label:'Teachers', val:counts.teachers||0, color:'#a5b4fc', icon:Users },
              { label:'Students', val:counts.students||0, color:'#6ee7b7', icon:GraduationCap },
              { label:'Classes',  val:counts.classes||0,  color:'#7dd3fc', icon:BookOpen },
            ].map(({ label, val, color, icon:Ic }) => (
              <div key={label} style={{ textAlign:'center', padding:'10px 14px', borderRadius:14, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', minWidth:68 }}>
                <Ic size={13} style={{ color, margin:'0 auto 4px', display:'block' }} />
                <p style={{ fontSize:20, fontWeight:800, color:'#fff', lineHeight:1 }}>{val}</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:2 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.1)', display:'flex', gap:20, flexWrap:'wrap' }}>
          {[
            { label:'Documents', val:counts.documents||0,     icon:FileText,      color:'#c4b5fd' },
            { label:'Announcements', val:counts.announcements||0, icon:Megaphone, color:'#f9a8d4' },
            { label:'Assignments', val:counts.assignments||0, icon:ClipboardList, color:'#fcd34d' },
          ].map(({ label, val, icon:Ic, color }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:7 }}>
              <Ic size={12} style={{ color, opacity:0.9 }} />
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{label}</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))', gap:12 }}>
        {heroStats.map((s,i) => (
          <div key={s.label} style={{ animation:'slideUp 0.4s ease both', animationDelay:`${i*70}ms` }}>
            <HeroStat {...s} />
          </div>
        ))}
      </div>

      {/* ── Middle: People list + Donut ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:14 }}>

        {/* People list */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>People Overview</h3>
            <div style={{ display:'flex', gap:2, background:'var(--surface-100)', borderRadius:10, padding:3 }}>
              {['teachers','students'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:600, border:'none', cursor:'pointer', transition:'all 0.15s',
                  background: activeTab===tab ? 'var(--card-bg)' : 'transparent',
                  color: activeTab===tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab===tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  textTransform:'capitalize'
                }}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'teachers' && (
            <>
              {!stats?.recentTeachers?.length
                ? <p style={{ fontSize:13, color:'var(--text-secondary)', textAlign:'center', padding:'24px 0' }}>No teachers yet</p>
                : <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                    {stats.recentTeachers.map((t) => {
                      const classRow = stats?.classesByTeacher?.find(r => r.teacher_name === t.name);
                      return (
                        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 10px', borderRadius:12, transition:'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--surface-100)'}
                          onMouseLeave={e => e.currentTarget.style.background=''}
                        >
                          <Avatar name={t.name} size={38} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:1 }}>{t.name}</p>
                            <p style={{ fontSize:11, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.email}</p>
                          </div>
                          <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                            {classRow && <>
                              <span style={{ fontSize:11, padding:'2px 7px', borderRadius:6, background:'#eef2ff', color:'#4f46e5', fontWeight:600 }}>{classRow.class_count}cls</span>
                              <span style={{ fontSize:11, padding:'2px 7px', borderRadius:6, background:'#ecfdf5', color:'#059669', fontWeight:600 }}>{classRow.student_count}stu</span>
                            </>}
                            <span style={{ fontSize:10, color:'var(--text-secondary)', padding:'2px 0' }}>
                              {new Date(t.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--card-border)' }}>
                <Link to="/admin/teachers" style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#6366f1', textDecoration:'none' }}>
                  View all teachers <ArrowUpRight size={13} />
                </Link>
              </div>
            </>
          )}

          {activeTab === 'students' && (
            <>
              {!stats?.recentStudents?.length
                ? <p style={{ fontSize:13, color:'var(--text-secondary)', textAlign:'center', padding:'24px 0' }}>No students yet</p>
                : <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {stats.recentStudents.map(s => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, background:'var(--surface-100)', transition:'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform=''; }}
                      >
                        <Avatar name={s.name} size={34} />
                        <div style={{ minWidth:0 }}>
                          <p style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</p>
                          <div style={{ display:'flex', gap:3, marginTop:3, flexWrap:'wrap' }}>
                            {s.level && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:5, background:'#dbeafe', color:'#1d4ed8', fontWeight:600 }}>{s.level}</span>}
                            {s.trade && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:5, background:'#ffedd5', color:'#c2410c', fontWeight:600 }}>{s.trade}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--card-border)' }}>
                <Link to="/admin/students" style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'#6366f1', textDecoration:'none' }}>
                  View all students <ArrowUpRight size={13} />
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Donut */}
        <div className="card" style={{ display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Distribution</h3>
            <BarChart2 size={15} style={{ color:'var(--text-secondary)' }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
            <div style={{ position:'relative', marginBottom:14 }}>
              <DonutChart segments={donutSegments} size={130} />
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
                <p style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)', lineHeight:1 }}>{donutTotal}</p>
                <p style={{ fontSize:9, color:'var(--text-secondary)', fontWeight:500, marginTop:1 }}>TOTAL</p>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
              {donutSegments.map(s => (
                <div key={s.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:3, background:s.color, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--text-secondary)', flex:1 }}>{s.label}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{s.value}</span>
                  <span style={{ fontSize:10, color:'var(--text-secondary)', minWidth:28, textAlign:'right' }}>{Math.round((s.value/donutTotal)*100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>

        {/* Class performance */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Class Performance</h3>
            <Link to="/admin/classes" style={{ display:'flex', alignItems:'center', gap:2, fontSize:11, fontWeight:600, color:'#6366f1', textDecoration:'none' }}>
              All <ChevronRight size={12} />
            </Link>
          </div>
          {!stats?.classesByTeacher?.length
            ? <p style={{ fontSize:13, color:'var(--text-secondary)', textAlign:'center', padding:'24px 0' }}>No data yet</p>
            : <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {stats.classesByTeacher.slice(0,5).map((row,i) => {
                  const max = Math.max(...stats.classesByTeacher.map(r=>r.student_count),1);
                  const pct = Math.round((row.student_count/max)*100);
                  const colors = ['#6366f1','#10b981','#0ea5e9','#f59e0b','#ec4899'];
                  const c = colors[i%colors.length];
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, alignItems:'center' }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{row.teacher_name}</span>
                        <div style={{ display:'flex', gap:4, flexShrink:0, marginLeft:8 }}>
                          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:5, background:`${c}18`, color:c, fontWeight:700 }}>{row.class_count}cls</span>
                          <span style={{ fontSize:10, color:'var(--text-secondary)' }}>{row.student_count}stu</span>
                        </div>
                      </div>
                      <div style={{ height:6, borderRadius:99, background:'var(--surface-100)', overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background:`linear-gradient(90deg, ${c}cc, ${c})`, transition:'width 1s cubic-bezier(0.34,1.56,0.64,1)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Activity feed */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>Recent Activity</h3>
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:99, background:'#ecfdf5' }}>
              <Activity size={10} style={{ color:'#10b981' }} />
              <span style={{ fontSize:10, fontWeight:600, color:'#10b981' }}>Live</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {activityFeed.map((a,i) => <ActivityItem key={i} {...a} delay={i*80} />)}
          </div>
        </div>

        {/* System health */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>System Health</h3>
            <CheckCircle2 size={15} style={{ color:'#10b981' }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {systemHealth.map(({ label, pct, color }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <RadialRing pct={pct} color={color} size={52} stroke={5} />
                  <span style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:10, fontWeight:800, color:'var(--text-primary)' }}>{pct}%</span>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>{label}</p>
                  <div style={{ height:4, borderRadius:99, background:'var(--surface-100)' }}>
                    <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background:color, transition:'width 1.2s ease' }} />
                  </div>
                  <p style={{ fontSize:10, color:'var(--text-secondary)', marginTop:3 }}>{pct>=90?'Excellent':pct>=60?'Good':'Moderate'}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid var(--card-border)', display:'flex', flexDirection:'column', gap:5 }}>
            <p style={{ fontSize:10, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Quick Actions</p>
            {[
              { label:'Manage Teachers', to:'/admin/teachers', icon:Users,         color:'#6366f1' },
              { label:'Manage Students', to:'/admin/students', icon:GraduationCap, color:'#10b981' },
              { label:'View Classes',    to:'/admin/classes',  icon:BookOpen,       color:'#0ea5e9' },
            ].map(({ label, to, icon:Ic, color }) => (
              <Link key={to} to={to} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:10, textDecoration:'none', transition:'background 0.15s', background:'var(--surface-100)' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--card-border)'}
                onMouseLeave={e => e.currentTarget.style.background='var(--surface-100)'}
              >
                <Ic size={13} style={{ color }} />
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', flex:1 }}>{label}</span>
                <ChevronRight size={11} style={{ color:'var(--text-secondary)' }} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
