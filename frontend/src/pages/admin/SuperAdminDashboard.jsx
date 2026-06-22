import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Shield, Crown, Users, GraduationCap, BookOpen, TrendingUp,
  Activity, Zap, Globe, Server, Database, Network, Signal,
  CheckCircle, AlertCircle, Clock, ArrowUpRight, BarChart3,
  Star, Layers, Eye, RefreshCw, Mail, Calendar, Hash,
  PowerOff, Power, UserPlus, ChevronRight, Sparkles,
} from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────────────
const T = {
  gold: '#f59e0b',
  goldDark: '#d97706',
  goldGlass: 'rgba(245,158,11,0.10)',
  violet: '#8b5cf6',
  violetGlass: 'rgba(139,92,246,0.10)',
  indigo: '#6366f1',
  indigoGlass: 'rgba(99,102,241,0.10)',
  emerald: '#10b981',
  emeraldGlass: 'rgba(16,185,129,0.10)',
  sky: '#0ea5e9',
  skyGlass: 'rgba(14,165,233,0.10)',
  rose: '#f43f5e',
  roseGlass: 'rgba(244,63,94,0.10)',
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

  @keyframes shimmer {
    0% { background-position: -600px 0; }
    100% { background-position: 600px 0; }
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pulseRing {
    0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0.45); }
    70%  { box-shadow: 0 0 0 10px rgba(245,158,11,0); }
    100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
  }
  @keyframes float {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-5px); }
  }
  @keyframes orb-drift {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(30px,-20px) scale(1.05); }
    66%     { transform: translate(-20px,15px) scale(0.96); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes bar-fill {
    from { width: 0; }
  }
  .sa-card { animation: fadeUp 0.4s ease both; }
  .sa-shimmer {
    background: linear-gradient(90deg, var(--surface-100) 25%, var(--card-border) 50%, var(--surface-100) 75%);
    background-size: 600px 100%;
    animation: shimmer 1.5s ease infinite;
    border-radius: 10px;
  }
  .sa-bar-fill { animation: bar-fill 1s cubic-bezier(0.4,0,0.2,1) both; }
  .sa-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .sa-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.12) !important; }
`;

// ── Helpers ────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function AdminAvatar({ name, isActive, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: isActive
        ? `linear-gradient(135deg, ${T.indigo}, ${T.violet})`
        : 'linear-gradient(135deg,#6b7280,#4b5563)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Sora',sans-serif", fontWeight: 700,
      fontSize: size * 0.35, color: '#fff', letterSpacing: '-0.02em',
      boxShadow: isActive ? `0 4px 14px rgba(99,102,241,0.35)` : 'none',
    }}>
      {initials(name)}
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────
function Skeleton({ w, h, style = {} }) {
  return <div className="sa-shimmer" style={{ width: w, height: h, ...style }} />;
}

// ── Hero stat card ──────────────────────────────────────────────────────
function HeroStat({ label, value, sub, icon: Icon, color, colorGlass, index, trend }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    if (!value) return;
    const end = parseInt(value) || 0;
    const dur = 1200;
    const step = Math.ceil(end / (dur / 16));
    let cur = 0;
    const timer = setInterval(() => {
      cur = Math.min(cur + step, end);
      setDisplayed(cur);
      if (cur >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="sa-card sa-hover" style={{
      animationDelay: `${index * 80}ms`,
      background: 'var(--card-bg)',
      border: `1px solid ${color}25`,
      borderRadius: 20,
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 4px 20px ${color}10`,
    }}>
      {/* BG glow */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: colorGlass,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${color}25`,
        }}>
          <Icon size={20} color={color} />
        </div>
        {trend && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 700, color: T.emerald,
            background: T.emeraldGlass, padding: '3px 8px', borderRadius: 8,
            border: `1px solid ${T.emerald}25`,
          }}>
            <ArrowUpRight size={11} /> {trend}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: "'Sora',sans-serif", fontSize: 36, fontWeight: 800,
        color, lineHeight: 1, marginBottom: 4,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {displayed}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

// ── Admin row card ──────────────────────────────────────────────────────
function AdminRow({ admin, stats, index, onView, dark }) {
  const isActive = admin.is_active !== false;
  const tc = stats?.teacher_count ?? 0;
  const cc = stats?.class_count ?? 0;
  const sc = stats?.student_count ?? 0;

  return (
    <div className="sa-card sa-hover" style={{
      animationDelay: `${index * 60}ms`,
      padding: '1rem 1.25rem',
      background: 'var(--card-bg)',
      border: `1px solid ${isActive ? T.indigo + '20' : T.rose + '20'}`,
      borderRadius: 16,
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: 'pointer',
    }} onClick={() => onView(admin)}>
      <AdminAvatar name={admin.name} isActive={isActive} size={44} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700,
            color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{admin.name}</span>
          {admin.is_super_admin && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, fontWeight: 700,
              background: T.goldGlass, color: T.gold, border: `1px solid ${T.gold}30`,
              padding: '2px 7px', borderRadius: 6,
            }}>
              <Crown size={9} /> Super
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
            background: isActive ? T.emeraldGlass : T.roseGlass,
            color: isActive ? T.emerald : T.rose,
            border: `1px solid ${(isActive ? T.emerald : T.rose)}25`,
          }}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Mail size={10} /> {admin.email}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {[
          { icon: GraduationCap, val: tc, color: T.violet },
          { icon: BookOpen, val: cc, color: T.sky },
          { icon: Users, val: sc, color: T.emerald },
        ].map(({ icon: I, val, color }, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: `${color}0d`, border: `1px solid ${color}20`,
            borderRadius: 10, padding: '5px 10px', minWidth: 44,
          }}>
            <I size={11} color={color} />
            <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'Sora',sans-serif", lineHeight: 1.3 }}>{val}</span>
          </div>
        ))}
      </div>

      <ChevronRight size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
    </div>
  );
}

// ── Activity bar ────────────────────────────────────────────────────────
function ActivityBar({ label, value, max, color, delay }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'Space Mono',monospace" }}>{value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: 'var(--card-border)', overflow: 'hidden' }}>
        <div className="sa-bar-fill" style={{
          height: '100%', borderRadius: 99,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          width: `${pct}%`,
          animationDelay: `${delay}ms`,
        }} />
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [allStats, setAllStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const [ar, sr] = await Promise.all([
        api.get('/admin/admins'),
        api.get('/admin/admins/stats').catch(() => ({ data: { stats: [] } })),
      ]);
      setAdmins(ar.data.admins || []);
      setAllStats(sr.data.stats || []);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getStats = (id) => allStats.find(s =>
    s.admin_id === id || s.admin_id?.toString() === id?.toString()
  );

  const regularAdmins = admins.filter(a => !a.is_super_admin);
  const activeCount = regularAdmins.filter(a => a.is_active !== false).length;
  const inactiveCount = regularAdmins.filter(a => a.is_active === false).length;
  const totalTeachers = allStats.reduce((s, a) => s + (a.teacher_count ?? 0), 0);
  const totalClasses  = allStats.reduce((s, a) => s + (a.class_count ?? 0), 0);
  const totalStudents = allStats.reduce((s, a) => s + (a.student_count ?? 0), 0);

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Hero Header ──────────────────────────────────────────────── */}
        <div className="sa-card" style={{
          animationDelay: '0ms',
          marginBottom: 24,
          padding: '2rem 2.5rem',
          background: dark
            ? 'linear-gradient(135deg, #0f0c1a 0%, #1a1035 40%, #0d1a2e 100%)'
            : 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a5f 100%)',
          border: `1px solid ${T.gold}30`,
          borderRadius: 24,
          position: 'relative', overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(99,102,241,0.25)`,
        }}>
          {/* Animated orbs */}
          <div style={{
            position: 'absolute', top: -60, right: -60, width: 240, height: 240,
            borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
            animation: 'orb-drift 8s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: -40, left: 100, width: 180, height: 180,
            borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
            animation: 'orb-drift 11s ease-in-out infinite reverse',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, position: 'relative', zIndex: 1 }}>
            <div style={{ flex: 1 }}>
              {/* Crown badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(245,158,11,0.15)',
                border: `1px solid ${T.gold}40`,
                borderRadius: 10, padding: '5px 14px',
                marginBottom: 16,
              }}>
                <Crown size={14} color={T.gold} style={{ animation: 'float 3s ease-in-out infinite' }} />
                <span style={{
                  fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em',
                  color: T.gold, textTransform: 'uppercase', fontFamily: "'Space Mono',monospace",
                }}>Super Admin Control Center</span>
              </div>

              <h1 style={{
                fontFamily: "'Sora',sans-serif", fontSize: 30, fontWeight: 800,
                color: '#fff', lineHeight: 1.1, marginBottom: 8,
                letterSpacing: '-0.02em',
              }}>
                Welcome back,<br />
                <span style={{ color: T.gold }}>{user?.name?.split(' ')[0] || 'Admin'}</span>
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>
                Full platform oversight — manage, monitor, and control all admin workspaces from one place.
              </p>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/admin/admins')} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: T.gold, color: '#0f0c1a',
                  border: 'none', borderRadius: 11, padding: '9px 20px',
                  fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                  boxShadow: `0 4px 20px rgba(245,158,11,0.5)`,
                  fontFamily: "'Sora',sans-serif",
                  transition: 'all 0.15s',
                }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(245,158,11,0.6)'; }}
                   onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.5)'; }}>
                  <Users size={14} /> Manage Admins
                </button>
                <button onClick={() => load(true)} disabled={refreshing} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(255,255,255,0.08)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 11, padding: '9px 20px',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Sora',sans-serif",
                  transition: 'all 0.15s',
                }}>
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Live clock */}
            <div style={{
              textAlign: 'right', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
            }}>
              <div style={{
                padding: '16px 22px',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{
                  fontFamily: "'Space Mono',monospace", fontSize: 26, fontWeight: 700,
                  color: T.gold, letterSpacing: '0.06em', lineHeight: 1,
                  marginBottom: 6,
                }}>{timeStr}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'Sora',sans-serif" }}>
                  {dateStr}
                </div>
              </div>

              {/* Status dots */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end',
              }}>
                {[
                  { label: 'Platform Online', color: T.emerald },
                  { label: `${activeCount} Active Admins`, color: T.sky },
                ].map(({ label, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: color,
                      boxShadow: `0 0 6px ${color}`,
                      animation: 'pulseRing 2.5s infinite',
                    }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Hero Stats Row ───────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} h={130} style={{ borderRadius: 20 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
            <HeroStat index={0} label="Total Admins" value={regularAdmins.length} sub={`${activeCount} active · ${inactiveCount} inactive`}
              icon={Shield} color={T.indigo} colorGlass={T.indigoGlass} trend="+2 this week" />
            <HeroStat index={1} label="Active Admins" value={activeCount} sub="currently operational"
              icon={Activity} color={T.emerald} colorGlass={T.emeraldGlass} />
            <HeroStat index={2} label="Total Teachers" value={totalTeachers} sub="across all workspaces"
              icon={GraduationCap} color={T.violet} colorGlass={T.violetGlass} trend="Growing" />
            <HeroStat index={3} label="Total Classes" value={totalClasses} sub="platform-wide"
              icon={BookOpen} color={T.sky} colorGlass={T.skyGlass} />
            <HeroStat index={4} label="Total Students" value={totalStudents} sub="enrolled learners"
              icon={Users} color={T.gold} colorGlass={T.goldGlass} trend="+12% MoM" />
          </div>
        )}

        {/* ── Main content grid ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

          {/* Left: Admin list */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: T.indigoGlass, border: `1px solid ${T.indigo}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Shield size={15} color={T.indigo} />
                </div>
                <div>
                  <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Admin Workspaces
                  </h2>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                    Click any admin to view details
                  </p>
                </div>
              </div>
              <button onClick={() => navigate('/admin/admins')} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700,
                background: T.indigoGlass, color: T.indigo,
                border: `1px solid ${T.indigo}25`, borderRadius: 10,
                padding: '6px 14px', cursor: 'pointer',
              }}>
                View All <ArrowUpRight size={12} />
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={80} style={{ borderRadius: 16 }} />)}
              </div>
            ) : regularAdmins.length === 0 ? (
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 20, padding: '3rem', textAlign: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: T.indigoGlass, margin: '0 auto 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Shield size={24} color={T.indigo} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No admin accounts yet</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Create your first admin workspace
                </p>
                <button onClick={() => navigate('/admin/admins')} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: T.indigo, color: '#fff',
                  border: 'none', borderRadius: 11, padding: '10px 22px',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                }}>
                  <UserPlus size={14} /> Create Admin
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {regularAdmins.slice(0, 8).map((admin, i) => (
                  <AdminRow
                    key={admin.id}
                    admin={admin}
                    stats={getStats(admin.id)}
                    index={i}
                    dark={dark}
                    onView={() => navigate('/admin/admins')}
                  />
                ))}
                {regularAdmins.length > 8 && (
                  <button onClick={() => navigate('/admin/admins')} style={{
                    width: '100%', padding: '12px', borderRadius: 14,
                    border: `1px dashed ${T.indigo}40`,
                    background: T.indigoGlass, color: T.indigo,
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    View {regularAdmins.length - 8} more admins <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Analytics panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Platform Health */}
            <div className="sa-card" style={{
              animationDelay: '200ms',
              background: 'var(--card-bg)',
              border: `1px solid ${T.violet}20`,
              borderRadius: 20, padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Zap size={15} color={T.violet} />
                <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Platform Health
                </span>
              </div>

              {loading ? (
                <>
                  <Skeleton h={14} w="80%" style={{ marginBottom: 12 }} />
                  <Skeleton h={14} w="65%" style={{ marginBottom: 12 }} />
                  <Skeleton h={14} w="75%" />
                </>
              ) : (
                <>
                  <ActivityBar label="Admin Activation Rate" value={activeCount} max={Math.max(regularAdmins.length,1)} color={T.emerald} delay={0} />
                  <ActivityBar label="Teacher Coverage" value={totalTeachers} max={Math.max(totalTeachers,1)} color={T.violet} delay={100} />
                  <ActivityBar label="Class-to-Student Ratio" value={totalStudents} max={Math.max(totalStudents,1)} color={T.sky} delay={200} />
                  <ActivityBar label="Platform Utilization" value={totalClasses} max={Math.max(totalClasses,1)} color={T.gold} delay={300} />
                </>
              )}

              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: T.emeraldGlass, border: `1px solid ${T.emerald}25`,
                borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <CheckCircle size={14} color={T.emerald} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: T.emerald }}>
                  All systems operational
                </span>
              </div>
            </div>

            {/* Workspace Distribution */}
            <div className="sa-card" style={{
              animationDelay: '280ms',
              background: 'var(--card-bg)',
              border: `1px solid ${T.sky}20`,
              borderRadius: 20, padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <BarChart3 size={15} color={T.sky} />
                <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Resource Distribution
                </span>
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3].map(i => <Skeleton key={i} h={54} style={{ borderRadius: 12 }} />)}
                </div>
              ) : regularAdmins.slice(0, 4).map((admin, i) => {
                const st = getStats(admin.id);
                const sc = st?.student_count ?? 0;
                const max = Math.max(...regularAdmins.map(a => getStats(a.id)?.student_count ?? 0), 1);
                const pct = Math.round((sc / max) * 100);
                return (
                  <div key={admin.id} style={{
                    marginBottom: 10, padding: '10px 12px',
                    background: 'var(--surface-100)', borderRadius: 12,
                    border: '1px solid var(--card-border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <AdminAvatar name={admin.name} isActive={admin.is_active !== false} size={24} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {admin.name}
                      </span>
                      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, color: T.sky }}>
                        {sc}
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--card-border)', overflow: 'hidden' }}>
                      <div className="sa-bar-fill" style={{
                        height: '100%', borderRadius: 99,
                        background: `linear-gradient(90deg, ${T.sky}, ${T.violet})`,
                        width: `${pct}%`,
                        animationDelay: `${i * 100}ms`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Super Admin Profile card */}
            <div className="sa-card" style={{
              animationDelay: '360ms',
              background: dark
                ? 'linear-gradient(135deg, #0f0c1a, #1a1035)'
                : 'linear-gradient(135deg, #fef9ee, #fff8e1)',
              border: `1px solid ${T.gold}35`,
              borderRadius: 20, padding: '1.25rem',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 100, height: 100, borderRadius: '50%',
                background: `radial-gradient(circle, ${T.gold}15 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 14, flexShrink: 0,
                  background: T.goldGlass, border: `1px solid ${T.gold}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'pulseRing 3s infinite',
                }}>
                  <Crown size={18} color={T.gold} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: T.gold }}>
                    {user?.name || 'Super Admin'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: "'Space Mono',monospace" }}>
                    SYSTEM ADMINISTRATOR
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Mail size={10} /> {user?.email}
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              }}>
                {[
                  { label: 'Role', val: 'Super Admin', color: T.gold },
                  { label: 'Admins', val: regularAdmins.length, color: T.indigo },
                  { label: 'Active', val: activeCount, color: T.emerald },
                  { label: 'Inactive', val: inactiveCount, color: T.rose },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{
                    background: `${color}0d`, border: `1px solid ${color}20`,
                    borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "'Sora',sans-serif" }}>{val}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
