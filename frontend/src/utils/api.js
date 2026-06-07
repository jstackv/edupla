import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(err);
  }
);

export default api;
