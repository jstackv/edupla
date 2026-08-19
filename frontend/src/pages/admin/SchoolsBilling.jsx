import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Building2, Search, RefreshCw, Lock, Unlock, PlusCircle, Clock,
  CheckCircle2, AlertTriangle, ShieldAlert, Loader2, Mail,
  CalendarClock, ArrowUp, ArrowDown, Inbox,
} from 'lucide-react';

const TOKENS = {
  purple: '#6366f1',
  purpleDeep: '#4338ca',
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
  @keyframes sb-fade { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sb-scale { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes sb-ring-sweep { from { stroke-dashoffset: var(--sb-ring-circ); } to { stroke-dashoffset: var(--sb-ring-offset); } }
  @keyframes sb-urgent-pulse { 0%,100% { filter: drop-shadow(0 0 0 rgba(244,63,94,0)); } 50% { filter: drop-shadow(0 0 6px rgba(244,63,94,0.55)); } }
  @keyframes sb-shimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }

  .sb-row { animation: sb-fade 0.4s cubic-bezier(0.16,1,0.3,1) both; position: relative; }
  .sb-row::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--sb-accent, transparent); transform: scaleY(0); transform-origin: center;
    transition: transform 0.25s cubic-bezier(0.16,1,0.3,1);
  }
  .sb-row:hover::before { transform: scaleY(1); }
  .sb-row:hover { background: rgba(99,102,241,0.03); }

  .sb-modal { animation: sb-scale 0.22s cubic-bezier(0.16,1,0.3,1) both; }

  .sb-btn { transition: transform .15s cubic-bezier(0.16,1,0.3,1), filter .15s, box-shadow .2s, background .15s, border-color .15s; }
  .sb-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
  .sb-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
  .sb-btn:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }

  .sb-search input:focus { outline: 2px solid #6366f1; outline-offset: 1px; }

  .sb-ring-urgent { animation: sb-urgent-pulse 2s ease-in-out infinite; }

  .sb-skel {
    background: linear-gradient(90deg, var(--surface-100) 25%, rgba(148,163,184,0.14) 37%, var(--surface-100) 63%);
    background-size: 400px 100%;
    animation: sb-shimmer 1.4s ease-in-out infinite;
    border-radius: 8px;
  }

  .sb-stat-card { transition: transform .2s cubic-bezier(0.16,1,0.3,1), box-shadow .2s, border-color .2s; }
  .sb-stat-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,0.12); }

  .sb-th-sort { cursor: pointer; user-select: none; transition: color .15s; }
  .sb-th-sort:hover { color: var(--text-primary) !important; }

  @media (prefers-reduced-motion: reduce) {
    .sb-row, .sb-modal, .sb-ring-urgent, .sb-skel { animation: none !important; }
  }
`;

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Animated count-up, respects prefers-reduced-motion ───────────────────
function CountUp({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setDisplay(value); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <>{display}</>;
}

// ── Radial countdown ring — the page's signature element. Fills based on
// urgency (green when comfortable, amber mid-range, red + pulsing when a
// school is about to lock), so the visual encodes real information rather
// than decorating a number that's already printed next to it. ───────────
function RadialCountdown({ billing, size = 40 }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  if (billing.status === 'locked') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(100,116,139,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Lock size={14} color={TOKENS.slate} />
      </div>
    );
  }
  if (billing.status === 'overdue') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(244,63,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <AlertTriangle size={14} color={TOKENS.rose} />
      </div>
    );
  }

  // Visual reference scale: 30 days reads as "comfortable" (full ring),
  // fewer than that starts draining. This is an urgency gauge, not a
  // literal fraction of the plan purchased (which varies per extend).
  const ref = 30;
  const pct = Math.max(0, Math.min(1, billing.days_remaining / ref));
  const offset = circ * (1 - pct);
  const urgent = billing.days_remaining <= 3;
  const color = urgent ? TOKENS.rose : billing.days_remaining <= 10 ? TOKENS.amber : TOKENS.emerald;

  return (
    <div
      className={urgent ? 'sb-ring-urgent' : ''}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0, '--sb-ring-circ': circ, '--sb-ring-offset': offset }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-100)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ}
          style={{ animation: 'sb-ring-sweep 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s forwards' }}
        />
      </svg>
      <span style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 11, color: 'var(--text-primary)',
      }}>
        {billing.days_remaining}
      </span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, active, onClick }) {
  return (
    <button onClick={onClick} className="sb-stat-card sb-btn" style={{
      flex: '1 1 120px', minWidth: 120, textAlign: 'left', cursor: 'pointer',
      padding: '14px 16px', borderRadius: 16,
      background: 'var(--card-bg)', border: `1.5px solid ${active ? color : 'var(--card-border)'}`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={12} color={color} />
        </div>
      </div>
      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--text-primary)', lineHeight: 1 }}>
        <CountUp value={value} />
      </span>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.3fr 1fr', gap: 10, alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid var(--card-border)' }}>
      <div><div className="sb-skel" style={{ height: 13, width: '60%', marginBottom: 6 }} /><div className="sb-skel" style={{ height: 10, width: '80%' }} /></div>
      <div className="sb-skel" style={{ height: 22, width: 74, borderRadius: 999 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="sb-skel" style={{ width: 40, height: 40, borderRadius: '50%' }} /><div className="sb-skel" style={{ height: 12, width: 90 }} /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}><div className="sb-skel" style={{ height: 28, width: 60, borderRadius: 10 }} /><div className="sb-skel" style={{ height: 28, width: 70, borderRadius: 10 }} /></div>
    </div>
  );
}

// ── Lock modal ────────────────────────────────────────────────────────
function LockModal({ school, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [payable, setPayable] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/system/billing/schools/${school.id}/lock`, { reason: reason.trim(), payable });
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
          Everyone at this school — admin, teachers, and students — will immediately see a locked-access screen, regardless of their trial or payment status.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {[
            { value: true, title: 'Payment unlocks it', desc: 'The school admin sees the payment form and paying immediately lifts the lock — like a forced early renewal.' },
            { value: false, title: 'Manual unlock only', desc: 'Payment is disabled entirely. Only you can restore access, regardless of payment — for testing, abuse, or policy holds.' },
          ].map(opt => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setPayable(opt.value)}
              className="sb-btn"
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${payable === opt.value ? TOKENS.rose : 'var(--card-border)'}`,
                background: payable === opt.value ? 'rgba(244,63,94,0.06)' : 'var(--surface-100)',
              }}
            >
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{opt.title}</p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.4 }}>{opt.desc}</p>
            </button>
          ))}
        </div>

        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Reason (shown to the school admin)
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Testing lock/unlock flow"
          rows={3}
          className="sb-search"
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

// ── Extend modal ──────────────────────────────────────────────────────
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
          className="sb-search"
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
  const [sortDir, setSortDir] = useState('asc'); // by days_remaining
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
    const list = schools.filter(s => {
      if (filter !== 'all' && s.billing.status !== filter) return false;
      if (!q) return true;
      return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => {
      const diff = a.billing.days_remaining - b.billing.days_remaining;
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [schools, query, filter, sortDir]);

  return (
    <div style={{ padding: '28px 28px 60px' }}>
      <style>{GLOBAL_STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: `linear-gradient(135deg, ${TOKENS.purple}, ${TOKENS.purpleDeep})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(99,102,241,0.35)',
          }}>
            <Building2 size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Schools & Billing</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Subscription health across every school
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

      {/* Stat cards — click to filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <StatCard icon={Building2} label="All schools" value={counts.all} color={TOKENS.purple} active={filter === 'all'} onClick={() => setFilter('all')} />
        <StatCard icon={Clock} label="Trialing" value={counts.trialing} color={TOKENS.amber} active={filter === 'trialing'} onClick={() => setFilter('trialing')} />
        <StatCard icon={CheckCircle2} label="Active" value={counts.active} color={TOKENS.emerald} active={filter === 'active'} onClick={() => setFilter('active')} />
        <StatCard icon={AlertTriangle} label="Overdue" value={counts.overdue} color={TOKENS.rose} active={filter === 'overdue'} onClick={() => setFilter('overdue')} />
        <StatCard icon={ShieldAlert} label="Locked" value={counts.locked} color={TOKENS.slate} active={filter === 'locked'} onClick={() => setFilter('locked')} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div className="sb-search" style={{ position: 'relative', minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search school or email..."
            style={{
              width: '100%', padding: '9px 12px 9px 32px', borderRadius: 11,
              border: '1px solid var(--card-border)', background: 'var(--surface-100)',
              color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="sb-btn" style={{
            padding: '7px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${STATUS_META[filter]?.color}`, background: STATUS_META[filter]?.bg, color: STATUS_META[filter]?.color,
          }}>
            {STATUS_META[filter]?.label} ✕
          </button>
        )}
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
          <span
            className="sb-th-sort"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Countdown {sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          </span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {loading ? (
          <>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '52px 20px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Inbox size={22} color="var(--text-secondary)" />
            </div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              {query ? 'No matches' : 'No schools here yet'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {query ? `Nothing matches "${query}" in this view.` : 'Schools will appear here once admins sign up.'}
            </p>
          </div>
        ) : (
          filtered.map((school, i) => {
            const meta = STATUS_META[school.billing.status];
            const StatusIcon = meta.icon;
            return (
              <div key={school.id} className="sb-row" style={{
                '--sb-accent': meta.color,
                display: 'grid', gridTemplateColumns: '2fr 1fr 1.3fr 1fr', gap: 10, alignItems: 'center',
                padding: '14px 18px 14px 21px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--card-border)',
                animationDelay: `${Math.min(i, 8) * 0.03}s`,
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
                  {school.billing.status === 'locked' && (
                    <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      {school.billing.locked_payable ? 'Payment allowed' : 'Manual unlock only'}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RadialCountdown billing={school.billing} />
                  <div style={{ fontSize: 11.5 }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {school.billing.status === 'locked' ? 'Locked' : school.billing.status === 'overdue' ? 'Blocked' : `${school.billing.days_remaining}d left`}
                    </p>
                    <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: '1px 0 0' }}>
                      {school.billing.status === 'active'
                        ? `Until ${formatDate(school.billing.paid_until)}`
                        : school.billing.status === 'trialing'
                          ? `Trial ends ${formatDate(school.billing.trial_ends_at)}`
                          : school.billing.status === 'locked'
                            ? (school.billing.locked_reason || 'No reason given')
                            : `Since ${formatDate(school.billing.trial_ends_at)}`}
                    </p>
                  </div>
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