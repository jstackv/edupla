import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

function getDefaultRoute(role) {
  if (role === 'teacher') return '/teacher/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  return '/student/dashboard';
}

/**
 * /impersonate-handoff — only reachable via the token-in-hash link opened
 * by ImpersonateButton. Never linked to from anywhere in the UI.
 *
 * The token lives in the URL *hash* (after #), not a query string, so it's
 * never sent to the server in a request line and never logged by the
 * backend or any reverse proxy. We read it client-side only, store it as
 * this tab's session, then immediately scrub it from the address bar.
 */
export default function ImpersonateHandoff() {
  const navigate = useNavigate();
  const { setImpersonatedUser } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const token = params.get('token');

    if (!token) {
      setError('No impersonation token found.');
      return;
    }

    // This is a brand-new browser tab. sessionStorage is scoped to THIS
    // tab only — writing the impersonation token here cannot touch the
    // super admin's original tab (or any other open impersonation tab),
    // since each tab has its own independent sessionStorage even though
    // they share the same origin. That's what makes multiple simultaneous
    // impersonation sessions possible.
    (async () => {
      try {
        sessionStorage.setItem('token', token);
        // Strip the token out of the address bar immediately.
        window.history.replaceState(null, '', window.location.pathname);

        const res = await api.get('/auth/me');
        const user = res.data.user;
        sessionStorage.setItem('user', JSON.stringify(user));
        setImpersonatedUser(user);
        navigate(getDefaultRoute(user.role), { replace: true });
      } catch (err) {
        setError(err.response?.data?.message || 'This impersonation link has expired or is invalid.');
      }
    })();
  }, [navigate, setImpersonatedUser]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
      <div className="text-center" style={{ maxWidth: 360 }}>
        {error ? (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#fef2f2' }}>
              <AlertTriangle className="w-7 h-7" style={{ color: '#ef4444' }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Couldn't start session</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{error}</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4 shadow-glow">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-muted text-sm mt-3 font-medium">Starting impersonation session…</p>
          </>
        )}
      </div>
    </div>
  );
}
