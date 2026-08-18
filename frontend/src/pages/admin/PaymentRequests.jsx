import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { usePendingPayments } from '../../context/PendingPaymentsContext';
import {
  Wallet, Search, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  Settings2, Plus, Pencil, Trash2, X, Mail, Phone, Smartphone, Building2,
} from 'lucide-react';

const TOKENS = { emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b', slate: '#64748b' };

const STATUS_META = {
  PENDING: { label: 'Pending', color: TOKENS.amber, bg: 'rgba(245,158,11,0.1)', icon: Clock },
  SUCCESSFUL: { label: 'Confirmed', color: TOKENS.emerald, bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: TOKENS.rose, bg: 'rgba(244,63,94,0.1)', icon: XCircle },
};

const GLOBAL_STYLES = `
  @keyframes pr-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pr-scale { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .pr-row { animation: pr-fade 0.35s ease both; }
  .pr-modal { animation: pr-scale 0.2s ease both; }
  .pr-btn { transition: transform .15s, filter .15s; }
  .pr-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
  .pr-btn:active:not(:disabled) { transform: translateY(0); }
`;

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

// ── Reject reason modal ───────────────────────────────────────────────
function RejectModal({ payment, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/system/billing/manual-payments/${payment._id}/reject`, { reason: reason.trim() });
      toast.success('Payment claim rejected.');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject claim.');
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
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Reject payment claim</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
          {payment.admin_id?.name} claimed {formatMoney(payment.amount, payment.currency)} for {payment.plan_name}. The school stays locked out after rejecting.
        </p>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Reason (optional, for your own records)
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. No matching transaction found in wallet"
          rows={3}
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
  const [editing, setEditing] = useState(null); // plan being edited, or 'new'
  const [form, setForm] = useState({ name: '', amount: '', currency: 'RWF', days: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);

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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="pr-modal" style={{ width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings2 size={16} color="#6366f1" />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Payment plans</h3>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color="var(--text-secondary)" />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Loading plans…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plans.map(plan => (
              <div key={plan._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '11px 14px', borderRadius: 12, border: '1px solid var(--card-border)',
                background: 'var(--surface-100)', opacity: plan.active ? 1 : 0.55,
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{plan.name}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {formatMoney(plan.amount, plan.currency)} · {plan.days} days {!plan.active && '· inactive'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => toggleActive(plan)} className="pr-btn" style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)',
                  }}>
                    {plan.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => startEdit(plan)} className="pr-btn" style={{
                    width: 30, height: 30, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Pencil size={12} color="var(--text-secondary)" />
                  </button>
                  <button onClick={() => remove(plan)} className="pr-btn" style={{
                    width: 30, height: 30, borderRadius: 8, border: `1px solid ${TOKENS.rose}`, background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Trash2 size={12} color={TOKENS.rose} />
                  </button>
                </div>
              </div>
            ))}

            {editing ? (
              <div style={{ padding: 14, borderRadius: 12, border: '1.5px solid #6366f1', background: 'rgba(99,102,241,0.05)', marginTop: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input placeholder="Name (e.g. 1 Month)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={{ gridColumn: '1 / -1', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box' }} />
                  <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box' }} />
                  <input placeholder="Currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box' }} />
                  <input type="number" placeholder="Days" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
                    style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box' }} />
                  <input type="number" placeholder="Sort order" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                    style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditing(null)} className="pr-btn" style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={save} disabled={saving} className="pr-btn" style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Saving…' : 'Save plan'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={startNew} className="pr-btn" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px', borderRadius: 12, border: '1.5px dashed var(--card-border)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginTop: 4,
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

export default function PaymentRequests() {
  const { refresh: refreshBadge } = usePendingPayments() || {};
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [showPlanManager, setShowPlanManager] = useState(false);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await api.get('/system/billing/manual-payments', { params: filter === 'ALL' ? {} : { status: filter } });
      setPayments(res.data.payments);
    } catch {
      toast.error('Failed to load payment claims.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(p =>
      p.admin_id?.name?.toLowerCase().includes(q) ||
      p.admin_id?.email?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  }, [payments, query]);

  return (
    <div style={{ padding: '28px 28px 60px' }}>
      <style>{GLOBAL_STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Payment Requests</h1>
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
          <button onClick={() => load(true)} disabled={refreshing} className="pr-btn" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11,
            border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)',
            fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
          }}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['PENDING', 'SUCCESSFUL', 'REJECTED', 'ALL'].map(key => {
          const meta = STATUS_META[key];
          const active = filter === key;
          return (
            <button key={key} onClick={() => setFilter(key)} className="pr-btn" style={{
              padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${active ? (meta?.color || '#6366f1') : 'var(--card-border)'}`,
              background: active ? (meta?.bg || 'rgba(99,102,241,0.1)') : 'var(--surface-100)',
              color: active ? (meta?.color || '#6366f1') : 'var(--text-secondary)',
            }}>
              {key === 'ALL' ? 'All' : meta.label}
            </button>
          );
        })}
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search school, email, or phone..."
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 11,
              border: '1px solid var(--card-border)', background: 'var(--surface-100)',
              color: 'var(--text-primary)', fontSize: 12.5, boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} /> Loading claims…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            No payment claims here.
          </div>
        ) : (
          filtered.map((payment, i) => {
            const meta = STATUS_META[payment.status] || STATUS_META.PENDING;
            const StatusIcon = meta.icon;
            return (
              <div key={payment._id} className="pr-row" style={{
                padding: '16px 18px', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--card-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
                animationDelay: `${i * 0.02}s`,
              }}>
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

                <div style={{ textAlign: 'right', minWidth: 140 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{formatMoney(payment.amount, payment.currency)}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{payment.plan_name} · {formatDateTime(payment.created_at)}</p>
                </div>

                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
                  background: meta.bg, color: meta.color, fontSize: 11.5, fontWeight: 700, flexShrink: 0,
                }}>
                  <StatusIcon size={11} /> {meta.label}
                </span>

                {payment.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => confirm(payment)} disabled={confirmingId === payment._id} className="pr-btn" style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10,
                      border: 'none', background: TOKENS.emerald, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      {confirmingId === payment._id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Confirm
                    </button>
                    <button onClick={() => setRejectTarget(payment)} className="pr-btn" style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10,
                      border: `1px solid ${TOKENS.rose}`, background: 'transparent', color: TOKENS.rose, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}>
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: 0, minWidth: 90, textAlign: 'right' }}>
                    by {payment.reviewed_by?.name || '—'}<br />{formatDateTime(payment.reviewed_at)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {rejectTarget && (
        <RejectModal payment={rejectTarget} onClose={() => setRejectTarget(null)} onDone={() => { setRejectTarget(null); load(true); }} />
      )}
      {showPlanManager && <PlanManagerModal onClose={() => setShowPlanManager(false)} />}
    </div>
  );
}
