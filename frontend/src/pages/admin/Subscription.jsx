import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useBilling } from '../../context/BillingContext';
import {
  Wallet, GraduationCap, Wifi, Clock, CheckCircle2, XCircle, Loader2,
  PlusCircle, ArrowRight, ArrowLeft, X, Copy, Check, User, Mail, PhoneCall,
  Smartphone, Printer, Receipt, Hourglass,
  RefreshCw, Inbox, TrendingUp,
} from 'lucide-react';

const TOKENS = { emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b', slate: '#64748b', gold: '#d97706', indigo: '#6366f1', indigoDeep: '#4338ca' };

const STATUS_META = {
  PENDING: { label: 'Pending', color: TOKENS.amber, bg: 'rgba(245,158,11,0.1)', icon: Clock },
  SUCCESSFUL: { label: 'Confirmed', color: TOKENS.emerald, bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: TOKENS.rose, bg: 'rgba(244,63,94,0.1)', icon: XCircle },
  FAILED: { label: 'Failed', color: TOKENS.rose, bg: 'rgba(244,63,94,0.1)', icon: XCircle },
};

const GLOBAL_STYLES = `
  @keyframes sub-fade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sub-scale { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes sub-card-in { from { opacity:0; transform: perspective(1000px) rotateX(8deg) translateY(24px); } to { opacity:1; transform: perspective(1000px) rotateX(0) translateY(0); } }
  @keyframes sub-shine-sweep { 0% { transform: translateX(-120%) rotate(20deg); } 100% { transform: translateX(220%) rotate(20deg); } }
  @keyframes sub-shimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
  @keyframes sub-glow-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
  @keyframes sub-stamp-in { 0% { opacity:0; transform: scale(2.4) rotate(-14deg); } 60% { opacity:1; } 100% { opacity:1; transform: scale(1) rotate(-8deg); } }

  .sub-card-wrap { animation: sub-card-in 0.7s cubic-bezier(0.16,1,0.3,1) both; }
  .sub-row { animation: sub-fade 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .sub-modal { animation: sub-scale 0.22s cubic-bezier(0.16,1,0.3,1) both; }

  .sub-btn { transition: transform .15s cubic-bezier(0.16,1,0.3,1), filter .15s, box-shadow .2s; }
  .sub-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
  .sub-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
  .sub-btn:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
  .sub-input:focus { outline: 2px solid #6366f1; outline-offset: 1px; }

  .sub-plan-card { transition: transform .15s, border-color .15s, background .15s; cursor: pointer; }
  .sub-plan-card:hover { transform: translateY(-2px); }

  .sub-copy-btn { transition: background .15s, transform .1s; }
  .sub-copy-btn:hover { transform: scale(1.05); }

  .sub-skel {
    background: linear-gradient(90deg, var(--surface-100) 25%, rgba(148,163,184,0.14) 37%, var(--surface-100) 63%);
    background-size: 400px 100%;
    animation: sub-shimmer 1.4s ease-in-out infinite;
    border-radius: 8px;
  }
  .sub-glow { animation: sub-glow-pulse 2.4s ease-in-out infinite; }
  .sub-stamp { animation: sub-stamp-in 0.5s cubic-bezier(0.16,1,0.3,1) both; }

  @media (prefers-reduced-motion: reduce) {
    .sub-card-wrap, .sub-row, .sub-modal, .sub-glow, .sub-stamp { animation: none !important; }
    .sub-shine { display: none !important; }
  }

  @media print {
    body * { visibility: hidden; }
    #sub-receipt-printable, #sub-receipt-printable * { visibility: visible; }
    #sub-receipt-printable { position: fixed; inset: 0; padding: 32px; }
  }
`;

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateShort(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatMoney(amount, currency) {
  if (amount === undefined || amount === null) return '—';
  const n = Number(amount);
  return `${Number.isFinite(n) ? n.toLocaleString('en-US') : amount} ${currency || ''}`.trim();
}

// ── The signature element: a tilting membership card, since a subscription
// literally is a membership. Mouse-follow 3D tilt + a light sweep on
// hover, gradient body, big embossed days-remaining figure like a card's
// printed number, plan name where a cardholder name would sit. ──────────
function MembershipCard({ billing }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const onMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (py - 0.5) * -10, y: (px - 0.5) * 12 });
  };
  const onLeave = () => { setHovering(false); setTilt({ x: 0, y: 0 }); };

  const status = billing?.status || 'trialing';
  const isActive = status === 'active';
  const isLocked = status === 'locked';
  const isOverdue = status === 'overdue';
  const daysRemaining = billing?.days_remaining ?? 0;
  const urgent = !isLocked && !isOverdue && daysRemaining <= 7;

  const statusLabel = isLocked ? 'Locked' : isOverdue ? 'Overdue' : isActive ? 'Active' : 'Trialing';
  const statusColor = isLocked ? TOKENS.slate : isOverdue ? TOKENS.rose : isActive ? TOKENS.emerald : TOKENS.amber;
  const validUntil = isActive ? billing?.paid_until : billing?.trial_ends_at;

  return (
    <div
      ref={ref}
      className="sub-card-wrap"
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={onLeave}
      style={{ perspective: 1000, width: '100%', maxWidth: 460 }}
    >
      <div style={{
        position: 'relative', borderRadius: 24, padding: '28px 26px', overflow: 'hidden',
        background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #7c3aed 100%)',
        boxShadow: hovering ? '0 30px 60px rgba(67,56,202,0.45)' : '0 18px 40px rgba(67,56,202,0.3)',
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovering ? 1.015 : 1})`,
        transition: hovering ? 'box-shadow .3s, transform .08s linear' : 'transform .5s cubic-bezier(0.16,1,0.3,1), box-shadow .4s',
        transformStyle: 'preserve-3d',
      }}>
        <div style={{
          position: 'absolute', top: '-30%', right: '-15%', width: '70%', height: '140%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-30%', left: '-10%', width: '55%', height: '110%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)', pointerEvents: 'none',
        }} />
        {hovering && (
          <div className="sub-shine" style={{
            position: 'absolute', top: '-50%', left: 0, width: '40%', height: '200%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
            animation: 'sub-shine-sweep 1.1s ease forwards', pointerEvents: 'none',
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <GraduationCap size={16} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: '0.02em' }}>EDUPLA</span>
          </div>
          <Wifi size={20} color="rgba(255,255,255,0.75)" style={{ transform: 'rotate(90deg)' }} />
        </div>

        <div style={{
          width: 38, height: 28, borderRadius: 6, marginBottom: 18,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))',
          border: '1px solid rgba(255,255,255,0.4)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.4)' }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.4)' }} />
        </div>

        <div style={{ marginBottom: 22, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }} className={urgent ? 'sub-glow' : ''}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 46, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
              {isLocked || isOverdue ? '—' : daysRemaining}
            </span>
            {!isLocked && !isOverdue && (
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                day{daysRemaining === 1 ? '' : 's'} remaining
              </span>
            )}
          </div>
          {(isLocked || isOverdue) && (
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '4px 0 0' }}>
              {isLocked ? 'Access is locked' : 'Subscription expired'}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>
              {isActive ? 'Valid until' : isLocked || isOverdue ? 'Status' : 'Trial ends'}
            </p>
            <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
              {isLocked || isOverdue ? statusLabel : formatDateShort(validUntil)}
            </p>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999,
            background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 700,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Add subscription modal (plan select → payee instructions → submit) ──
function AddSubscriptionModal({ onClose, onSubmitted }) {
  const [step, setStep] = useState('plans');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [payee, setPayee] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [senderPhone, setSenderPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/billing/plans');
        if (!mounted) return;
        setPlans(res.data.plans);
        setPayee(res.data.payee);
      } catch {
        toast.error('Could not load payment plans.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const submitClaim = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/billing/manual-pay', { plan_id: selectedPlan._id, sender_phone: senderPhone.trim() || undefined });
      toast.success('Payment claim submitted — awaiting confirmation.');
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your payment claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="sub-modal" style={{
        width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 22, padding: '1.6rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step === 'instructions' && (
              <button onClick={() => setStep('plans')} className="sub-btn" style={{ width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowLeft size={13} color="var(--text-secondary)" />
              </button>
            )}
            <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15.5, color: 'var(--text-primary)', margin: 0 }}>
              {step === 'plans' ? 'Add subscription time' : 'Send payment'}
            </h2>
          </div>
          <button onClick={onClose} className="sub-btn" style={{ width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} color="var(--text-secondary)" />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center' }}>
            <Loader2 size={22} className="animate-spin" color="#6366f1" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>Loading plans…</p>
          </div>
        ) : step === 'plans' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plans.map(plan => (
              <div key={plan._id} className="sub-plan-card" onClick={() => { setSelectedPlan(plan); setStep('instructions'); }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--card-border)', background: 'var(--surface-100)',
              }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{plan.name}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{plan.days} days added</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: TOKENS.gold }}>{formatMoney(plan.amount, plan.currency)}</span>
                  <ArrowRight size={14} color="var(--text-secondary)" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 16,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedPlan.name}</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: TOKENS.gold }}>{formatMoney(selectedPlan.amount, selectedPlan.currency)}</span>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
              Send this exact amount via MTN Mobile Money to:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {[
                { icon: User, label: 'Recipient name', value: payee.name },
                { icon: PhoneCall, label: 'MoMo number', value: payee.phone },
                { icon: Mail, label: 'Email (for reference)', value: payee.email },
              ].map(f => <CopyField key={f.label} {...f} />)}
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Your MoMo number (the one you paid from) — optional
            </label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Smartphone size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="tel" placeholder="e.g. 0785 683 347" className="sub-input" value={senderPhone}
                onChange={e => setSenderPhone(e.target.value)}
                style={{
                  width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12, border: '1px solid var(--card-border)',
                  background: 'var(--surface-100)', color: 'var(--text-primary)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
                <XCircle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
              </div>
            )}

            <button onClick={submitClaim} disabled={submitting} className="sub-btn" style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff', border: 'none', borderRadius: 12,
              padding: '12px 14px', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, opacity: submitting ? 0.75 : 1,
            }}>
              {submitting ? (<><Loader2 size={15} className="animate-spin" /> Submitting…</>) : (<>I've Sent the Payment <Check size={14} /></>)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyField({ icon: Icon, label, value }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error('Could not copy.'); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: 'var(--surface-100)', border: '1px solid var(--card-border)', borderRadius: 12 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={13} color="#6366f1" />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
      </div>
      <button type="button" onClick={doCopy} className="sub-copy-btn" style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0, cursor: 'pointer', border: 'none',
        background: copied ? 'rgba(16,185,129,0.15)' : 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} color="var(--text-secondary)" />}
      </button>
    </div>
  );
}

// ── Printable receipt modal ───────────────────────────────────────────
function ReceiptModal({ payment, schoolName, onClose }) {
  const isManual = payment.method === 'manual';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="sub-modal" style={{ width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto', background: 'var(--card-bg)', borderRadius: 22, border: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Receipt</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} className="sub-btn" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: 'none', background: '#6366f1', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={12} /> Print
            </button>
            <button onClick={onClose} className="sub-btn" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        <div id="sub-receipt-printable" style={{ padding: '28px 26px', background: '#fff', color: '#0f172a' }}>
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
            {payment.status === 'SUCCESSFUL' && (
              <div className="sub-stamp" style={{
                border: '2.5px solid #10b981', borderRadius: 8, padding: '5px 12px', color: '#10b981',
                fontWeight: 800, fontSize: 12, letterSpacing: '0.08em', transform: 'rotate(-8deg)', opacity: 0.9,
              }}>
                PAID
              </div>
            )}
          </div>

          <div style={{ borderTop: '1.5px dashed #e2e8f0', borderBottom: '1.5px dashed #e2e8f0', padding: '16px 0', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['School', schoolName],
              ['Plan', payment.plan_name || `${payment.plan_days}-day plan`],
              ['Amount', formatMoney(payment.amount, payment.currency)],
              ['Payment method', isManual ? 'MTN MoMo (manual transfer)' : 'MTN MoMo (API)'],
              ['Paid via', payment.phone],
              ['Date', formatDate(payment.reviewed_at || payment.created_at)],
              ['Access valid until', formatDate(payment.paid_until_after)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{label}</span>
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
            Thank you for keeping Edupla running at your school.<br />
            Questions about this receipt? jstackvm@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div className="sub-skel" style={{ width: 34, height: 34, borderRadius: 9 }} />
      <div style={{ flex: 1 }}><div className="sub-skel" style={{ height: 12, width: '30%', marginBottom: 6 }} /><div className="sub-skel" style={{ height: 10, width: '45%' }} /></div>
      <div className="sub-skel" style={{ height: 20, width: 70, borderRadius: 999 }} />
    </div>
  );
}

export default function Subscription() {
  const { billing, refresh: refreshBilling } = useBilling() || {};
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/billing/history');
      setHistory(res.data.payments);
    } catch {
      toast.error('Failed to load payment history.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const pendingManual = billing?.pending_manual_payment;
  const totalPaid = useMemo(
    () => history.filter(p => p.status === 'SUCCESSFUL').reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [history],
  );

  return (
    <div style={{ padding: '28px 28px 60px' }}>
      <style>{GLOBAL_STYLES}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#6366f1,#4338ca)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(99,102,241,0.35)',
          }}>
            <Wallet size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Subscription</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Your school's Edupla plan and payment history</p>
          </div>
        </div>
        <button onClick={() => { refreshBilling?.(); loadHistory(); }} className="sub-btn" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11,
          border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 26, alignItems: 'flex-start' }}>
        <MembershipCard billing={billing} />

        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingManual ? (
            <div style={{
              padding: '16px 18px', borderRadius: 16, border: `1.5px solid ${TOKENS.amber}`,
              background: 'rgba(245,158,11,0.06)', display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <Hourglass size={18} color={TOKENS.amber} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Payment awaiting confirmation</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.5 }}>
                  Your {pendingManual.plan_name} claim ({formatMoney(pendingManual.amount, pendingManual.currency)}) is being reviewed. Submitted {formatDate(pendingManual.submitted_at)}.
                </p>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddModal(true)} className="sub-btn" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 20px', borderRadius: 16,
              border: 'none', background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff', cursor: 'pointer',
              fontSize: 14.5, fontWeight: 700, boxShadow: '0 10px 24px rgba(99,102,241,0.3)',
            }}>
              <PlusCircle size={18} /> Add Subscription
            </button>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, padding: '13px 15px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Total paid</p>
              <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: TOKENS.gold, margin: 0 }}>{totalPaid.toLocaleString('en-US')} RWF</p>
            </div>
            <div style={{ flex: 1, padding: '13px 15px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Payments made</p>
              <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{history.filter(p => p.status === 'SUCCESSFUL').length}</p>
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Receipt size={15} color="var(--text-secondary)" /> Payment history
      </h2>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden' }}>
        {loadingHistory ? (
          <>{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</>
        ) : history.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Inbox size={20} color="var(--text-secondary)" />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>No payments yet</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Your payment history will show up here.</p>
          </div>
        ) : (
          history.map((payment, i) => {
            const meta = STATUS_META[payment.status] || STATUS_META.PENDING;
            return (
              <div key={payment._id} className="sub-row" style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                borderBottom: i === history.length - 1 ? 'none' : '1px solid var(--card-border)',
                animationDelay: `${Math.min(i, 8) * 0.03}s`,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp size={15} color="var(--text-secondary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {payment.plan_name || `${payment.plan_days}-day plan`} · <span style={{ color: TOKENS.gold }}>{formatMoney(payment.amount, payment.currency)}</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {payment.method === 'manual' ? 'Manual transfer' : 'MTN MoMo API'} · {formatDateShort(payment.created_at)}
                  </p>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
                  background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  <meta.icon size={10} /> {meta.label}
                </span>
                {payment.status === 'SUCCESSFUL' && (
                  <button onClick={() => setReceiptTarget(payment)} className="sub-btn" style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 10,
                    border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  }}>
                    <Receipt size={11} /> Receipt
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {showAddModal && (
        <AddSubscriptionModal
          onClose={() => setShowAddModal(false)}
          onSubmitted={async () => { setShowAddModal(false); await refreshBilling?.(); loadHistory(); }}
        />
      )}
      {receiptTarget && (
        <ReceiptModal payment={receiptTarget} schoolName={billing?.school_admin_name || 'Your school'} onClose={() => setReceiptTarget(null)} />
      )}
    </div>
  );
}