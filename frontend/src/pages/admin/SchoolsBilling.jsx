import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Building2, Search, RefreshCw, Lock, Unlock, PlusCircle, Clock,
  CheckCircle2, AlertTriangle, ShieldAlert, X, Loader2, Mail, Phone,
  CalendarClock, Sparkles,
} from 'lucide-react';

const TOKENS = {
  purple: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
};

const STATUS_META = {
  trialing: { label: 'Trialing', color: TOKENS.amber, bg: 'rgba(245,158,11,0.1)', icon: Clock },
  active: { label: 'Active', color: TOKENS.emerald, bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: TOKENS.rose, bg: 'rgba(244,63,94,0.1)', icon: AlertTriangle },
  locked: { label: 'Locked', color: TOKENS.slate, bg: 'rgba(100,116,139,0.12)', icon: ShieldAlert },
};

const GLOBAL_STYLES = `
  @keyframes sb-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sb-scale { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .sb-row { animation: sb-fade 0.35s ease both; }
  .sb-modal { animation: sb-scale 0.2s ease both; }
  .sb-btn { transition: transform .15s, filter .15s, box-shadow .15s; }
  .sb-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
  .sb-btn:active:not(:disabled) { transform: translateY(0); }
`;

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CountdownLabel({ billing }) {
  if (billing.status === 'locked') return <span style={{ color: TOKENS.slate, fontWeight: 700 }}>Locked</span>;
  if (billing.status === 'overdue') return <span style={{ color: TOKENS.rose, fontWeight: 700 }}>Access blocked</span>;
  const label = billing.status === 'active' ? 'renews in' : 'auto-locks in';
  return (
    <span>
      <strong style={{ color: 'var(--text-primary)' }}>{billing.days_remaining}</strong>{' '}
      <span style={{ color: 'var(--text-secondary)' }}>day{billing.days_remaining === 1 ? '' : 's'} · {label}</span>
    </span>
  );
}

// ── Lock modal (needs a free-text reason) ───────────────────────────────
function LockModal({ school, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/system/billing/schools/${school.id}/lock`, { reason: reason.trim() });
      toast.success(`${school.name} has been locked.`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to lock school.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="sb-modal" style={{ width: '100%', maxWidth: 420, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(244,63,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={16} color={TOKENS.rose} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Lock {school.name}</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Everyone at this school — admin, teachers, and students — will immediately see a locked-access screen, regardless of their trial or payment status. Paying won't undo this; only unlocking will.
        </p>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Reason (shown to the school admin)
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Testing lock/unlock flow"
          rows={3}
          style={{
            width: '100%', borderRadius: 12, border: '1px solid var(--card-border)',
            background: 'var(--surface-100)', color: 'var(--text-primary)',
            padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={saving} className="sb-btn" style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--card-border)',
            background: 'var(--surface-100)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="sb-btn" style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
            background: TOKENS.rose, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Lock school
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Extend modal (grant extra paid days manually) ───────────────────────
function ExtendModal({ school, onClose, onDone }) {
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!days || days <= 0) return toast.error('Enter a positive number of days.');
    setSaving(true);
    try {
      await api.post(`/system/billing/schools/${school.id}/extend`, { days: Number(days) });
      toast.success(`${school.name} extended by ${days} day(s).`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extend school.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="sb-modal" style={{ width: '100%', maxWidth: 380, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlusCircle size={16} color={TOKENS.emerald} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Extend {school.name}</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
          Grants extra paid days without going through MTN — useful for a comp, goodwill extension, or fixing a payment that didn't get recorded.
        </p>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Days to add
        </label>
        <input
          type="number"
          min="1"
          value={days}
          onChange={e => setDays(e.target.value)}
          style={{
            width: '100%', borderRadius: 12, border: '1px solid var(--card-border)',
            background: 'var(--surface-100)', color: 'var(--text-primary)',
            padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={saving} className="sb-btn" style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--card-border)',
            background: 'var(--surface-100)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="sb-btn" style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
            background: TOKENS.emerald, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />} Extend
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchoolsBilling() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [lockTarget, setLockTarget] = useState(null);
  const [extendTarget, setExtendTarget] = useState(null);
  const [unlockingId, setUnlockingId] = useState(null);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await api.get('/system/billing/schools');
      setSchools(res.data.schools);
    } catch {
      toast.error('Failed to load schools.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const unlock = async (school) => {
    setUnlockingId(school.id);
    try {
      await api.post(`/system/billing/schools/${school.id}/unlock`);
      toast.success(`${school.name} has been unlocked.`);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unlock school.');
    } finally {
      setUnlockingId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { all: schools.length, trialing: 0, active: 0, overdue: 0, locked: 0 };
    schools.forEach(s => { c[s.billing.status] = (c[s.billing.status] || 0) + 1; });
    return c;
  }, [schools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter(s => {
      if (filter !== 'all' && s.billing.status !== filter) return false;
      if (!q) return true;
      return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    });
  }, [schools, query, filter]);

  return (
    <div style={{ padding: '28px 28px 60px' }}>
      <style>{GLOBAL_STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Schools & Billing</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {counts.all} school{counts.all === 1 ? '' : 's'} · {counts.overdue} overdue · {counts.locked} locked
            </p>
          </div>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="sb-btn" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11,
          border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)',
          fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        }}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'trialing', 'active', 'overdue', 'locked'].map(key => {
          const meta = STATUS_META[key];
          const active = filter === key;
          return (
            <button key={key} onClick={() => setFilter(key)} className="sb-btn" style={{
              padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${active ? (meta?.color || TOKENS.purple) : 'var(--card-border)'}`,
              background: active ? (meta?.bg || 'rgba(99,102,241,0.1)') : 'var(--surface-100)',
              color: active ? (meta?.color || TOKENS.purple) : 'var(--text-secondary)',
              textTransform: 'capitalize',
            }}>
              {key === 'all' ? 'All' : meta.label} ({counts[key] || 0})
            </button>
          );
        })}
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search school or email..."
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 11,
              border: '1px solid var(--card-border)', background: 'var(--surface-100)',
              color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1.3fr 1fr', gap: 10,
          padding: '12px 18px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid var(--card-border)',
        }}>
          <span>School</span>
          <span>Status</span>
          <span>Countdown</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Loading schools…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            No schools match this filter.
          </div>
        ) : (
          filtered.map((school, i) => {
            const meta = STATUS_META[school.billing.status];
            const StatusIcon = meta.icon;
            return (
              <div key={school.id} className="sb-row" style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1.3fr 1fr', gap: 10, alignItems: 'center',
                padding: '14px 18px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--card-border)',
                animationDelay: `${i * 0.02}s`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {school.name}
                  </p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <Mail size={10} /> {school.email}
                  </p>
                </div>

                <div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
                    background: meta.bg, color: meta.color, fontSize: 11.5, fontWeight: 700,
                  }}>
                    <StatusIcon size={11} /> {meta.label}
                  </span>
                </div>

                <div style={{ fontSize: 12.5 }}>
                  <CountdownLabel billing={school.billing} />
                  <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {school.billing.status === 'active'
                      ? `Until ${formatDate(school.billing.paid_until)}`
                      : school.billing.status === 'trialing'
                        ? `Trial ends ${formatDate(school.billing.trial_ends_at)}`
                        : school.billing.status === 'locked'
                          ? (school.billing.locked_reason || 'No reason given')
                          : `Since ${formatDate(school.billing.trial_ends_at)}`}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {school.billing.status === 'locked' ? (
                    <button onClick={() => unlock(school)} disabled={unlockingId === school.id} className="sb-btn" style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 10,
                      border: 'none', background: TOKENS.emerald, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      {unlockingId === school.id ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />} Unlock
                    </button>
                  ) : (
                    <button onClick={() => setLockTarget(school)} className="sb-btn" style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 10,
                      border: `1px solid ${TOKENS.rose}`, background: 'transparent', color: TOKENS.rose, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <Lock size={12} /> Lock
                    </button>
                  )}
                  <button onClick={() => setExtendTarget(school)} className="sb-btn" style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 10,
                    border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  }}>
                    <CalendarClock size={12} /> Extend
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {lockTarget && (
        <LockModal school={lockTarget} onClose={() => setLockTarget(null)} onDone={() => { setLockTarget(null); load(true); }} />
      )}
      {extendTarget && (
        <ExtendModal school={extendTarget} onClose={() => setExtendTarget(null)} onDone={() => { setExtendTarget(null); load(true); }} />
      )}
    </div>
  );
}
