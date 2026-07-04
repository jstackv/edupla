import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

function safeParseUser() {
  try {
    const stored = sessionStorage.getItem('user');
    if (!stored || stored === 'undefined' || stored === 'null') return null;
    return JSON.parse(stored);
  } catch {
    sessionStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(safeParseUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user);
        sessionStorage.setItem('user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        setUser(null);
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  /**
   * loginWithRole — validates that the authenticated user's role matches
   * the role the user selected on the login screen BEFORE persisting any
   * credentials.  If there is a mismatch the token is never stored and a
   * typed error is thrown so the caller can surface the right message.
   *
   * @param {string} email
   * @param {string} password
   * @param {string|null} expectedRole  – the role key chosen on step 1 (e.g. 'student')
   * @returns {object} user payload on success
   * @throws  {Error}  with .code === 'ROLE_MISMATCH' on mismatch
   */
  const loginWithRole = async (email, password, expectedRole) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;

    if (expectedRole && user.role !== expectedRole) {
      // Do NOT persist anything — wrong role selected
      const err = new Error('ROLE_MISMATCH');
      err.code = 'ROLE_MISMATCH';
      err.actualRole = user.role;
      throw err;
    }

    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  };

  /**
   * setImpersonatedUser — used only by the /impersonate-handoff page, once
   * it has exchanged the impersonation token for the decoded user via
   * /auth/me. Token/sessionStorage are already set by that page; this just
   * syncs React state so the rest of the app (routes, maintenance gate)
   * sees the impersonated user immediately without a reload.
   */
  const setImpersonatedUser = (impersonatedUser) => setUser(impersonatedUser);

  /**
   * endImpersonation — clears this tab's session and closes it, since an
   * impersonation tab has no "real" identity to fall back to. Falls back
   * to redirecting to /login if the tab can't be closed (e.g. it wasn't
   * opened by script, which can happen if a browser blocks window.close
   * on tabs it didn't track as script-opened).
   */
  const endImpersonation = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
    window.close();
    // If window.close() was a no-op (some browsers block it), fall back.
    setTimeout(() => { window.location.href = '/login'; }, 300);
  };

  /**
   * refreshUser — re-fetches the current user's full profile from
   * /auth/me and syncs both React state and sessionStorage. Call this
   * after any action that changes the logged-in user's own data (e.g.
   * saving profile edits) so the UI reflects real, current values
   * immediately instead of waiting for the next full page load.
   */
  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      sessionStorage.setItem('user', JSON.stringify(res.data.user));
      return res.data.user;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithRole, logout, setImpersonatedUser, endImpersonation, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);