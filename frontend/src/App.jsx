import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MaintenanceProvider, useMaintenance } from './context/MaintenanceContext';
import Layout from './components/common/Layout';
import { GraduationCap } from 'lucide-react';

import Login from './pages/auth/Login';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ViewerPage from './pages/ViewerPage';
import Maintenance from './pages/Maintenance';

import TeacherDashboard from './pages/teacher/Dashboard';
import Classes from './pages/teacher/Classes';
import Students from './pages/teacher/Students';
import Documents from './pages/teacher/Documents';
import Assignments from './pages/teacher/Assignments';
import TeacherAnnouncements from './pages/teacher/Announcements';
import TeacherAssessmentPage from './pages/teacher/AssessmentsTeacher';

import StudentDashboard from './pages/student/Dashboard';
import StudentClasses from './pages/student/Classes';
import StudentDocuments from './pages/student/Documents';
import StudentAssignments from './pages/student/Assignments';
import StudentAnnouncements from './pages/student/Announcements';

import AdminDashboard from './pages/admin/Dashboard';
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';
import AdminTeachers from './pages/admin/Teachers';
import AdminClasses from './pages/admin/Classes';
import AdminStudents from './pages/admin/Students';
import AdminAssessments from './pages/admin/Assessments';
import AdminSettingsPage from './pages/admin/AdminSettings';
import ManageAdmins from './pages/admin/ManageAdmins';
import SystemMaintenance from './pages/admin/SystemMaintenance';

function getDefaultRoute(role) {
  if (role === 'teacher') return '/teacher/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/student/dashboard';
}

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4 shadow-glow">
        <GraduationCap className="w-8 h-8 text-white" />
      </div>
      <div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
      <p className="text-muted text-sm mt-3 font-medium">Loading EDUPLA…</p>
    </div>
  </div>
);

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

      {/* Student routes */}
      <Route path="/student/dashboard"     element={<StudentRoute><StudentDashboard /></StudentRoute>} />
      <Route path="/student/classes"       element={<StudentRoute><StudentClasses /></StudentRoute>} />
      <Route path="/student/documents"     element={<StudentRoute><StudentDocuments /></StudentRoute>} />
      <Route path="/student/assignments"   element={<StudentRoute><StudentAssignments /></StudentRoute>} />
      <Route path="/student/announcements" element={<StudentRoute><StudentAnnouncements /></StudentRoute>} />

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

      {/* Fallback — unknown paths go to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ── Maintenance gate ───────────────────────────────────────────────────
// Wraps the whole app. While maintenance mode is on, everyone except the
// super admin sees only the maintenance screen — no routes, no API calls
// from other pages, nothing. The super admin keeps full normal access.
function AppGate() {
  const { user, loading: authLoading } = useAuth();
  const { maintenance, loading: maintLoading } = useMaintenance();

  if (authLoading || maintLoading) return <LoadingScreen />;

  const isSuperAdmin = user?.role === 'admin' && !!user?.is_super_admin;
  if (maintenance?.enabled && !isSuperAdmin) {
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
            <AppGate />
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