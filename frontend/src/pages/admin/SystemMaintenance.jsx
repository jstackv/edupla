import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  Settings, Power, PowerOff, Clock, ShieldAlert, CheckCircle2,
  AlertTriangle, Sparkles, Loader2,
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