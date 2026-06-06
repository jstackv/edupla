import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, BookOpen, Users, FileText, ClipboardList,
  Megaphone, LogOut, Sun, Moon, ChevronRight, ChevronLeft,
  GraduationCap, BookMarked, Notebook, Shield, UserCheck,
  UserCircle, Settings, Bell, Search, Home,
  Layers, UserPlus,
} from 'lucide-react';

/* ─────────────────────────── NAV DEFINITIONS ─────────────────────────── */
const TeacherLinks = [
  { to: '/teacher/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'main' },
  { to: '/teacher/classes',   icon: BookOpen,         label: 'My Classes',    section: 'main' },
  { to: '/teacher/students',  icon: Users,            label: 'Students',      section: 'main', badge: null },
  { to: '/teacher/documents', icon: FileText,         label: 'Documents',     section: 'manage' },
  { to: '/teacher/assignments', icon: ClipboardList,  label: 'Assignments',   section: 'manage' },
  { to: '/teacher/announcements', icon: Megaphone,    label: 'Announcements', section: 'manage' },
];

const StudentLinks = [
  { to: '/student/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     section: 'main' },
  { to: '/student/classes',       icon: BookMarked,      label: 'My Classes',    section: 'main' },
  { to: '/student/documents',     icon: Notebook,        label: 'Notes & Docs',  section: 'manage' },
  { to: '/student/assignments',   icon: ClipboardList,   label: 'Assignments',   section: 'manage' },
  { to: '/student/announcements', icon: Megaphone,       label: 'Announcements', section: 'manage' },
];

const AdminLinks = [
  { to: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard',      section: 'main' },
  { to: '/admin/teachers',     icon: UserCheck,       label: 'Teachers',       section: 'main' },
  { to: '/admin/classes',      icon: BookOpen,        label: 'Classes',        section: 'main' },
  { to: '/admin/students',     icon: GraduationCap,   label: 'Students',       section: 'main' },
  { to: '/admin/assignments',  icon: ClipboardList,   label: 'Assignments',    section: 'manage' },
  { to: '/admin/settings',     icon: Layers,          label: 'Trades',         section: 'manage' },
  { to: '/admin/admins',       icon: UserPlus,        label: 'Manage Admins',  section: 'manage' },
];

/* ─────────────────────────── AVATAR COLORS ─────────────────────────── */
const AVATAR_GRADIENTS = [
  ['#6366f1','#4338ca'], ['#0ea5e9','#0284c7'], ['#10b981','#059669'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#8b5cf6','#7c3aed'],
];
function getAvatarGradient(name) {
  if (!name) return AVATAR_GRADIENTS[0];
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

/* ─────────────────────────── ROLE CONFIG ─────────────────────────── */
const ROLE_LABEL = { teacher: 'Teacher Portal', student: 'Student Portal', admin: 'Admin Portal' };
const ROLE_BADGE_COLOR = { teacher: '#6366f1', student: '#10b981', admin: '#8b5cf6' };

/* ══════════════════════════════════════════════════════════════════════
   LAYOUT
══════════════════════════════════════════════════════════════════════ */
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = user?.role === 'teacher' ? TeacherLinks
    : user?.role === 'admin'   ? AdminLinks.filter(l => l.to !== '/admin/admins' || user?.is_super_admin)
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
    currentLink?.label || 'Dashboard';

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  /* ── Sidebar content (shared desktop + mobile) ── */
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

        {/* Only shown when expanded */}
        <div style={{
          overflow: 'hidden', whiteSpace: 'nowrap',
          transition: 'opacity 0.26s ease, width 0.26s ease',
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : 160,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800, color: dark ? '#e8ecf4' : '#111827', letterSpacing: '0.06em' }}>EDUPLA</p>
          <span style={{ fontSize: 10, color: dark ? '#4a5168' : '#9ca3af', fontWeight: 500 }}>
            {ROLE_LABEL[user?.role] || 'Portal'}
          </span>
        </div>
      </div>

      {/* User chip */}
      <Link
        to="/profile"
        onClick={onNav}
        style={{
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
            boxShadow: `0 2px 8px ${from}55`,
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

        {/* Main section */}
        <SectionLabel label="Main Menu" collapsed={collapsed} dark={dark} />
        {mainLinks.map(link => (
          <NavItem key={link.to} link={link} location={location} collapsed={collapsed} dark={dark} onNav={onNav} />
        ))}

        {/* Manage section */}
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

        {/* Sign out */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 10, border: 'none', background: 'transparent',
            cursor: 'pointer', color: '#f87171', fontSize: 12.5, fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', transition: 'background 0.15s',
            position: 'relative',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          <span style={{
            transition: 'opacity 0.26s ease, width 0.26s ease',
            opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto',
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            Sign Out
          </span>
          {collapsed && (
            <span style={{
              position: 'absolute', left: 'calc(100% - 6px)', top: '50%', transform: 'translateY(-50%)',
              background: dark ? '#1d2235' : '#ffffff', border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
              color: '#f87171', fontSize: 12, fontWeight: 500, padding: '5px 10px',
              borderRadius: 8, whiteSpace: 'nowrap', opacity: 0, pointerEvents: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 100, transition: 'opacity 0.15s',
            }}
              className="nav-tooltip"
            >
              Sign Out
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        body {
          font-family: 'DM Sans', sans-serif;
        }

        .edupla-layout {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: ${dark ? '#0f1117' : '#f4f5f7'};
        }

        /* Sidebar desktop */
        .edupla-sidebar {
          flex-shrink: 0;
          height: 100%;
          border-right: 1px solid ${dark ? '#1e2130' : '#e5e7eb'};
          position: relative;
          z-index: 10;
          transition: width 0.26s cubic-bezier(.4,0,.2,1);
          overflow: visible;
          width: ${collapsed ? '64px' : '240px'};
        }

        /* Collapse button */
        .collapse-btn {
          position: absolute;
          top: 14px;
          right: -12px;
          width: 24px;
          height: 24px;
          background: ${dark ? '#1d2235' : '#ffffff'};
          border: 1px solid ${dark ? '#1e2130' : '#e5e7eb'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 20;
          transition: background 0.15s, border-color 0.15s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .collapse-btn:hover {
          background: #6366f1 !important;
          border-color: #6366f1 !important;
        }
        .collapse-btn:hover svg {
          color: #fff !important;
        }

        /* Nav item tooltip (collapsed only) */
        .nav-tooltip {
          display: none !important;
        }
        ${collapsed ? `
        .nav-item-wrap:hover .nav-tooltip {
          display: flex !important;
          opacity: 1 !important;
          pointer-events: none !important;
        }
        ` : ''}

        /* Mobile overlay */
        .mobile-overlay {
          display: none;
        }
        @media (max-width: 1023px) {
          .edupla-sidebar { display: none !important; }
          .mobile-overlay { display: block; }
        }

        /* Scrollbar */
        nav::-webkit-scrollbar { display: none; }

        /* Pulse animation */
        @keyframes edupla-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div className="edupla-layout">

        {/* ── DESKTOP SIDEBAR ── */}
        <div className="edupla-sidebar">
          {/* Collapse toggle */}
          <div
            className="collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight size={11} color={dark ? '#7b839a' : '#6b7280'} />
              : <ChevronLeft  size={11} color={dark ? '#7b839a' : '#6b7280'} />
            }
          </div>
          <SidebarContent onNav={() => {}} />
        </div>

        {/* ── MOBILE OVERLAY ── */}
        <div className="mobile-overlay">
          {mobileOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
              <div
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                onClick={() => setMobileOpen(false)}
              />
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 240,
                boxShadow: '4px 0 32px rgba(0,0,0,0.4)',
              }}>
                <SidebarContent onNav={() => setMobileOpen(false)} />
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* TOPBAR */}
          <header style={{
            height: 52, flexShrink: 0,
            background: dark ? '#13161f' : '#ffffff',
            borderBottom: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px',
          }}>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              style={{
                display: 'none', width: 32, height: 32, borderRadius: 9,
                background: dark ? '#181c27' : '#f9fafb',
                border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
              className="mobile-hamburger"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? '#7b839a' : '#6b7280'} strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6"  x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <Home size={12} color={dark ? '#4a5168' : '#9ca3af'} />
              <ChevronRight size={10} color={dark ? '#4a5168' : '#9ca3af'} />
              <span style={{ fontSize: 12, color: dark ? '#7b839a' : '#6b7280', fontWeight: 500 }}>
                {ROLE_LABEL[user?.role] || 'Portal'}
              </span>
              <ChevronRight size={10} color={dark ? '#4a5168' : '#9ca3af'} />
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: dark ? '#e8ecf4' : '#111827' }}>
                {pageTitle}
              </span>
            </div>

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

              {/* Search pill */}
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
                <kbd style={{
                  fontSize: 9.5, color: dark ? '#4a5168' : '#9ca3af',
                  background: dark ? '#1d2235' : '#f3f4f6',
                  border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
                  borderRadius: 4, padding: '1px 4px',
                }}>⌘K</kbd>
              </div>

              {/* Notifications */}
              <TopbarIconBtn dark={dark} title="Notifications" showDot>
                <Bell size={14} color={dark ? '#7b839a' : '#6b7280'} />
              </TopbarIconBtn>

              {/* Theme toggle */}
              <TopbarIconBtn dark={dark} title={dark ? 'Switch to Light' : 'Switch to Dark'} onClick={toggleTheme}>
                {dark
                  ? <Sun  size={14} color={dark ? '#7b839a' : '#6b7280'} />
                  : <Moon size={14} color={dark ? '#7b839a' : '#6b7280'} />
                }
              </TopbarIconBtn>

              <div style={{ width: 1, height: 20, background: dark ? '#1e2130' : '#e5e7eb' }} />

              {/* User */}
              <Link
                to="/profile"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                  padding: '4px 8px', borderRadius: 10, transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? '#181c27' : '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {user?.role === 'admin' ? (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={13} color="#fff" />
                  </div>
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `linear-gradient(135deg,${from},${to})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Sora',sans-serif", fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>
                    {initials}
                  </div>
                )}
                <div style={{ display: 'none' }} className="user-info-desktop">
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: dark ? '#e8ecf4' : '#111827', lineHeight: 1.1 }}>{user?.name}</p>
                  <span style={{ fontSize: 10, color: ROLE_BADGE_COLOR[user?.role] || '#6366f1', fontWeight: 500, textTransform: 'capitalize' }}>
                    {user?.role}
                  </span>
                </div>
                <ChevronRight size={10} color={dark ? '#4a5168' : '#9ca3af'} style={{ transform: 'rotate(90deg)' }} />
              </Link>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: dark ? '#0f1117' : '#f4f5f7' }}>
            {children}
          </main>
        </div>
      </div>

      {/* Responsive extras */}
      <style>{`
        @media (max-width: 1023px) {
          .mobile-hamburger { display: flex !important; }
        }
        @media (min-width: 768px) {
          .user-info-desktop { display: block !important; }
        }
      `}</style>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════════════════════════ */

/* Section label */
function SectionLabel({ label, collapsed, dark }) {
  return (
    <div style={{
      padding: collapsed ? '10px 14px 0' : '14px 14px 4px',
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
      color: dark ? '#4a5168' : '#9ca3af', textTransform: 'uppercase',
      whiteSpace: 'nowrap', overflow: 'hidden',
      transition: 'opacity 0.26s ease, height 0.26s ease, padding 0.26s ease',
      opacity: collapsed ? 0 : 1,
      height: collapsed ? 0 : 'auto',
      pointerEvents: collapsed ? 'none' : 'auto',
    }}>
      {label}
    </div>
  );
}

/* Nav item */
function NavItem({ link, location, collapsed, dark, onNav }) {
  const Icon = link.icon;
  const active = location.pathname === link.to;
  const [hovered, setHovered] = useState(false);

  const bg = active
    ? 'rgba(99,102,241,0.12)'
    : hovered
    ? (dark ? '#181c27' : '#f3f4f6')
    : 'transparent';

  const color = active
    ? '#818cf8'
    : hovered
    ? (dark ? '#e8ecf4' : '#111827')
    : (dark ? '#7b839a' : '#6b7280');

  return (
    <div className="nav-item-wrap" style={{ position: 'relative' }}>
      <Link
        to={link.to}
        onClick={onNav}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 10px', borderRadius: 10, textDecoration: 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative',
          background: bg, color, fontSize: 12.5, fontWeight: 500,
          marginBottom: 1, transition: 'background 0.15s, color 0.15s',
        }}
      >
        {/* Active indicator */}
        {active && (
          <div style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: 3, height: 16, borderRadius: '0 3px 3px 0', background: '#6366f1',
          }} />
        )}

        <Icon size={16} style={{ flexShrink: 0 }} />

        {/* Label */}
        <span style={{
          flex: 1,
          transition: 'opacity 0.26s ease, width 0.26s ease',
          opacity: collapsed ? 0 : 1,
          width: collapsed ? 0 : 'auto',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}>
          {link.label}
        </span>

        {/* Badge */}
        {link.badge != null && !collapsed && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5,
            background: 'rgba(99,102,241,0.2)', color: '#818cf8', flexShrink: 0,
          }}>
            {link.badge}
          </span>
        )}

        {/* Chevron */}
        {active && !collapsed && (
          <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
        )}
      </Link>

      {/* Collapsed tooltip */}
      {collapsed && (
        <span
          className="nav-tooltip"
          style={{
            position: 'absolute', left: 58, top: '50%', transform: 'translateY(-50%)',
            background: dark ? '#1d2235' : '#ffffff',
            border: `1px solid ${dark ? '#1e2130' : '#e5e7eb'}`,
            color: dark ? '#e8ecf4' : '#111827',
            fontSize: 12, fontWeight: 500, padding: '5px 10px', borderRadius: 8,
            whiteSpace: 'nowrap', pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 100,
          }}
        >
          {link.label}
        </span>
      )}
    </div>
  );
}

/* Topbar icon button */
function TopbarIconBtn({ dark, title, onClick, showDot, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
        background: hovered ? (dark ? '#1d2235' : '#f3f4f6') : (dark ? '#181c27' : '#f9fafb'),
        border: `1px solid ${hovered ? '#6366f1' : (dark ? '#1e2130' : '#e5e7eb')}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {children}
      {showDot && (
        <div style={{
          position: 'absolute', top: 5, right: 5,
          width: 6, height: 6, borderRadius: '50%',
          background: '#6366f1',
          border: `1.5px solid ${dark ? '#13161f' : '#ffffff'}`,
          animation: 'edupla-pulse 2s infinite',
        }} />
      )}
    </div>
  );
}