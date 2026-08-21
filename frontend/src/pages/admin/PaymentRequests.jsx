import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { usePendingPayments } from '../../context/PendingPaymentsContext';
import {
  Wallet, Search, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  Settings2, Plus, Pencil, Trash2, X, Mail, Smartphone, Building2,
  Inbox, TrendingUp, CircleDollarSign, ListChecks, RotateCcw, AlertTriangle,
  Printer, Receipt, GraduationCap, ChevronUp, ChevronDown, Tag, ToggleLeft, ToggleRight,
} from 'lucide-react';

const TOKENS = { emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b', slate: '#64748b', gold: '#d97706', indigo: '#6366f1' };

const STATUS_META = {
  PENDING: { label: 'Pending', color: TOKENS.amber, bg: 'rgba(245,158,11,0.1)', icon: Clock },
  SUCCESSFUL: { label: 'Confirmed', color: TOKENS.emerald, bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: TOKENS.rose, bg: 'rgba(244,63,94,0.1)', icon: XCircle },
};

const GLOBAL_STYLES = `
  @keyframes pr-fade { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pr-scale { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes pr-shimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
  @keyframes pr-stamp-in {
    0% { opacity: 0; transform: scale(2.2) rotate(-18deg); }
    60% { opacity: 1; }
    100% { opacity: 1; transform: scale(1) rotate(-10deg); }
  }
  @keyframes pr-glow-emerald { 0%,100% { box-shadow: 0 0 0 rgba(16,185,129,0); } 50% { box-shadow: 0 0 14px rgba(16,185,129,0.25); } }

  .pr-row { animation: pr-fade 0.4s cubic-bezier(0.16,1,0.3,1) both; position: relative; transition: background .15s; }
  .pr-row:hover { background: rgba(99,102,241,0.025); }
  .pr-row.is-pending { border-left: 3px solid ${TOKENS.amber}; }
  .pr-row:not(.is-pending) { border-left: 3px solid transparent; }

  .pr-modal { animation: pr-scale 0.2s cubic-bezier(0.16,1,0.3,1) both; }
  .pr-btn { transition: transform .15s cubic-bezier(0.16,1,0.3,1), filter .15s, box-shadow .2s; }
  .pr-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
  .pr-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
  .pr-btn:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
  .pr-search input:focus, .pr-check:focus-visible { outline: 2px solid #6366f1; outline-offset: 1px; }

  .pr-stat-card { transition: transform .2s cubic-bezier(0.16,1,0.3,1), box-shadow .2s; }
  .pr-stat-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,0.12); }
  .pr-stat-glow { animation: pr-glow-emerald 3s ease-in-out infinite; }

  .pr-perforation {
    background-image: radial-gradient(circle, var(--card-border) 1.4px, transparent 1.4px);
    background-size: 8px 8px; background-position: center;
  }

  .pr-stamp { animation: pr-stamp-in 0.5s cubic-bezier(0.16,1,0.3,1) both; }

  .pr-skel {
    background: linear-gradient(90deg, var(--surface-100) 25%, rgba(148,163,184,0.14) 37%, var(--surface-100) 63%);
    background-size: 400px 100%;
    animation: pr-shimmer 1.4s ease-in-out infinite;
    border-radius: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .pr-row, .pr-modal, .pr-stamp, .pr-skel, .pr-stat-glow { animation: none !important; }
  }

  @media print {
    body * { visibility: hidden; }
    #pr-receipt-printable, #pr-receipt-printable * { visibility: visible; }
    #pr-receipt-printable { position: fixed; inset: 0; padding: 32px; }
  }
`;

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatMoney(amount, currency) {
  if (amount === undefined || amount === null) return '—';
  const n = Number(amount);
  return `${Number.isFinite(n) ? n.toLocaleString('en-US') : amount} ${currency || ''}`.trim();
}

function CountUp({ value, duration = 700, format }) {
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
  return <>{format ? format(display) : display}</>;
}

function StatCard({ icon: Icon, label, value, color, format, glow }) {
  return (
    <div className={`pr-stat-card ${glow ? 'pr-stat-glow' : ''}`} style={{
      flex: '1 1 150px', minWidth: 150, padding: '14px 16px', borderRadius: 16,
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
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
      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', lineHeight: 1 }}>
        <CountUp value={value} format={format} />
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div className="pr-skel" style={{ width: 38, height: 38, borderRadius: 10 }} />
      <div style={{ flex: 1 }}><div className="pr-skel" style={{ height: 13, width: '35%', marginBottom: 6 }} /><div className="pr-skel" style={{ height: 10, width: '55%' }} /></div>
      <div className="pr-skel" style={{ height: 14, width: 90 }} />
      <div className="pr-skel" style={{ height: 22, width: 74, borderRadius: 999 }} />
    </div>
  );
}

// ── Stamp overlay for resolved claims — leans into the fact that this
// literally IS a receipt-verification workflow: confirming stamps it like
// an approved chit, rejecting stamps it in red. ──────────────────────────
function Stamp({ status }) {
  const isConfirmed = status === 'SUCCESSFUL';
  return (
    <div className="pr-stamp" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
      border: `2px solid ${isConfirmed ? TOKENS.emerald : TOKENS.rose}`, borderRadius: 6,
      color: isConfirmed ? TOKENS.emerald : TOKENS.rose, fontSize: 10, fontWeight: 800,
      letterSpacing: '0.06em', textTransform: 'uppercase', transform: 'rotate(-10deg)',
      opacity: 0.85,
    }}>
      {isConfirmed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {isConfirmed ? 'Verified' : 'Declined'}
    </div>
  );
}

// ── Printable receipt for a confirmed payment ────────────────────────────
function ReceiptModal({ payment, onClose }) {
  const isManual = payment.method === 'manual';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="pr-modal" style={{ width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto', background: 'var(--card-bg)', borderRadius: 22, border: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Receipt</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} className="pr-btn" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: 'none', background: TOKENS.indigo, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={12} /> Print
            </button>
            <button onClick={onClose} className="pr-btn" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        <div id="pr-receipt-printable" style={{ padding: '28px 26px', background: '#fff', color: '#0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={17} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 16, color: '#1e1b4b' }}>EDUPLA</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#1e1b4b' }}>Payment Receipt</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>#{String(payment._id).slice(-10).toUpperCase()}</p>
            </div>
            <div className="pr-stamp" style={{
              border: '2.5px solid #10b981', borderRadius: 8, padding: '5px 12px', color: '#10b981',
              fontWeight: 800, fontSize: 12, letterSpacing: '0.08em', transform: 'rotate(-8deg)', opacity: 0.9,
            }}>
              PAID
            </div>
          </div>

          <div style={{ borderTop: '1.5px dashed #e2e8f0', borderBottom: '1.5px dashed #e2e8f0', padding: '16px 0', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['School', payment.admin_id?.name || 'Unknown school'],
              ['Email', payment.admin_id?.email || '—'],
              ['Plan', payment.plan_name || `${payment.plan_days}-day plan`],
              ['Amount', formatMoney(payment.amount, payment.currency)],
              ['Payment method', isManual ? 'MTN MoMo (manual transfer)' : 'MTN MoMo (API)'],
              ['Paid via', payment.phone],
              ['Confirmed by', payment.reviewed_by?.name || '—'],
              ['Date confirmed', formatDate(payment.reviewed_at || payment.created_at)],
              ['Access valid until', formatDate(payment.paid_until_after)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, gap: 12 }}>
                <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0 }}>{label}</span>
                <span style={{ color: '#1e1b4b', fontWeight: 700, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>Total paid</span>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: '#d97706' }}>
              {formatMoney(payment.amount, payment.currency)}
            </span>
          </div>

          <p style={{ fontSize: 10.5, color: '#94a3b8', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            Issued by Edupla administration.<br />
            Reference #{String(payment._id).slice(-10).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Reject reason modal ───────────────────────────────────────────────
function RejectModal({ payments, onClose, onDone }) {
  const isBulk = payments.length > 1;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await Promise.all(payments.map(p => api.post(`/system/billing/manual-payments/${p._id}/reject`, { reason: reason.trim() })));
      toast.success(isBulk ? `${payments.length} claims rejected.` : 'Payment claim rejected.');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject claim(s).');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="pr-modal" style={{ width: '100%', maxWidth: 400, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(244,63,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={16} color={TOKENS.rose} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {isBulk ? `Reject ${payments.length} claims` : 'Reject payment claim'}
          </h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
          {isBulk
            ? 'Every selected school stays locked out after rejecting.'
            : `${payments[0].admin_id?.name} claimed ${formatMoney(payments[0].amount, payments[0].currency)} for ${payments[0].plan_name}. The school stays locked out after rejecting.`}
        </p>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Reason (optional, for your own records)
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. No matching transaction found in wallet"
          rows={3}
          className="pr-search"
          style={{
            width: '100%', borderRadius: 12, border: '1px solid var(--card-border)',
            background: 'var(--surface-100)', color: 'var(--text-primary)',
            padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={saving} className="pr-btn" style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--card-border)',
            background: 'var(--surface-100)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="pr-btn" style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
            background: TOKENS.rose, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan tier manager modal ──────────────────────────────────────────────
function PlanManagerModal({ onClose }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', amount: '', currency: 'RWF', days: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [reorderingId, setReorderingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/billing/plans');
      setPlans(res.data.plans);
    } catch {
      toast.error('Failed to load plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (plan) => {
    setEditing(plan._id);
    setForm({ name: plan.name, amount: plan.amount, currency: plan.currency, days: plan.days, sort_order: plan.sort_order });
  };

  const startNew = () => {
    setEditing('new');
    setForm({ name: '', amount: '', currency: 'RWF', days: '', sort_order: plans.length });
  };

  const save = async () => {
    if (!form.name.trim() || !form.amount || !form.days) return toast.error('Fill in name, amount, and days.');
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.post('/system/billing/plans', form);
        toast.success('Plan created.');
      } else {
        await api.put(`/system/billing/plans/${editing}`, form);
        toast.success('Plan updated.');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (plan) => {
    try {
      await api.put(`/system/billing/plans/${plan._id}`, { active: !plan.active });
      load();
    } catch {
      toast.error('Failed to update plan.');
    }
  };

  const remove = async (plan) => {
    if (!window.confirm(`Delete "${plan.name}"? This won't affect past payments.`)) return;
    try {
      await api.delete(`/system/billing/plans/${plan._id}`);
      toast.success('Plan deleted.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete plan.');
    }
  };

  // Swaps this plan's sort_order with its neighbor and persists both, so
  // the display order super admins set here is exactly what school admins
  // see when choosing a plan on the paywall.
  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= plans.length) return;
    const a = plans[index], b = plans[target];
    setReorderingId(a._id);
    try {
      await Promise.all([
        api.put(`/system/billing/plans/${a._id}`, { sort_order: b.sort_order }),
        api.put(`/system/billing/plans/${b._id}`, { sort_order: a.sort_order }),
      ]);
      await load();
    } catch {
      toast.error('Failed to reorder plans.');
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="pr-modal" style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 22, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#6366f1,#4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(99,102,241,0.35)' }}>
              <Settings2 size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Payment plans</h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '1px 0 0' }}>What schools see on the paywall, in this order</p>
            </div>
          </div>
          <button onClick={onClose} className="pr-btn" style={{ width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={14} color="var(--text-secondary)" />
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--card-border)', margin: '16px 0' }} />

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Loading plans…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plans.length === 0 && (
              <div style={{ padding: '28px 10px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <Tag size={19} color="var(--text-secondary)" />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 3px' }}>No plans yet</p>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0 }}>Add your first pricing tier below.</p>
              </div>
            )}

            {plans.map((plan, i) => (
              <div key={plan._id} className="pr-row" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 14, border: '1px solid var(--card-border)',
                background: 'var(--surface-100)', opacity: plan.active ? 1 : 0.5,
                animationDelay: `${i * 0.03}s`,
              }}>
                {/* Reorder controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0 || reorderingId} className="pr-btn" style={{
                    width: 20, height: 16, borderRadius: 5, border: 'none', background: 'var(--card-bg)', cursor: i === 0 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: i === 0 ? 0.3 : 1,
                  }}>
                    <ChevronUp size={11} color="var(--text-secondary)" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === plans.length - 1 || reorderingId} className="pr-btn" style={{
                    width: 20, height: 16, borderRadius: 5, border: 'none', background: 'var(--card-bg)', cursor: i === plans.length - 1 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: i === plans.length - 1 ? 0.3 : 1,
                  }}>
                    <ChevronDown size={11} color="var(--text-secondary)" />
                  </button>
                </div>

                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(67,56,202,0.1))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Tag size={15} color={TOKENS.indigo} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{plan.name}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: TOKENS.gold, fontWeight: 700 }}>{formatMoney(plan.amount, plan.currency)}</span>
                    <span>·</span>
                    <span>{plan.days} days</span>
                    {!plan.active && <span style={{ color: TOKENS.slate }}>· inactive</span>}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => toggleActive(plan)} className="pr-btn" title={plan.active ? 'Deactivate' : 'Activate'} style={{
                    border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 4,
                  }}>
                    {plan.active
                      ? <ToggleRight size={26} color={TOKENS.emerald} />
                      : <ToggleLeft size={26} color="var(--text-secondary)" />}
                  </button>
                  <button onClick={() => startEdit(plan)} className="pr-btn" style={{
                    width: 30, height: 30, borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Pencil size={12} color="var(--text-secondary)" />
                  </button>
                  <button onClick={() => remove(plan)} className="pr-btn" style={{
                    width: 30, height: 30, borderRadius: 9, border: `1px solid ${TOKENS.rose}`, background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Trash2 size={12} color={TOKENS.rose} />
                  </button>
                </div>
              </div>
            ))}

            {editing ? (
              <div className="pr-modal" style={{ padding: 16, borderRadius: 16, border: `1.5px solid ${TOKENS.indigo}`, background: 'rgba(99,102,241,0.05)', marginTop: 6 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.indigo, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
                  {editing === 'new' ? 'New plan' : 'Edit plan'}
                </p>
                <input
                  placeholder="Plan name — e.g. 1 Month" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', marginBottom: 8, fontFamily: 'inherit' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr', gap: 8, marginBottom: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number" placeholder="Amount" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      style={{ width: '100%', padding: '10px 52px 10px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                    <input
                      value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      style={{
                        position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', width: 44, textAlign: 'center',
                        padding: '5px 4px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--surface-100)',
                        color: 'var(--text-secondary)', fontSize: 10.5, fontWeight: 700, boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <input
                    type="number" placeholder="Days" value={form.days}
                    onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setEditing(null)} className="pr-btn" style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={save} disabled={saving} className="pr-btn" style={{
                    flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: TOKENS.indigo, color: '#fff',
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    {saving ? 'Saving…' : 'Save plan'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={startNew} className="pr-btn" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px', borderRadius: 14, border: `1.5px dashed ${TOKENS.indigo}`,
                background: 'rgba(99,102,241,0.04)', color: TOKENS.indigo, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginTop: 4,
              }}>
                <Plus size={14} /> Add plan
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Clear-history confirmation — irreversible, so the super admin must
// explicitly pick a scope (one school, or everything) and see exactly who
// they're about to wipe before typing a confirmation phrase. ────────────
function ClearHistoryModal({ payments, onClose, onDone }) {
  // One entry per distinct school that has at least one payment record,
  // each with its own count — this is what makes the scope concrete
  // instead of a vague "clear everything" button.
  const schools = useMemo(() => {
    const map = new Map();
    payments.forEach(p => {
      const id = p.admin_id?._id;
      if (!id) return;
      if (!map.has(id)) map.set(id, { id, name: p.admin_id?.name || 'Unknown school', email: p.admin_id?.email, count: 0 });
      map.get(id).count += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [payments]);

  const [scope, setScope] = useState(schools.length === 1 ? schools[0].id : 'all');
  const [typed, setTyped] = useState('');
  const [clearing, setClearing] = useState(false);

  const selectedSchool = scope !== 'all' ? schools.find(s => s.id === scope) : null;
  const confirmPhrase = scope === 'all' ? 'DELETE ALL' : 'DELETE';
  const scopedCount = scope === 'all' ? payments.length : (selectedSchool?.count || 0);

  const submit = async () => {
    setClearing(true);
    try {
      const res = scope === 'all'
        ? await api.delete('/system/billing/payments')
        : await api.delete(`/system/billing/schools/${scope}/payments`);
      toast.success(res.data.message || 'Payment history cleared.');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear payment history.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="pr-modal" style={{ width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto', background: 'var(--card-bg)', border: `1.5px solid ${TOKENS.rose}`, borderRadius: 20, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(244,63,94,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={18} color={TOKENS.rose} />
          </div>
          <h3 style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Clear payment history</h3>
        </div>

        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
          What should be cleared?
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
          <button
            type="button"
            onClick={() => { setScope('all'); setTyped(''); }}
            className="pr-btn"
            style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
              border: `1.5px solid ${scope === 'all' ? TOKENS.rose : 'var(--card-border)'}`,
              background: scope === 'all' ? 'rgba(244,63,94,0.06)' : 'var(--surface-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}
          >
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>All schools</p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Every payment record, platform-wide</p>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: TOKENS.rose, flexShrink: 0 }}>{payments.length}</span>
          </button>

          {schools.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setScope(s.id); setTyped(''); }}
              className="pr-btn"
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${scope === s.id ? TOKENS.rose : 'var(--card-border)'}`,
                background: scope === s.id ? 'rgba(244,63,94,0.06)' : 'var(--surface-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</p>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: TOKENS.rose, flexShrink: 0 }}>{s.count}</span>
            </button>
          ))}
        </div>

        {/* Identity confirmation — exactly who/what is about to be wiped */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', marginBottom: 14,
          borderRadius: 12, border: '1.5px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.05)',
        }}>
          <Trash2 size={16} color={TOKENS.rose} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {scope === 'all' ? `Deleting all ${scopedCount} record(s), every school` : `Deleting ${scopedCount} record(s) for ${selectedSchool?.name}`}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Access levels are untouched — this only clears the historical log. Cannot be undone.
            </p>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Type <strong style={{ color: 'var(--text-primary)' }}>{confirmPhrase}</strong> to confirm
        </label>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={confirmPhrase}
          className="pr-search"
          style={{
            width: '100%', borderRadius: 12, border: `1px solid ${typed === confirmPhrase ? TOKENS.rose : 'var(--card-border)'}`,
            background: 'var(--surface-100)', color: 'var(--text-primary)',
            padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={clearing} className="pr-btn" style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--card-border)',
            background: 'var(--surface-100)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={submit} disabled={clearing || typed !== confirmPhrase} className="pr-btn" style={{
            flex: 1, padding: '10px 14px', borderRadius: 12, border: 'none',
            background: TOKENS.rose, color: '#fff', fontWeight: 700, fontSize: 13,
            cursor: typed === confirmPhrase ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: clearing || typed !== confirmPhrase ? 0.5 : 1,
          }}>
            {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Clear {scope === 'all' ? 'everything' : selectedSchool?.name}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentRequests() {
  const { refresh: refreshBadge } = usePendingPayments() || {};
  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [rejectTarget, setRejectTarget] = useState(null); // array of payments
  const [confirmingId, setConfirmingId] = useState(null);
  const [showPlanManager, setShowPlanManager] = useState(false);
  const [showClearHistory, setShowClearHistory] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState(null);

  // Single fetch of everything — tab switching and search then filter
  // client-side instantly instead of round-tripping per click, and it lets
  // the stat cards reflect the whole dataset regardless of which tab is
  // currently open.
  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await api.get('/system/billing/manual-payments');
      setAllPayments(res.data.payments);
    } catch {
      toast.error('Failed to load payment claims.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirm = async (payment) => {
    setConfirmingId(payment._id);
    try {
      await api.post(`/system/billing/manual-payments/${payment._id}/confirm`);
      toast.success(`Confirmed — ${payment.admin_id?.name}'s school access restored.`);
      load(true);
      refreshBadge?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm payment.');
    } finally {
      setConfirmingId(null);
    }
  };

  const stats = useMemo(() => {
    const pending = allPayments.filter(p => p.status === 'PENDING');
    const confirmed = allPayments.filter(p => p.status === 'SUCCESSFUL');
    const rejected = allPayments.filter(p => p.status === 'REJECTED');
    const now = new Date();
    const thisMonthConfirmedTotal = confirmed
      .filter(p => {
        const d = new Date(p.reviewed_at || p.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return { pendingCount: pending.length, confirmedCount: confirmed.length, rejectedCount: rejected.length, thisMonthConfirmedTotal, total: allPayments.length };
  }, [allPayments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allPayments.filter(p => {
      if (filter !== 'ALL' && p.status !== filter) return false;
      if (!q) return true;
      return p.admin_id?.name?.toLowerCase().includes(q) || p.admin_id?.email?.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q);
    });
  }, [allPayments, query, filter]);

  const pendingInView = filtered.filter(p => p.status === 'PENDING');
  const allPendingSelected = pendingInView.length > 0 && pendingInView.every(p => selected.has(p._id));

  const toggleSelectAll = () => {
    if (allPendingSelected) setSelected(new Set());
    else setSelected(new Set(pendingInView.map(p => p._id)));
  };
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedPayments = allPayments.filter(p => selected.has(p._id));

  return (
    <div style={{ padding: '28px 28px 60px' }}>
      <style>{GLOBAL_STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#f97316,#ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(249,115,22,0.35)',
          }}>
            <Wallet size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Payment Requests</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Manual MoMo payment claims from schools
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowPlanManager(true)} className="pr-btn" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11,
            border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)',
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}>
            <Settings2 size={13} /> Manage Plans
          </button>
          {allPayments.length > 0 && (
            <button onClick={() => setShowClearHistory(true)} className="pr-btn" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11,
              border: `1px solid ${TOKENS.rose}`, background: 'transparent', color: TOKENS.rose,
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}>
              <Trash2 size={13} /> Clear History
            </button>
          )}
          <button onClick={() => load(true)} disabled={refreshing} className="pr-btn" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11,
            border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)',
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <StatCard icon={Clock} label="Awaiting review" value={stats.pendingCount} color={TOKENS.amber} glow={stats.pendingCount > 0} />
        <StatCard icon={CircleDollarSign} label="Confirmed this month" value={stats.thisMonthConfirmedTotal} color={TOKENS.gold} format={v => v.toLocaleString('en-US') + ' RWF'} />
        <StatCard icon={ListChecks} label="Confirmed claims" value={stats.confirmedCount} color={TOKENS.emerald} />
        <StatCard icon={TrendingUp} label="Total claims" value={stats.total} color={TOKENS.indigo} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {['ALL', 'PENDING', 'SUCCESSFUL', 'REJECTED'].map(key => {
          const meta = STATUS_META[key];
          const active = filter === key;
          const count = key === 'ALL' ? stats.total : key === 'PENDING' ? stats.pendingCount : key === 'SUCCESSFUL' ? stats.confirmedCount : stats.rejectedCount;
          return (
            <button key={key} onClick={() => { setFilter(key); setSelected(new Set()); }} className="pr-btn" style={{
              padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${active ? (meta?.color || '#6366f1') : 'var(--card-border)'}`,
              background: active ? (meta?.bg || 'rgba(99,102,241,0.1)') : 'var(--surface-100)',
              color: active ? (meta?.color || '#6366f1') : 'var(--text-secondary)',
            }}>
              {key === 'ALL' ? 'All' : meta.label} ({count})
            </button>
          );
        })}
        <div className="pr-search" style={{ position: 'relative', marginLeft: 'auto', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search school, email, or phone..."
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 11,
              border: '1px solid var(--card-border)', background: 'var(--surface-100)',
              color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Bulk action bar — reject only; confirming still requires checking
          the wallet per claim, so bulk-confirm isn't offered on purpose. */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '10px 16px', borderRadius: 14, marginBottom: 12,
          background: 'rgba(244,63,94,0.08)', border: `1px solid ${TOKENS.rose}`,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            {selected.size} claim{selected.size === 1 ? '' : 's'} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected(new Set())} className="pr-btn" style={{
              padding: '6px 12px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)',
              color: 'var(--text-primary)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            }}>
              Clear
            </button>
            <button onClick={() => setRejectTarget(selectedPayments)} className="pr-btn" style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, border: 'none',
              background: TOKENS.rose, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            }}>
              <XCircle size={12} /> Reject selected
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden' }}>
        {pendingInView.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--card-border)' }}>
            <input type="checkbox" className="pr-check" checked={allPendingSelected} onChange={toggleSelectAll} style={{ width: 15, height: 15, cursor: 'pointer' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Select all pending in view
            </span>
          </div>
        )}

        {loading ? (
          <>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '52px 20px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Inbox size={22} color="var(--text-secondary)" />
            </div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              {query ? 'No matches' : filter === 'PENDING' ? "You're all caught up" : 'Nothing here yet'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {query ? `Nothing matches "${query}" in this view.` : filter === 'PENDING' ? 'New claims will appear here the moment a school submits one.' : 'Claims will show up here as schools submit payments.'}
            </p>
          </div>
        ) : (
          filtered.map((payment, i) => {
            const meta = STATUS_META[payment.status] || STATUS_META.PENDING;
            const isPending = payment.status === 'PENDING';
            return (
              <div key={payment._id} className={`pr-row ${isPending ? 'is-pending' : ''}`} style={{
                padding: '15px 18px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--card-border)',
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                animationDelay: `${Math.min(i, 8) * 0.03}s`,
              }}>
                {isPending && (
                  <input type="checkbox" className="pr-check" checked={selected.has(payment._id)} onChange={() => toggleSelect(payment._id)} style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={16} color="var(--text-secondary)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {payment.admin_id?.name || 'Unknown school'}
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail size={10} /> {payment.admin_id?.email}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Smartphone size={10} /> {payment.phone}</span>
                    </p>
                  </div>
                </div>

                {/* Perforated divider — a receipt stub detail that also
                    doubles as a natural section break */}
                <div className="pr-perforation" style={{ width: 1, alignSelf: 'stretch', minHeight: 32 }} />

                <div style={{ textAlign: 'right', minWidth: 130 }}>
                  <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: TOKENS.gold, margin: 0 }}>
                    {formatMoney(payment.amount, payment.currency)}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{payment.plan_name} · {formatDateTime(payment.created_at)}</p>
                </div>

                {payment.status === 'PENDING' ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
                    background: meta.bg, color: meta.color, fontSize: 11.5, fontWeight: 700, flexShrink: 0,
                  }}>
                    <meta.icon size={11} /> {meta.label}
                  </span>
                ) : (
                  <Stamp status={payment.status} />
                )}

                {payment.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => confirm(payment)} disabled={confirmingId === payment._id} className="pr-btn" style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10,
                      border: 'none', background: TOKENS.indigo, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      {confirmingId === payment._id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Confirm
                    </button>
                    <button onClick={() => setRejectTarget([payment])} className="pr-btn" style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10,
                      border: `1px solid ${TOKENS.rose}`, background: 'transparent', color: TOKENS.rose, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                ) : payment.status === 'REJECTED' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => confirm(payment)} disabled={confirmingId === payment._id} className="pr-btn" title="Reconsider this decision and restore the school's access" style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 9,
                      border: `1px solid ${TOKENS.indigo}`, background: 'transparent', color: TOKENS.indigo, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      {confirmingId === payment._id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Reconsider & confirm
                    </button>
                    <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: 0, textAlign: 'right' }}>
                      by {payment.reviewed_by?.name || '—'} · {formatDateTime(payment.reviewed_at)}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: 0, minWidth: 90, textAlign: 'right' }}>
                      by {payment.reviewed_by?.name || '—'}<br />{formatDateTime(payment.reviewed_at)}
                    </p>
                    <button onClick={() => setReceiptTarget(payment)} className="pr-btn" style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 9,
                      border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <Receipt size={11} /> Receipt
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {rejectTarget && (
        <RejectModal payments={rejectTarget} onClose={() => setRejectTarget(null)} onDone={() => { setRejectTarget(null); setSelected(new Set()); load(true); }} />
      )}
      {receiptTarget && <ReceiptModal payment={receiptTarget} onClose={() => setReceiptTarget(null)} />}
      {showPlanManager && <PlanManagerModal onClose={() => setShowPlanManager(false)} />}
      {showClearHistory && (
        <ClearHistoryModal
          payments={allPayments}
          onClose={() => setShowClearHistory(false)}
          onDone={() => {
            setShowClearHistory(false);
            setSelected(new Set());
            load(true);
            refreshBadge?.();
          }}
        />
      )}
    </div>
  );
}