import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

function safeParseUser() {
  try {
    const stored = localStorage.getItem('user');
    if (!stored || stored === 'undefined' || stored === 'null') return null;
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(safeParseUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
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

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);