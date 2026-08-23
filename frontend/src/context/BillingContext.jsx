import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const BillingContext = createContext(null);

const POLL_INTERVAL_MS = 30000;

export function BillingProvider({ children }) {
  const { user } = useAuth();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!user) {
      if (mounted.current) { setBilling(null); setLoading(false); }
      return;
    }
    try {
      const res = await api.get('/billing/status');
      if (mounted.current) setBilling(res.data);
    } catch {
      // Fail "open" — a billing-status hiccup shouldn't itself lock anyone
      // out; the backend gate is the real enforcement point.
      if (mounted.current) setBilling(prev => prev || { status: 'active', is_payer: false });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    // Skip ticks while the tab is backgrounded — billing status doesn't
    // need a live-in-the-background heartbeat, and this halves the idle
    // request volume for anyone who leaves the tab open all day.
    const id = setInterval(() => { if (!document.hidden) refresh(); }, POLL_INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { mounted.current = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  return (
    <BillingContext.Provider value={{ billing, loading, refresh }}>
      {children}
    </BillingContext.Provider>
  );
}

export const useBilling = () => useContext(BillingContext);
