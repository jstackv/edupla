import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const PendingPaymentsContext = createContext(null);

const POLL_INTERVAL_MS = 20000;

export function PendingPaymentsProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const previousCount = useRef(null); // null = haven't loaded yet, so no toast on first load
  const mounted = useRef(true);

  const isSuperAdmin = user?.role === 'admin' && !!user?.is_super_admin;

  const refresh = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await api.get('/system/billing/manual-payments/pending-count');
      const next = res.data.count;
      if (!mounted.current) return;

      if (previousCount.current !== null && next > previousCount.current) {
        const diff = next - previousCount.current;
        toast.success(
          diff === 1 ? 'A school submitted a payment claim.' : `${diff} new payment claims submitted.`,
          { icon: '💰' },
        );
      }
      previousCount.current = next;
      setCount(next);
    } catch {
      // silent — this is a nice-to-have badge, not critical path
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    mounted.current = true;
    if (!isSuperAdmin) { setCount(0); previousCount.current = null; return; }
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => { mounted.current = false; clearInterval(id); };
  }, [isSuperAdmin, refresh]);

  return (
    <PendingPaymentsContext.Provider value={{ count, refresh }}>
      {children}
    </PendingPaymentsContext.Provider>
  );
}

export const usePendingPayments = () => useContext(PendingPaymentsContext);
