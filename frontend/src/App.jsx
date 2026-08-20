import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MaintenanceProvider, useMaintenance } from './context/MaintenanceContext';
import { BillingProvider, useBilling } from './context/BillingContext';
import { PendingPaymentsProvider } from './context/PendingPaymentsContext';
import { ChatNotifyProvider } from './context/ChatNotifyContext';
import Layout from './components/common/Layout';
import BrandMark from './components/common/BrandMark';

// Landing + Login load eagerly — they're the only two public, SEO-relevant
// pages, and the ones an anonymous visitor (or Googlebot) actually hits.
import Login from './pages/auth/Login';
import Landing from './pages/Landing';
import Maintenance from './pages/Maintenance';
import Billing from './pages/Billing';

// Everything below this line is only ever seen after login, so it's
// code-split with React.lazy: none of it is downloaded on first load of
// "/". This is what keeps the public landing page's JS bundle small, which
// directly improves Core Web Vitals / page-speed — a real Google ranking
// signal — and gets the page interactive faster for real visitors too.
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const ViewerPage = lazy(() => import('./pages/ViewerPage'));
const ImpersonateHandoff = lazy(() => import('./pages/ImpersonateHandoff'));

const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard'));
const Classes = lazy(() => import('./pages/teacher/Classes'));
const Students = lazy(() => import('./pages/teacher/Students'));
const Documents = lazy(() => import('./pages/teacher/Documents'));
const Assignments = lazy(() => import('./pages/teacher/Assignments'));
const TeacherAnnouncements = lazy(() => import('./pages/teacher/Announcements'));
const TeacherAssessmentPage = lazy(() => import('./pages/teacher/AssessmentsTeacher'));
const TeacherAssessmentsOnline = lazy(() => import('./pages/teacher/AssessmentsOnline'));
const TeacherGroups = lazy(() => import('./pages/teacher/Groups'));

const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentClasses = lazy(() => import('./pages/student/Classes'));
const StudentModules = lazy(() => import('./pages/student/Modules'));
const StudentDocuments = lazy(() => import('./pages/student/Documents'));
const StudentAssignments = lazy(() => import('./pages/student/Assignments'));
const StudentAnnouncements = lazy(() => import('./pages/student/Announcements'));
const StudentGroups = lazy(() => import('./pages/student/Groups'));
const StudentAssessments = lazy(() => import('./pages/student/Assessments'));
const AttemptAssessment = lazy(() => import('./pages/student/AttemptAssessment'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const SuperAdminDashboard = lazy(() => import('./pages/admin/SuperAdminDashboard'));
const AdminTeachers = lazy(() => import('./pages/admin/Teachers'));
const AdminClasses = lazy(() => import('./pages/admin/Classes'));
const AdminStudents = lazy(() => import('./pages/admin/Students'));
const AdminAssessments = lazy(() => import('./pages/admin/Assessments'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettings'));
const ManageAdmins = lazy(() => import('./pages/admin/ManageAdmins'));
const SystemMaintenance = lazy(() => import('./pages/admin/SystemMaintenance'));
const SchoolsBilling = lazy(() => import('./pages/admin/SchoolsBilling'));
const PaymentRequests = lazy(() => import('./pages/admin/PaymentRequests'));
const Subscription = lazy(() => import('./pages/admin/Subscription'));

function getDefaultRoute(role) {
  if (role === 'teacher') return '/teacher/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/student/dashboard';
}

// ── Loading screen ──────────────────────────────────────────────────────
// "Ember & Current" splash treatment, matching the BrandMark redesign:
// a floating badge held inside three counter-rotating gradient halo rings
// (dark orange + indigo + a fine slate orbit carrying a single spark
// particle — echoing the shard and spark in the mark itself), ambient
// slate/orange/indigo background glow, a gradient-shimmer label, and a
// slim indeterminate progress thread underneath that carries the same
// indigo -> orange ramp as the badge's "growth path" — the loading state
// literally continues the logo's story instead of bolting on a generic
// spinner.
const LoadingScreen = () => {
  const { t } = useTranslation();
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--page-bg)' }}
    >
      <style>{`
        @keyframes edupla-loader-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes edupla-loader-ringspin {
          to { transform: rotate(360deg); }
        }
        @keyframes edupla-loader-ringspin-rev {
          to { transform: rotate(-360deg); }
        }
        @keyframes edupla-loader-orbit {
          to { transform: rotate(360deg); }
        }
        @keyframes edupla-loader-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(2%, -3%) scale(1.06); }
        }
        @keyframes edupla-loader-dot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes edupla-loader-fadeup {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes edupla-loader-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes edupla-loader-slide {
          0% { left: -45%; }
          100% { left: 100%; }
        }
        @keyframes edupla-loader-glowpulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        .edupla-loader-blob { animation: edupla-loader-drift 9s ease-in-out infinite; }
        .edupla-loader-blob.b2 { animation-delay: -4.5s; }
        .edupla-loader-blob.b3 { animation-delay: -2.2s; }

        .edupla-loader-badge-wrap { animation: edupla-loader-float 3.2s ease-in-out infinite; }

        .edupla-loader-ring {
          position: absolute; inset: -12px; border-radius: 9999px;
          background: conic-gradient(from 0deg, transparent 0deg, rgba(249,115,22,0.7) 55deg, transparent 130deg, transparent 360deg);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px));
          animation: edupla-loader-ringspin 3.2s linear infinite;
        }
        .edupla-loader-ring.indigo {
          inset: -20px;
          background: conic-gradient(from 200deg, transparent 0deg, rgba(99,102,241,0.75) 45deg, transparent 110deg, transparent 360deg);
          animation: edupla-loader-ringspin-rev 4.6s linear infinite;
        }
        .edupla-loader-ring.slate {
          inset: -28px;
          background: conic-gradient(from 90deg, transparent 0deg, rgba(148,163,184,0.4) 30deg, transparent 90deg, transparent 360deg);
          animation: edupla-loader-ringspin 7.5s linear infinite;
        }
        .edupla-loader-orbit-wrap {
          position: absolute; inset: -28px; animation: edupla-loader-orbit 3.6s linear infinite;
        }
        .edupla-loader-orbit-dot {
          position: absolute; top: -3px; left: 50%; width: 6px; height: 6px; margin-left: -3px;
          border-radius: 9999px; background: radial-gradient(circle, #FDE9C7 0%, #F97316 60%, transparent 100%);
          box-shadow: 0 0 8px 2px rgba(249,115,22,0.65);
        }

        .edupla-loader-badge-glow {
          position: absolute; inset: -34px; border-radius: 9999px; z-index: -1;
          background: radial-gradient(circle, rgba(99,102,241,0.22), rgba(249,115,22,0.10) 55%, transparent 75%);
          filter: blur(6px);
          animation: edupla-loader-glowpulse 3.2s ease-in-out infinite;
        }

        .edupla-loader-content { animation: edupla-loader-fadeup 0.5s ease both; }

        .edupla-loader-label {
          background: linear-gradient(90deg, var(--text-muted, #64748b) 0%, #4338CA 22%, #6366F1 40%, #F97316 60%, #FDBA74 78%, var(--text-muted, #64748b) 100%);
          background-size: 220% auto;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: edupla-loader-shimmer 3s linear infinite;
        }
        .edupla-loader-dot { animation: edupla-loader-dot 1.4s ease-in-out infinite; color: #F97316; }
        .edupla-loader-dot:nth-child(2) { animation-delay: 0.2s; color: #6366F1; }
        .edupla-loader-dot:nth-child(3) { animation-delay: 0.4s; color: #F97316; }

        .edupla-loader-track {
          width: 168px; height: 3px; border-radius: 999px; margin: 16px auto 0;
          background: rgba(100,116,139,0.18); overflow: hidden; position: relative;
        }
        .edupla-loader-bar {
          position: absolute; top: 0; bottom: 0; left: -45%; width: 45%; border-radius: 999px;
          background: linear-gradient(90deg, transparent, #4338CA, #6366F1, #F97316, transparent);
          animation: edupla-loader-slide 1.7s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .edupla-loader-badge-wrap, .edupla-loader-blob, .edupla-loader-ring, .edupla-loader-orbit-wrap,
          .edupla-loader-badge-glow, .edupla-loader-dot, .edupla-loader-label, .edupla-loader-bar { animation: none; }
        }
      `}</style>

      {/* Ambient glow blobs — slate, indigo and dark orange, echoing the
          landing page's background treatment */}
      <div
        aria-hidden="true"
        className="edupla-loader-blob"
        style={{ position: 'absolute', width: 480, height: 480, borderRadius: '50%', top: '-10%', left: '-8%', background: 'radial-gradient(circle,rgba(67,56,202,0.22),transparent)', filter: 'blur(90px)' }}
      />
      <div
        aria-hidden="true"
        className="edupla-loader-blob b2"
        style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', bottom: '-12%', right: '-6%', background: 'radial-gradient(circle,rgba(249,115,22,0.16),transparent)', filter: 'blur(80px)' }}
      />
      <div
        aria-hidden="true"
        className="edupla-loader-blob b3"
        style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', top: '20%', right: '14%', background: 'radial-gradient(circle,rgba(51,65,85,0.22),transparent)', filter: 'blur(70px)' }}
      />

      <div className="edupla-loader-content text-center relative">
        <div className="relative inline-block mb-7 edupla-loader-badge-wrap">
          <span className="edupla-loader-badge-glow" aria-hidden="true" />
          <span className="edupla-loader-ring slate" aria-hidden="true" />
          <span className="edupla-loader-ring indigo" aria-hidden="true" />
          <span className="edupla-loader-ring" aria-hidden="true" />
          <span className="edupla-loader-orbit-wrap" aria-hidden="true">
            <span className="edupla-loader-orbit-dot" />
          </span>
          <BrandMark size={64} animated />
        </div>

        <p className="text-sm font-semibold tracking-wide">
          <span className="edupla-loader-label">
            {t('common.loading').replace(/[.\u2026]+\s*$/, '')}
          </span>
          <span className="inline-flex ml-0.5" aria-hidden="true">
            <span className="edupla-loader-dot">.</span>
            <span className="edupla-loader-dot">.</span>
            <span className="edupla-loader-dot">.</span>
          </span>
        </p>

        <div className="edupla-loader-track" aria-hidden="true">
          <span className="edupla-loader-bar" />
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }
  return <Layout>{children}</Layout>;
};

const TeacherRoute = ({ children }) => <ProtectedRoute role="teacher">{children}</ProtectedRoute>;
const StudentRoute = ({ children }) => <ProtectedRoute role="student">{children}</ProtectedRoute>;
const AdminRoute = ({ children }) => <ProtectedRoute role="admin">{children}</ProtectedRoute>;
const AnyRoute = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

// Super admin route — admin + is_super_admin
const SuperAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== 'admin' || !user.is_super_admin) return <Navigate to={getDefaultRoute(user.role)} replace />;
  return <Layout>{children}</Layout>;
};

// Regular admin only route — admin but NOT super admin
const RegularAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== 'admin') return <Navigate to={getDefaultRoute(user.role)} replace />;
  if (user.is_super_admin) return <Navigate to="/admin/dashboard" replace />;
  return <Layout>{children}</Layout>;
};

// Routes to the right dashboard based on is_super_admin
function AdminDashboardRouter() {
  const { user } = useAuth();
  if (user?.is_super_admin) return <SuperAdminDashboard />;
  return <AdminDashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  // While auth is resolving, show Landing on '/' immediately (no blank flash)
  // and a loading screen on any protected path.
  // Once resolved, redirect logged-in users away from public pages.

  return (
    <Suspense fallback={<LoadingScreen />}>
    <Routes>
      {/* Landing page — always renders immediately; redirects logged-in users to their dashboard */}
      <Route
        path="/"
        element={
          !loading && user
            ? <Navigate to={getDefaultRoute(user.role)} replace />
            : <Landing />
        }
      />

      {/* Login page — only reachable when not logged in; redirects logged-in users */}
      <Route
        path="/login"
        element={
          loading
            ? <LoadingScreen />
            : user
              ? <Navigate to={getDefaultRoute(user.role)} replace />
              : <Login />
        }
      />

      {/* Shared authenticated routes */}
      <Route path="/profile"  element={<AnyRoute><Profile /></AnyRoute>} />
      <Route path="/settings" element={<AnyRoute><Settings /></AnyRoute>} />

      {/* Teacher routes */}
      <Route path="/teacher/dashboard"     element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
      <Route path="/teacher/classes"       element={<TeacherRoute><Classes /></TeacherRoute>} />
      <Route path="/teacher/students"      element={<TeacherRoute><Students /></TeacherRoute>} />
      <Route path="/teacher/documents"     element={<TeacherRoute><Documents /></TeacherRoute>} />
      <Route path="/teacher/assignments"   element={<TeacherRoute><Assignments /></TeacherRoute>} />
      <Route path="/teacher/announcements" element={<TeacherRoute><TeacherAnnouncements /></TeacherRoute>} />
      <Route path="/teacher/assessments-grade" element={<TeacherRoute><TeacherAssessmentPage /></TeacherRoute>} />
      <Route path="/teacher/assessments"       element={<TeacherRoute><TeacherAssessmentsOnline /></TeacherRoute>} />
      <Route path="/teacher/groups"            element={<TeacherRoute><TeacherGroups /></TeacherRoute>} />

      {/* Student routes */}
      <Route path="/student/dashboard"     element={<StudentRoute><StudentDashboard /></StudentRoute>} />
      <Route path="/student/classes"       element={<StudentRoute><StudentClasses /></StudentRoute>} />
      <Route path="/student/modules"       element={<StudentRoute><StudentModules /></StudentRoute>} />
      <Route path="/student/documents"     element={<StudentRoute><StudentDocuments /></StudentRoute>} />
      <Route path="/student/assignments"   element={<StudentRoute><StudentAssignments /></StudentRoute>} />
      <Route path="/student/announcements" element={<StudentRoute><StudentAnnouncements /></StudentRoute>} />
      <Route path="/student/groups"        element={<StudentRoute><StudentGroups /></StudentRoute>} />
      <Route path="/student/assessments"   element={<StudentRoute><StudentAssessments /></StudentRoute>} />
      <Route path="/student/assessments/:id/attempt" element={<StudentRoute><AttemptAssessment /></StudentRoute>} />

      {/* Admin routes — dashboard routes to correct dashboard based on role */}
      <Route path="/admin/dashboard"   element={<AdminRoute><AdminDashboardRouter /></AdminRoute>} />
      <Route path="/admin/teachers"    element={<RegularAdminRoute><AdminTeachers /></RegularAdminRoute>} />
      <Route path="/admin/classes"     element={<RegularAdminRoute><AdminClasses /></RegularAdminRoute>} />
      <Route path="/admin/students"    element={<RegularAdminRoute><AdminStudents /></RegularAdminRoute>} />
      <Route path="/admin/assessments" element={<RegularAdminRoute><AdminAssessments /></RegularAdminRoute>} />
      <Route path="/admin/settings"    element={<RegularAdminRoute><AdminSettingsPage /></RegularAdminRoute>} />
      <Route path="/admin/admins"      element={<SuperAdminRoute><ManageAdmins /></SuperAdminRoute>} />
      <Route path="/admin/maintenance" element={<SuperAdminRoute><SystemMaintenance /></SuperAdminRoute>} />
      <Route path="/admin/schools-billing" element={<SuperAdminRoute><SchoolsBilling /></SuperAdminRoute>} />
      <Route path="/admin/payment-requests" element={<SuperAdminRoute><PaymentRequests /></SuperAdminRoute>} />
      <Route path="/admin/subscription" element={<RegularAdminRoute><Subscription /></RegularAdminRoute>} />

      {/* Document viewer — opens in new tab */}
      <Route path="/view-doc" element={<ViewerPage />} />

      {/* Impersonation handoff — only reached via a link generated by
          ImpersonateButton; consumes a one-time token from the URL hash. */}
      <Route path="/impersonate-handoff" element={<ImpersonateHandoff />} />

      {/* Fallback — unknown paths go to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

// ── Maintenance gate ───────────────────────────────────────────────────
// Wraps the whole app. While maintenance mode is on, everyone except the
// super admin sees only the maintenance screen — no routes, no API calls
// from other pages, nothing. The super admin keeps full normal access.
function AppGate() {
  const { user, loading: authLoading } = useAuth();
  const { maintenance, loading: maintLoading } = useMaintenance();
  const { billing, loading: billingLoading } = useBilling();

  // The handoff page must always be reachable — it's how an impersonation
  // session gets established in the first place, even while the rest of
  // the app is showing the maintenance screen to everyone else.
  if (window.location.pathname === '/impersonate-handoff') return <AppRoutes />;

  // Billing status only exists for logged-in users, so only wait on it
  // once a user is present — otherwise the public landing/login pages
  // would hang on a request that never fires.
  if (authLoading || maintLoading || (user && billingLoading)) return <LoadingScreen />;

  const isSuperAdmin = user?.role === 'admin' && !!user?.is_super_admin;
  // Mirrors the backend's maintenanceGate: a token carrying
  // impersonation_session (issued only via POST /system/impersonate by the
  // super admin) passes through maintenance mode the same way the super
  // admin does, so bug fixes can be verified as the affected user.
  const isImpersonating = user?.impersonation_session === true && !!user?.impersonated_by;
  if (maintenance?.enabled && !isSuperAdmin && !isImpersonating) {
    return <Maintenance />;
  }

  // Mirrors the backend's billingGate: once a school's trial or paid
  // period has lapsed — or a super admin has manually locked it — everyone
  // under that admin sees this screen, but only the admin (billing.is_payer)
  // gets the actual payment form (and not even then, if locked).
  if (user && (billing?.status === 'overdue' || billing?.status === 'locked') && !isSuperAdmin && !isImpersonating) {
    return <Billing />;
  }

  return <AppRoutes />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MaintenanceProvider>
          <BillingProvider>
            <PendingPaymentsProvider>
              <BrowserRouter>
                <ChatNotifyProvider>
                  <AppGate />
                </ChatNotifyProvider>
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 3500,
                    style: {
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '14px',
                      borderRadius: '12px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                    },
                    success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                  }}
                />
              </BrowserRouter>
            </PendingPaymentsProvider>
          </BillingProvider>
        </MaintenanceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}