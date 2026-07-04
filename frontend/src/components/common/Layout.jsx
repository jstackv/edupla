import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMaintenance } from '../../context/MaintenanceContext';
import { ChatNotifyProvider } from '../../context/ChatNotifyContext';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, BookOpen, Users, FileText, ClipboardList,
  Megaphone, LogOut, Sun, Moon, ChevronRight, ChevronLeft,
  GraduationCap, BookMarked, Notebook, Shield, UserCheck,
  UserCircle, Settings, Bell, Search, Home,
  Layers, UserPlus, AlertTriangle, X, Crown,
} from 'lucide-react';
import NotificationPanel from './NotificationPanel';

/* ─── NAV DEFINITIONS ───────────────────────────────────────────── */
const TeacherLinks = [
  { to: '/teacher/dashboard',        icon: LayoutDashboard, label: 'Dashboard',     section: 'main' },
  { to: '/teacher/classes',          icon: BookOpen,        label: 'My Classes',    section: 'main' },
  { to: '/teacher/students',         icon: Users,           label: 'Students',      section: 'main' },
  { to: '/teacher/documents',        icon: FileText,        label: 'Documents',     section: 'manage' },
  { to: '/teacher/assignments',      icon: ClipboardList,   label: 'Assignments',   section: 'manage' },
  { to: '/teacher/assessments-grade',icon: BookMarked,      label: 'Marks Recording',   section: 'manage' },
  { to: '/teacher/announcements',    icon: Megaphone,       label: 'Announcements', section: 'manage' },
  { to: '/teacher/groups',           icon: Users,           label: 'Groups',         section: 'manage' },
];
const StudentLinks = [
  { to: '/student/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     section: 'main' },
  { to: '/student/classes',       icon: BookMarked,      label: 'My Classes',    section: 'main' },
  { to: '/student/documents',     icon: Notebook,        label: 'Notes & Docs',  section: 'manage' },
  { to: '/student/assignments',   icon: ClipboardList,   label: 'Assignments',   section: 'manage' },
  { to: '/student/announcements', icon: Megaphone,       label: 'Announcements', section: 'manage' },
  { to: '/student/groups',        icon: Users,           label: 'My Groups',      section: 'manage' },
];
const AdminLinks = [
  { to: '/admin/dashboard',   icon: LayoutDashboard, label: 'Dashboard',     section: 'main' },
  { to: '/admin/teachers',    icon: UserCheck,       label: 'Teachers',      section: 'main' },
  { to: '/admin/classes',     icon: BookOpen,        label: 'Classes',       section: 'main' },
  { to: '/admin/students',    icon: GraduationCap,   label: 'Students',      section: 'main' },
  { to: '/admin/assessments', icon: BookMarked,      label: 'Manage Modules',   section: 'manage' },
  { to: '/admin/settings',    icon: GraduationCap,   label: 'Manage TVET Info',        section: 'manage' },
];
const SuperAdminLinks = [
  { to: '/admin/dashboard',   icon: LayoutDashboard, label: 'Overview',      section: 'main' },
  { to: '/admin/admins',      icon: Shield,          label: 'Manage Admins', section: 'main' },
  { to: '/admin/maintenance', icon: AlertTriangle,   label: 'System Status', section: 'main' },
];

/* ─── HELPERS ───────────────────────────────────────────────────── */
const AVATAR_GRADIENTS = [
  ['#6366f1','#4338ca'], ['#0ea5e9','#0284c7'], ['#10b981','#059669'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#8b5cf6','#7c3aed'],
];
function getAvatarGradient(name) {
  if (!name) return AVATAR_GRADIENTS[0];
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}
const ROLE_LABEL = { teacher: 'Teacher Portal', student: 'Student Portal', admin: 'Admin Portal' };
const ROLE_BADGE_COLOR = { teacher: '#6366f1', student: '#10b981', admin: '#8b5cf6' };

/* ══════════════════════════════════════════════════════════════════
   LOGOUT CONFIRMATION MODAL
══════════════════════════════════════════════════════════════════ */
function LogoutModal({ open, onConfirm, onCancel, dark, userName }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      animation: 'fadeInOverlay 0.18s ease',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUpModal  { from { opacity: 0; transform: translateY(18px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes pulseRing { 0%,100% { transform: scale(1); opacity: 0.6 } 50% { transform: scale(1.15); opacity: 0.2 } }
      `}</style>
      <div style={{
        width: 400, borderRadius: 24,
        background: dark ? '#141720' : '#ffffff',
        border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`,
        boxShadow: dark
          ? '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
          : '0 32px 80px rgba(0,0,0,0.18)',
        animation: 'slideUpModal 0.22s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
      }}>
        {/* Top accent strip */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,#f87171,#ef4444,#dc2626)' }} />

        <div style={{ padding: '32px 32px 28px' }}>
          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: -8, borderRadius: '50%',
                background: 'rgba(239,68,68,0.12)',
                animation: 'pulseRing 2.5s ease-in-out infinite',
              }} />
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))',
                border: '1.5px solid rgba(239,68,68,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <LogOut size={26} color="#ef4444" />
              </div>
            </div>
          </div>

          {/* Text */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h3 style={{
              margin: '0 0 8px',
              fontFamily: "'Sora', sans-serif",
              fontSize: 20, fontWeight: 800,
              color: dark ? '#f1f5f9' : '#0f172a',
              letterSpacing: '-0.02em',
            }}>
              Sign out of EDUPLA?
            </h3>
            <p style={{
              margin: 0, fontSize: 13.5,
              color: dark ? '#64748b' : '#6b7280',
              lineHeight: 1.6,
            }}>
              {userName ? `${userName}, you'll` : "You'll"} need to sign in again to access your account and continue where you left off.
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, height: 44, borderRadius: 12,
                border: `1.5px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                background: dark ? '#1a1f2e' : '#f9fafb',
                color: dark ? '#94a3b8' : '#6b7280',
                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = dark ? '#222840' : '#f3f4f6';
                e.currentTarget.style.color = dark ? '#e2e8f0' : '#374151';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = dark ? '#1a1f2e' : '#f9fafb';
                e.currentTarget.style.color = dark ? '#94a3b8' : '#6b7280';
              }}
            >
              Stay signed in
            </button>
            <button
              onClick={onConfirm}
              style={{
                flex: 1, height: 44, borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff',
                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #f87171, #ef4444)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(239,68,68,0.45)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(239,68,68,0.35)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <LogOut size={14} />
              Yes, sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   USER DROPDOWN (top-right)
══════════════════════════════════════════════════════════════════ */
function UserDropdown({ user, dark, from, to, initials, onLogoutClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const roleColor = ROLE_BADGE_COLOR[user?.role] || '#6366f1';

  const menuItems = [
    { icon: UserCircle, label: 'View Profile',    sub: 'Edit your personal info',   action: () => { navigate('/profile');  setOpen(false); } },
    { icon: Settings,   label: 'Settings',         sub: 'Password, appearance',       action: () => { navigate('/settings'); setOpen(false); } },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 10px 4px 5px',
          borderRadius: 12,
          border: `1.5px solid ${open ? '#6366f1' : (dark ? '#1e2130' : '#e5e7eb')}`,
          background: open ? (dark ? '#1d2235' : '#f3f4f6') : (dark ? '#181c27' : '#f9fafb'),
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.background = dark ? '#1d2235' : '#f3f4f6';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = dark ? '#1e2130' : '#e5e7eb';
            e.currentTarget.style.background = dark ? '#181c27' : '#f9fafb';
          }
        }}
      >
        {/* Avatar */}
        {user?.role === 'admin' ? (
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Shield size={13} color="#fff" />
          </div>
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg,${from},${to})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, color: '#fff',
            boxShadow: `0 2px 6px ${from}55`,
          }}>
            {initials}
          </div>
        )}

        {/* Name + role */}
        <div style={{ textAlign: 'left', display: 'none' }} className="topbar-user-text">
          <p style={{ fontSize: 12, fontWeight: 600, color: dark ? '#e8ecf4' : '#111827', lineHeight: 1.1, margin: 0 }}>{user?.name?.split(' ')[0]}</p>
          <p style={{ fontSize: 10, color: roleColor, fontWeight: 600, textTransform: 'capitalize', margin: 0 }}>{user?.role}</p>
        </div>

        {/* Chevron */}
        <ChevronRight size={11} color={dark ? '#4a5168' : '#9ca3af'} style={{ transform: open ? 'rotate(90deg)' : 'rotate(90deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 240, borderRadius: 16,
          background: dark ? '#141720' : '#ffffff',
          border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`,
          boxShadow: dark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.12)',
          zIndex: 1000,
          animation: 'dropdownIn 0.16s cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden',
        }}>
          <style>{`@keyframes dropdownIn { from { opacity:0; transform:translateY(-6px) scale(0.98) } to { opacity:1; transform:translateY(0) scale(1) } }`}</style>

          {/* User identity header */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: `1px solid ${dark ? '#1e2535' : '#f1f5f9'}`,
            background: dark ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {user?.role === 'admin' ? (
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
                  <Shield size={17} color="#fff" />
                </div>
              ) : (
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: `linear-gradient(135deg,${from},${to})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: '#fff',
                  boxShadow: `0 4px 12px ${from}55`,
                }}>
                  {initials}
                </div>
              )}
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: dark ? '#e8ecf4' : '#111827', fontFamily: "'Sora',sans-serif" }}>{user?.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: dark ? '#4a5168' : '#9ca3af', marginTop: 1 }}>{user?.email}</p>
              </div>
            </div>
            <div style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20,
              background: `${roleColor}18`, border: `1px solid ${roleColor}30`,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {user?.is_super_admin ? 'Super Admin' : user?.role}
              </span>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '8px 8px' }}>
            {menuItems.map(({ icon: Icon, label, sub, action }) => (
              <button key={label} onClick={action} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 10px', borderRadius: 10, border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.12s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? '#1d2235' : '#f8faff'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: dark ? '#1a1f2e' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={dark ? '#7b839a' : '#6b7280'} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: dark ? '#e2e8f0' : '#111827' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: dark ? '#4a5168' : '#9ca3af' }}>{sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: dark ? '#1e2535' : '#f1f5f9', margin: '0 8px' }} />

          {/* Sign out */}
          <div style={{ padding: '8px 8px 10px' }}>
            <button
              onClick={() => { setOpen(false); onLogoutClick(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 10px', borderRadius: 10, border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <LogOut size={15} color="#ef4444" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>Sign out</p>
                <p style={{ margin: 0, fontSize: 11, color: dark ? '#4a5168' : '#9ca3af' }}>End your current session</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LAYOUT
══════════════════════════════════════════════════════════════════ */
export default function Layout({ children }) {
  const { user, logout, endImpersonation } = useAuth();
  const isImpersonating = user?.impersonation_session === true && !!user?.impersonated_by;
  const { dark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const links = user?.role === 'teacher' ? TeacherLinks
    : user?.role === 'admin'   ? (user?.is_super_admin ? SuperAdminLinks : AdminLinks)
    : StudentLinks;

  const mainLinks   = links.filter(l => l.section === 'main');
  const manageLinks = links.filter(l => l.section === 'manage');

  const [from, to] = getAvatarGradient(user?.name);
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const currentLink = links.find(l => l.to === location.pathname);
  const pageTitle =
    location.pathname === '/profile'  ? 'Profile'  :
    location.pathname === '/settings' ? 'Settings' :
    location.pathname === '/teacher/assessments-grade' ? 'Assessments' :
    location.pathname === '/admin/assessments' ? 'Assessments' :
    location.pathname === '/teacher/groups' ? 'Groups' :
    location.pathname === '/student/groups' ? 'My Groups' :
    currentLink?.label || 'Dashboard';

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  const isSuperAdmin = user?.is_super_admin;
  const { maintenance } = useMaintenance() || {};

  /* ── SUPER ADMIN SIDEBAR ──────────────────────────────────────────── */
  const SuperAdminSidebarContent = ({ onNav }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'linear-gradient(180deg, #0f0c1a 0%, #140e24 50%, #0d1520 100%)',
      overflow: 'hidden', position: 'relative',
    }}>
      <style>{`
        @keyframes sa-glow { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes sa-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
      `}</style>

      {/* BG orb decoration */}
      <div style={{
        position: 'absolute', top: 60, left: -40, width: 160, height: 160,
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
        animation: 'sa-glow 4s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: 120, right: -30, width: 120, height: 120,
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        animation: 'sa-glow 6s ease-in-out infinite reverse',
      }} />

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px', height: 52, flexShrink: 0,
        borderBottom: '1px solid rgba(245,158,11,0.12)',
      }}>
        <div style={{
          width: 34, height: 34, flexShrink: 0, borderRadius: 10,
          background: 'linear-gradient(135deg,#f59e0b,#d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(245,158,11,0.4)',
        }}>
          <GraduationCap size={17} color="#0f0c1a" />
        </div>
        <div style={{
          overflow: 'hidden', whiteSpace: 'nowrap',
          transition: 'opacity 0.26s ease, width 0.26s ease',
          opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 160,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.06em' }}>EDUPLA</p>
          <span style={{ fontSize: 9, color: 'rgba(245,158,11,0.5)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Super Admin
          </span>
        </div>
      </div>

      {/* Crown user chip */}
      <Link to="/profile" onClick={onNav} style={{
        margin: '10px 10px 0', padding: '9px 10px',
        background: 'rgba(245,158,11,0.07)',
        border: '1px solid rgba(245,158,11,0.18)',
        borderRadius: 12, display: 'flex', alignItems: 'center', gap: 9,
        textDecoration: 'none', overflow: 'hidden', transition: 'background 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.12)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.07)'}
      >
        <div style={{
          width: 32, height: 32, flexShrink: 0, borderRadius: 9,
          background: 'linear-gradient(135deg,#f59e0b,#d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 10px rgba(245,158,11,0.35)',
        }}>
          <Crown size={14} color="#0f0c1a" style={{ animation: 'sa-float 3s ease-in-out infinite' }} />
        </div>
        <div style={{
          flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap',
          transition: 'opacity 0.26s ease, width 0.26s ease',
          opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 999,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{user?.name}</p>
          <span style={{ fontSize: 9, color: 'rgba(245,158,11,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Super Administrator
          </span>
        </div>
        {!collapsed && (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0, boxShadow: '0 0 6px #10b981' }} />
        )}
      </Link>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', scrollbarWidth: 'none' }}>
        <div style={{
          padding: collapsed ? '10px 14px 0' : '12px 14px 4px',
          fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
          color: 'rgba(245,158,11,0.4)', textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden',
          transition: 'opacity 0.26s ease, height 0.26s ease',
          opacity: collapsed ? 0 : 1, height: collapsed ? 0 : 'auto',
          pointerEvents: collapsed ? 'none' : 'auto',
          fontFamily: "'Space Mono',monospace",
        }}>
          Control
        </div>
        {SuperAdminLinks.map(link => (
          <SuperAdminNavItem key={link.to} link={link} location={location} collapsed={collapsed} onNav={onNav} />
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: 8, borderTop: '1px solid rgba(245,158,11,0.10)', flexShrink: 0 }}>
        <SuperAdminNavItem link={{ to: '/profile', icon: UserCircle, label: 'Profile' }} location={location} collapsed={collapsed} onNav={onNav} />
        <SuperAdminNavItem link={{ to: '/settings', icon: Settings, label: 'Settings' }} location={location} collapsed={collapsed} onNav={onNav} />
        <button
          onClick={() => setShowLogoutModal(true)}
          title={collapsed ? 'Sign Out' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 10, border: 'none', background: 'transparent',
            cursor: 'pointer', color: '#f87171', fontSize: 12.5, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          <span style={{ transition: 'opacity 0.26s ease, width 0.26s ease', opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Sign Out
          </span>
        </button>
      </div>
    </div>
  );

  /* Sidebar shared content */
  const SidebarContent = ({ onNav }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: dark ? '#13161f' : '#ffffff', overflow: 'hidden' }}>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px', height: 52, flexShrink: 0,
        borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
      }}>
        <div style={{
          width: 34, height: 34, flexShrink: 0, borderRadius: 10,
          background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px rgba(99,102,241,0.3)',
        }}>
          <GraduationCap size={17} color="#fff" />
        </div>
        <div style={{
          overflow: 'hidden', whiteSpace: 'nowrap',
          transition: 'opacity 0.26s ease, width 0.26s ease',
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : 160,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: dark ? '#e8ecf4' : '#111827', letterSpacing: '0.06em' }}>EDUPLA</p>
          <span style={{ fontSize: 10, color: dark ? '#4a5168' : '#9ca3af', fontWeight: 500 }}>{ROLE_LABEL[user?.role] || 'Portal'}</span>
        </div>
      </div>

      {/* User chip */}
      <Link to="/profile" onClick={onNav} style={{
        margin: '10px 10px 0', padding: '9px 10px',
        background: dark ? '#181c27' : '#f9fafb',
        border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
        borderRadius: 12, display: 'flex', alignItems: 'center', gap: 9,
        textDecoration: 'none', overflow: 'hidden', transition: 'background 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = dark ? '#1d2235' : '#f3f4f6'}
        onMouseLeave={e => e.currentTarget.style.background = dark ? '#181c27' : '#f9fafb'}
      >
        {user?.role === 'admin' ? (
          <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 9, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={14} color="#fff" />
          </div>
        ) : (
          <div style={{
            width: 32, height: 32, flexShrink: 0, borderRadius: 9,
            background: `linear-gradient(135deg,${from},${to})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, color: '#fff',
          }}>
            {initials}
          </div>
        )}
        <div style={{
          flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap',
          transition: 'opacity 0.26s ease, width 0.26s ease',
          opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 999,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: dark ? '#e8ecf4' : '#111827' }}>{user?.name}</p>
          <span style={{ fontSize: 10, color: dark ? '#4a5168' : '#9ca3af', fontWeight: 500 }}>{user?.email}</span>
        </div>
        {!collapsed && (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: ROLE_BADGE_COLOR[user?.role] || '#6366f1', flexShrink: 0, boxShadow: `0 0 5px ${ROLE_BADGE_COLOR[user?.role] || '#6366f1'}` }} />
        )}
      </Link>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', scrollbarWidth: 'none' }}>
        <SectionLabel label="Main Menu" collapsed={collapsed} dark={dark} />
        {mainLinks.map(link => (
          <NavItem key={link.to} link={link} location={location} collapsed={collapsed} dark={dark} onNav={onNav} />
        ))}
        {manageLinks.length > 0 && (
          <>
            <SectionLabel label="Management" collapsed={collapsed} dark={dark} />
            {manageLinks.map(link => (
              <NavItem key={link.to} link={link} location={location} collapsed={collapsed} dark={dark} onNav={onNav} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div style={{ padding: 8, borderTop: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`, flexShrink: 0 }}>
        <NavItem link={{ to: '/profile', icon: UserCircle, label: 'Profile' }} location={location} collapsed={collapsed} dark={dark} onNav={onNav} />
        <NavItem link={{ to: '/settings', icon: Settings, label: 'Settings' }} location={location} collapsed={collapsed} dark={dark} onNav={onNav} />
        <button
          onClick={() => setShowLogoutModal(true)}
          title={collapsed ? 'Sign Out' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 10, border: 'none', background: 'transparent',
            cursor: 'pointer', color: '#f87171', fontSize: 12.5, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', transition: 'background 0.15s', position: 'relative',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          <span style={{ transition: 'opacity 0.26s ease, width 0.26s ease', opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Sign Out
          </span>
          {collapsed && (
            <span className="nav-tooltip" style={{
              position: 'absolute', left: 'calc(100% - 6px)', top: '50%', transform: 'translateY(-50%)',
              background: dark ? '#1d2235' : '#ffffff', border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
              color: '#f87171', fontSize: 12, fontWeight: 500, padding: '5px 10px',
              borderRadius: 8, whiteSpace: 'nowrap', opacity: 0, pointerEvents: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 100, transition: 'opacity 0.15s',
            }}>Sign Out</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <ChatNotifyProvider>
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: 'DM Sans', sans-serif; }
        .edupla-layout { display: flex; height: 100vh; overflow: hidden; background: ${dark ? '#0f1117' : '#f4f5f7'}; }
        .edupla-sidebar {
          flex-shrink: 0; height: 100%;
          border-right: 1px solid ${isSuperAdmin ? 'rgba(245,158,11,0.15)' : (dark ? '#1e2130' : '#e5e7eb')};
          position: relative; z-index: 10;
          transition: width 0.26s cubic-bezier(.4,0,.2,1);
          overflow: visible;
          width: ${collapsed ? '64px' : '240px'};
        }
        .collapse-btn {
          position: absolute; top: 14px; right: -12px;
          width: 24px; height: 24px;
          background: ${dark ? '#1d2235' : '#ffffff'};
          border: 1px solid ${dark ? '#1e2130' : '#e5e7eb'};
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 20; transition: background 0.15s, border-color 0.15s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .collapse-btn:hover { background: #6366f1 !important; border-color: #6366f1 !important; }
        .collapse-btn:hover svg { color: #fff !important; }
        .nav-tooltip { display: none !important; }
        ${collapsed ? `.nav-item-wrap:hover .nav-tooltip { display: flex !important; opacity: 1 !important; pointer-events: none !important; }` : ''}
        .mobile-overlay { display: none; }
        @media (max-width: 1023px) { .edupla-sidebar { display: none !important; } .mobile-overlay { display: block; } }
        nav::-webkit-scrollbar { display: none; }
        @keyframes edupla-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @media (min-width: 768px) { .topbar-user-text { display: block !important; } }

        /* PRINT: the shell below normally locks itself to the viewport
           height (100vh) with overflow:hidden so the app never scrolls as a
           whole page — only .edupla-main scrolls internally. That's correct
           on screen, but during printing it clips everything to a single
           sheet and crushes multi-page content (e.g. reports) into one
           page. Reset the shell to flow naturally so print/PDF output can
           span as many physical pages as the content needs. */
        @media print {
          .edupla-layout, .edupla-content-col, .edupla-main {
            display: block !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .edupla-sidebar, .mobile-overlay, .edupla-topbar { display: none !important; }
        }
      `}</style>

      <LogoutModal
        open={showLogoutModal}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutModal(false)}
        dark={dark}
        userName={user?.name?.split(' ')[0]}
      />

      <div className="edupla-layout">
        {/* DESKTOP SIDEBAR */}
        <div className="edupla-sidebar">
          <div className="collapse-btn" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={11} color={isSuperAdmin ? '#f59e0b' : (dark ? '#7b839a' : '#6b7280')} /> : <ChevronLeft size={11} color={isSuperAdmin ? '#f59e0b' : (dark ? '#7b839a' : '#6b7280')} />}
          </div>
          {isSuperAdmin ? <SuperAdminSidebarContent onNav={() => {}} /> : <SidebarContent onNav={() => {}} />}
        </div>

        {/* MOBILE OVERLAY */}
        <div className="mobile-overlay">
          {mobileOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={() => setMobileOpen(false)} />
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 240, boxShadow: '4px 0 32px rgba(0,0,0,0.4)' }}>
                {isSuperAdmin ? <SuperAdminSidebarContent onNav={() => setMobileOpen(false)} /> : <SidebarContent onNav={() => setMobileOpen(false)} />}
              </div>
            </div>
          )}
        </div>

        {/* MAIN */}
        <div className="edupla-content-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* TOPBAR */}
          <header className="edupla-topbar" style={{
            height: 52, flexShrink: 0,
            background: dark ? '#13161f' : '#ffffff',
            borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
          }}>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(o => !o)} style={{
              display: 'none', width: 32, height: 32, borderRadius: 9,
              background: dark ? '#181c27' : '#f9fafb',
              border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }} className="mobile-hamburger">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? '#7b839a' : '#6b7280'} strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <Home size={12} color={dark ? '#4a5168' : '#9ca3af'} />
              <ChevronRight size={10} color={dark ? '#4a5168' : '#9ca3af'} />
              <span style={{ fontSize: 12, color: isSuperAdmin ? '#f59e0b' : (dark ? '#7b839a' : '#6b7280'), fontWeight: isSuperAdmin ? 700 : 500 }}>
                {isSuperAdmin ? 'Super Admin' : (ROLE_LABEL[user?.role] || 'Portal')}
              </span>
              <ChevronRight size={10} color={dark ? '#4a5168' : '#9ca3af'} />
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: dark ? '#e8ecf4' : '#111827' }}>{pageTitle}</span>
            </div>

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: dark ? '#181c27' : '#f9fafb',
                border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
                borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                onMouseLeave={e => e.currentTarget.style.borderColor = dark ? '#1e2130' : '#e5e7eb'}
              >
                <Search size={13} color={dark ? '#4a5168' : '#9ca3af'} />
                <span style={{ fontSize: 12, color: dark ? '#4a5168' : '#9ca3af' }}>Search…</span>
                <kbd style={{ fontSize: 9.5, color: dark ? '#4a5168' : '#9ca3af', background: dark ? '#1d2235' : '#f3f4f6', border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`, borderRadius: 4, padding: '1px 4px' }}>⌘K</kbd>
              </div>

              {/* Notifications */}
              <NotificationPanel dark={dark} />

              {/* Theme */}
              <TopbarIconBtn dark={dark} title={dark ? 'Switch to Light' : 'Switch to Dark'} onClick={toggleTheme}>
                {dark ? <Sun size={14} color={dark ? '#7b839a' : '#6b7280'} /> : <Moon size={14} color={dark ? '#7b839a' : '#6b7280'} />}
              </TopbarIconBtn>

              <div style={{ width: 1, height: 20, background: dark ? '#1e2130' : '#e5e7eb' }} />

              {/* User Dropdown */}
              <UserDropdown
                user={user}
                dark={dark}
                from={from}
                to={to}
                initials={initials}
                onLogoutClick={() => setShowLogoutModal(true)}
              />
            </div>
          </header>

          {/* Impersonation banner — shown in THIS tab only, for the whole
              duration of the impersonation session, so it's never unclear
              which tab is "really" the super admin vs. the impersonated user. */}
          {isImpersonating && (
            <div style={{
              padding: '8px 18px', flexShrink: 0,
              background: 'rgba(124,58,237,0.12)',
              borderBottom: '1px solid rgba(124,58,237,0.3)',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 600, color: '#7c3aed',
            }}>
            <UserCheck size={14} />
            Viewing as {user?.name} ({user?.role}) — impersonation session, expires in 2 hours.
            <button
              onClick={endImpersonation}
              style={{
                marginLeft: 'auto', padding: '3px 10px', borderRadius: 7,
                border: '1px solid rgba(124,58,237,0.4)', background: 'transparent',
                color: '#7c3aed', fontWeight: 700, fontSize: 11.5, cursor: 'pointer',
              }}
            >
              End session
            </button>
            </div>
          )}

          {/* Maintenance mode reminder — only shown to the super admin while it's active */}
          {isSuperAdmin && maintenance?.enabled && (
            <div style={{
              padding: '8px 18px', flexShrink: 0,
              background: 'rgba(245,158,11,0.12)',
              borderBottom: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 600, color: '#d97706',
            }}>
              <AlertTriangle size={14} />
              Maintenance mode is active — everyone else is seeing the maintenance screen.
              <Link to="/admin/maintenance" style={{ marginLeft: 'auto', color: '#d97706', fontWeight: 700, textDecoration: 'underline' }}>
                Manage
              </Link>
            </div>
          )}

          {/* PAGE CONTENT */}
          <main className="edupla-main" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: dark ? '#0f1117' : '#f4f5f7' }}>
            {children}
          </main>
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) { .mobile-hamburger { display: flex !important; } }
      `}</style>
    </>
    </ChatNotifyProvider>
  );
}

/* ── SUB-COMPONENTS ─────────────────────────────────────────────── */
function SectionLabel({ label, collapsed, dark }) {
  return (
    <div style={{
      padding: collapsed ? '10px 14px 0' : '14px 14px 4px',
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
      color: dark ? '#4a5168' : '#9ca3af', textTransform: 'uppercase',
      whiteSpace: 'nowrap', overflow: 'hidden',
      transition: 'opacity 0.26s ease, height 0.26s ease, padding 0.26s ease',
      opacity: collapsed ? 0 : 1, height: collapsed ? 0 : 'auto',
      pointerEvents: collapsed ? 'none' : 'auto',
    }}>
      {label}
    </div>
  );
}

function NavItem({ link, location, collapsed, dark, onNav }) {
  const Icon = link.icon;
  const active = location.pathname === link.to;
  const [hovered, setHovered] = useState(false);
  const bg = active ? 'rgba(99,102,241,0.12)' : hovered ? (dark ? '#181c27' : '#f3f4f6') : 'transparent';
  const color = active ? '#818cf8' : hovered ? (dark ? '#e8ecf4' : '#111827') : (dark ? '#7b839a' : '#6b7280');
  return (
    <div className="nav-item-wrap" style={{ position: 'relative' }}>
      <Link to={link.to} onClick={onNav} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 10px', borderRadius: 10, textDecoration: 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative',
          background: bg, color, fontSize: 12.5, fontWeight: 500,
          marginBottom: 1, transition: 'background 0.15s, color 0.15s',
        }}>
        {active && (<div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, borderRadius: '0 3px 3px 0', background: '#6366f1' }} />)}
        <Icon size={16} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, transition: 'opacity 0.26s ease, width 0.26s ease', opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', overflow: 'hidden', pointerEvents: 'none' }}>
          {link.label}
        </span>
        {link.badge != null && !collapsed && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'rgba(99,102,241,0.2)', color: '#818cf8', flexShrink: 0 }}>{link.badge}</span>
        )}
        {active && !collapsed && (<ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.6 }} />)}
      </Link>
      {collapsed && (
        <span className="nav-tooltip" style={{
          position: 'absolute', left: 58, top: '50%', transform: 'translateY(-50%)',
          background: dark ? '#1d2235' : '#ffffff', border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
          color: dark ? '#e8ecf4' : '#111827', fontSize: 12, fontWeight: 500, padding: '5px 10px', borderRadius: 8,
          whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 100,
        }}>
          {link.label}
        </span>
      )}
    </div>
  );
}

function SuperAdminNavItem({ link, location, collapsed, onNav }) {
  const Icon = link.icon;
  const active = location.pathname === link.to;
  const [hovered, setHovered] = useState(false);
  return (
    <div className="nav-item-wrap" style={{ position: 'relative' }}>
      <Link to={link.to} onClick={onNav}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 10px', borderRadius: 10, textDecoration: 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative',
          background: active
            ? 'linear-gradient(135deg,rgba(245,158,11,0.18),rgba(217,119,6,0.10))'
            : hovered ? 'rgba(245,158,11,0.07)' : 'transparent',
          color: active ? '#f59e0b' : hovered ? '#f59e0b' : 'rgba(245,158,11,0.5)',
          fontSize: 12.5, fontWeight: active ? 700 : 500,
          marginBottom: 1, transition: 'background 0.15s, color 0.15s',
          border: active ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
        }}>
        {active && (
          <div style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: 3, height: 16, borderRadius: '0 3px 3px 0',
            background: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.6)',
          }} />
        )}
        <Icon size={16} style={{ flexShrink: 0 }} />
        <span style={{
          flex: 1, transition: 'opacity 0.26s ease, width 0.26s ease',
          opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto',
          overflow: 'hidden', pointerEvents: 'none',
        }}>
          {link.label}
        </span>
        {active && !collapsed && <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.6 }} />}
      </Link>
      {collapsed && (
        <span className="nav-tooltip" style={{
          position: 'absolute', left: 58, top: '50%', transform: 'translateY(-50%)',
          background: '#0f0c1a', border: '1px solid rgba(245,158,11,0.3)',
          color: '#f59e0b', fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8,
          whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 100,
        }}>
          {link.label}
        </span>
      )}
    </div>
  );
}

function TopbarIconBtn({ dark, title, onClick, showDot, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div title={title} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
        background: hovered ? (dark ? '#1d2235' : '#f3f4f6') : (dark ? '#181c27' : '#f9fafb'),
        border: `1px solid ${hovered ? '#6366f1' : (dark ? '#1e2130' : '#e5e7eb')}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', transition: 'background 0.15s, border-color 0.15s',
      }}>
      {children}
      {showDot && (
        <div style={{
          position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%',
          background: '#6366f1', border: `1.5px solid ${dark ? '#13161f' : '#ffffff'}`,
          animation: 'edupla-pulse 2s infinite',
        }} />
      )}
    </div>
  );
}