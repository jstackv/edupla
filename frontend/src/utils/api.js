import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 30000,
});

// ── Per-tab sessions ─────────────────────────────────────────────────────
// Auth (token/user) lives in sessionStorage, NOT localStorage. localStorage
// is shared across every tab on the same origin, so a single shared 'token'
// key meant impersonating a user in one tab silently logged out (or
// switched the identity of) every other open tab, including the super
// admin's own session. sessionStorage is scoped per tab, so the super
// admin tab, and any number of impersonation tabs, can all stay signed in
// as different users at once.
//
// Trade-off: a session no longer persists across a tab close or a new tab —
// each tab needs its own sign-in. Applies to every role, not just
// impersonation, by design (one consistent rule instead of two systems).

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const PUBLIC_PATHS = ['/', '/login'];

api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    const code   = err.response?.data?.code;
    const message = err.response?.data?.message;

    // ── Instant session kill: account was deactivated ──────────────────
    if (status === 403 && code === 'ACCOUNT_DEACTIVATED') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      // Store the deactivation message so Login page can display it
      sessionStorage.setItem(
        'deactivation_message',
        message || 'Your account has been deactivated. Please contact your administrator.'
      );
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // ── Generic 401: token expired / not authenticated ─────────────────
    if (status === 401 && !PUBLIC_PATHS.includes(window.location.pathname)) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(err);
  }
);

export default api;
