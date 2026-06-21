import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ImpersonateButton from '../../components/common/ImpersonateButton';
import {
  Settings, Power, PowerOff, Clock, ShieldAlert, CheckCircle2,
  AlertTriangle, Sparkles, Loader2, UserCog, Search, Mail, X,
} from 'lucide-react';

const DEFAULT_MESSAGE = "We're performing scheduled maintenance to improve EDUPLA. We'll be back online shortly — thank you for your patience.";

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SystemMaintenance() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [etaInput, setEtaInput] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // 'enable' | 'disable' | null

  // ── Impersonation search ──────────────────────────────────────────────
  const [impQuery, setImpQuery] = useState('');
  const [impResults, setImpResults] = useState([]);
  const [impSearching, setImpSearching] = useState(false);

  useEffect(() => {
    const q = impQuery.trim();
    if (q.length < 2) { setImpResults([]); setImpSearching(false); return; }
    setImpSearching(true);
    const t = setTimeout(() => {
      api.get('/admin/users/search', { params: { q } })
        .then(res => setImpResults(res.data.users))
        .catch(() => setImpResults([]))
        .finally(() => setImpSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [impQuery]);

  const ROLE_COLOR = { admin: '#7c3aed', teacher: '#6366f1', student: '#10b981' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/status');
      setStatus(res.data);
      setMessage(res.data.message || DEFAULT_MESSAGE);
      setEtaInput(toLocalInputValue(res.data.estimated_back_at));
    } catch {
      toast.error('Failed to load maintenance status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = async (enabled) => {
    setSaving(true);
    try {
      const body = { enabled, message: message.trim() || DEFAULT_MESSAGE };
      if (enabled && etaInput) body.estimated_back_at = new Date(etaInput).toISOString();
      const res = await api.put('/system/maintenance', body);
      setStatus(res.data.status);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update maintenance mode');
    } finally {
      setSaving(false);
      setConfirmAction(null);
    }
  };

  const isOn = status?.enabled;

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 300 }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* Status banner */}
      <div className="card" style={{
        marginBottom: 20,
        background: isOn
          ? 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(244,63,94,0.03))'
          : 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(16,185,129,0.03))',
        border: `1px solid ${isOn ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}`,
      }}>
        <div className="flex items-center gap-4">
          <div style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            background: isOn ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isOn ? <AlertTriangle size={24} color="#f43f5e" /> : <CheckCircle2 size={24} color="#10b981" />}
          </div>
          <div style={{ flex: 1 }}>
            <p className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              {isOn ? 'Maintenance mode is ACTIVE' : 'Platform is online'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {isOn
                ? "Teachers, students, and regular admins only see the maintenance screen right now."
                : 'Everyone has normal access to EDUPLA.'}
            </p>
            {isOn && status?.enabled_at && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Enabled {new Date(status.enabled_at).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={() => setConfirmAction(isOn ? 'disable' : 'enable')}
            disabled={saving}
            className={isOn ? 'btn-secondary' : 'btn-danger'}
            style={!isOn ? { background: 'linear-gradient(135deg,#f43f5e,#e11d48)', boxShadow: '0 2px 8px rgba(244,63,94,0.3)' } : {}}
          >
            {isOn ? <Power size={15} /> : <PowerOff size={15} />}
            {isOn ? 'Turn Off' : 'Turn On'}
          </button>
        </div>
      </div>

      {/* Impersonation panel — log in as any user to verify fixes while
          maintenance is active, without disabling it for everyone else. */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex items-center gap-2 mb-1">
          <UserCog size={16} style={{ color: '#7c3aed' }} />
          <h2 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            Log in as a user
          </h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          Search any teacher, student, or admin account and open a session as them in a new tab — useful for verifying a fix while maintenance is on. Your own session stays untouched. Sessions expire after 2 hours.
        </p>

        <div style={{ position: 'relative', marginBottom: impResults.length || impSearching ? 12 : 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            className="input-field"
            placeholder="Search by name or email…"
            value={impQuery}
            onChange={e => setImpQuery(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
          {impQuery && (
            <button onClick={() => setImpQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}>
              <X size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        {impSearching && (
          <div className="flex items-center gap-2" style={{ padding: '8px 2px' }}>
            <Loader2 size={13} className="animate-spin" style={{ color: '#7c3aed' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Searching…</span>
          </div>
        )}

        {!impSearching && impQuery.trim().length >= 2 && impResults.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)', padding: '8px 2px' }}>No active users matched "{impQuery.trim()}".</p>
        )}

        {impResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {impResults.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 10, background: 'var(--surface-100)', border: '1px solid var(--card-border)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: `${ROLE_COLOR[u.role] || '#6366f1'}1a`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: ROLE_COLOR[u.role] || '#6366f1',
                }}>
                  {u.name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={10} /> {u.email}
                  </p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, textTransform: 'capitalize',
                  background: `${ROLE_COLOR[u.role] || '#6366f1'}1a`, color: ROLE_COLOR[u.role] || '#6366f1',
                }}>
                  {u.role}
                </span>
                {u.is_active === false && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fef2f2', color: '#ef4444' }}>
                    Inactive
                  </span>
                )}
                {u.is_active !== false ? (
                  <ImpersonateButton userId={u.id} name={u.name} size={14} style={{ background: `${ROLE_COLOR[u.role] || '#6366f1'}1a`, padding: '7px 9px' }} />
                ) : (
                  <span title="Can't impersonate a deactivated account" style={{ padding: '7px 9px', opacity: 0.3, display: 'flex' }}>
                    <UserCog size={14} />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuration card */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={16} style={{ color: '#6366f1' }} />
          <h2 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            Maintenance Screen
          </h2>
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
          This is what everyone except you will see while maintenance mode is on. Update it any time — changes apply immediately, even while it's active.
        </p>

        <label className="label">Message shown to users</label>
        <textarea
          className="input-field"
          rows={4}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={DEFAULT_MESSAGE}
          style={{ resize: 'vertical', marginBottom: 16 }}
        />

        <label className="label flex items-center gap-1.5">
          <Clock size={11} /> Estimated back online (optional)
        </label>
        <input
          type="datetime-local"
          className="input-field"
          value={etaInput}
          onChange={e => setEtaInput(e.target.value)}
          style={{ marginBottom: 18, maxWidth: 280 }}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => apply(isOn)}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Save message{isOn ? ' & schedule' : ''}
          </button>
          {!isOn && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Saved details will be used the next time you turn maintenance on.
            </span>
          )}
        </div>
      </div>

      {/* What this does */}
      <div className="card mt-5" style={{ background: 'var(--surface-100)' }}>
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={15} style={{ color: '#6366f1' }} />
          <h3 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            What happens when this is on
          </h3>
        </div>
        <ul className="text-xs space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>• Teachers, students, and regular admins see only the maintenance screen — they can't reach any page or API.</li>
          <li>• Anyone already signed in stays signed in; they're returned to their dashboard automatically once you turn it off.</li>
          <li>• Only you, the super admin, keep full access so you can finish your changes and switch it off.</li>
          <li>• The maintenance screen rechecks status automatically every 20 seconds — no one needs to refresh manually.</li>
        </ul>
      </div>

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => apply(confirmAction === 'enable')}
        loading={saving}
        variant={confirmAction === 'enable' ? 'danger' : 'default'}
        title={confirmAction === 'enable' ? 'Turn on maintenance mode?' : 'Turn off maintenance mode?'}
        message={
          confirmAction === 'enable'
            ? 'Every teacher, student, and regular admin will immediately be shown the maintenance screen instead of EDUPLA. You can turn it off any time.'
            : 'Everyone will regain normal access to EDUPLA right away.'
        }
        confirmText={confirmAction === 'enable' ? 'Turn On' : 'Turn Off'}
      />
    </div>
  );
}