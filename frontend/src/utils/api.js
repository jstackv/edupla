import axios from 'axios';

const api = axios.create({
  // In production: uses VITE_API_BASE_URL (your backend Vercel URL)
  // In development: uses vite proxy → '/api' → localhost:5000
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 30000,
});

// Public paths that should never be force-redirected to /login
const PUBLIC_PATHS = ['/', '/login'];

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !PUBLIC_PATHS.includes(window.location.pathname)) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
