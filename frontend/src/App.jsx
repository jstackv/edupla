import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MaintenanceProvider, useMaintenance } from './context/MaintenanceContext';
import { ChatNotifyProvider } from './context/ChatNotifyContext';
import Layout from './components/common/Layout';
import { GraduationCap } from 'lucide-react';

// Landing + Login load eagerly — they're the only two public, SEO-relevant
// pages, and the ones an anonymous visitor (or Googlebot) actually hits.
import Login from './pages/auth/Login';
import Landing from './pages/Landing';
import Maintenance from './pages/Maintenance';

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

function getDefaultRoute(role) {
  if (role === 'teacher') return '/teacher/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/student/dashboard';
}

const LoadingScreen = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4 shadow-glow">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-muted text-sm mt-3 font-medium">{t('common.loading')}</p>
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

  // The handoff page must always be reachable — it's how an impersonation
  // session gets established in the first place, even while the rest of
  // the app is showing the maintenance screen to everyone else.
  if (window.location.pathname === '/impersonate-handoff') return <AppRoutes />;

  if (authLoading || maintLoading) return <LoadingScreen />;

  const isSuperAdmin = user?.role === 'admin' && !!user?.is_super_admin;
  // Mirrors the backend's maintenanceGate: a token carrying
  // impersonation_session (issued only via POST /system/impersonate by the
  // super admin) passes through maintenance mode the same way the super
  // admin does, so bug fixes can be verified as the affected user.
  const isImpersonating = user?.impersonation_session === true && !!user?.impersonated_by;
  if (maintenance?.enabled && !isSuperAdmin && !isImpersonating) {
    return <Maintenance />;
  }

  return <AppRoutes />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MaintenanceProvider>
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
        </MaintenanceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}