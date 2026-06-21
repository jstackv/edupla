import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

const MaintenanceContext = createContext(null);

const POLL_INTERVAL_MS = 20000;

export function MaintenanceProvider({ children }) {
  const [maintenance, setMaintenance] = useState({ enabled: false, message: null, estimated_back_at: null, enabled_at: null });
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/system/status');
      if (mounted.current) setMaintenance(res.data);
    } catch {
      // Fail "open" — if we can't reach the API at all, don't block the UI
      // behind a maintenance screen; the rest of the app will surface that
      // error on its own.
      if (mounted.current) setMaintenance(prev => prev.enabled ? prev : { enabled: false, message: null, estimated_back_at: null, enabled_at: null });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => { mounted.current = false; clearInterval(id); };
  }, [refresh]);

  return (
    <MaintenanceContext.Provider value={{ maintenance, loading, refresh }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export const useMaintenance = () => useContext(MaintenanceContext);