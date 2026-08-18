import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useBilling } from '../context/BillingContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  GraduationCap, Smartphone, LogOut, ArrowRight, ArrowLeft, Sun, Moon,
  CheckCircle2, AlertCircle, Loader2, Clock, ShieldCheck, Banknote,
  X, Copy, Check, User, Mail, PhoneCall, CreditCard, ChevronDown, Hourglass,
} from 'lucide-react';

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');

  @keyframes bp-orb {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(26px,-18px) scale(1.05); }
    66%     { transform: translate(-18px,14px) scale(0.96); }
  }
  @keyframes bp-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes bp-modal-in { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes bp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  @keyframes bp-spin { to { transform: rotate(360deg); } }
  .bp-fade { animation: bp-fade-up 0.5s ease both; }
  .bp-modal { animation: bp-modal-in 0.22s cubic-bezier(0.16,1,0.3,1) both; }
  .bp-pulse { animation: bp-pulse 1.6s ease-in-out infinite; }
  .bp-spin { animation: bp-spin 1s linear infinite; }

  .bp-input { transition: border-color .2s, box-shadow .2s, background .2s; }
  .bp-input:focus { border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.15); }

  .bp-pay-btn { transition: transform .2s, box-shadow .2s, filter .2s; }
  .bp-pay-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(249,115,22,0.35); filter: brightness(1.05); }
  .bp-pay-btn:active:not(:disabled) { transform: translateY(0); }

  .bp-plan-card { transition: transform .15s, border-color .15s, background .15s; cursor: pointer; }
  .bp-plan-card:hover { transform: translateY(-2px); }

  .bp-copy-btn { transition: background .15s, transform .1s; }
  .bp-copy-btn:hover { transform: scale(1.05); }
  .bp-copy-btn:active { transform: scale(0.96); }
`;

function formatDate(d) {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

function formatMoney(amount, currency) {
  if (amount === undefined || amount === null) return '';
  const n = Number(amount);
  const formatted = Number.isFinite(n) ? n.toLocaleString('en-US') : amount;
  return `${formatted} ${currency || ''}`.trim();
}

// ── Copy-to-clipboard chip, used inside the payee instructions step ──────
function CopyField({ icon: Icon, label, value, dark }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy — select and copy manually.');
    }
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
      background: dark ? 'rgba(255,255,255,0.04)' : '#fff8f2',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f1d9c5'}`,
      borderRadius: 12,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: dark ? 'rgba(249,115,22,0.14)' : 'rgba(249,115,22,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={13} color="#f97316" />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: dark ? '#64748b' : '#a1745a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </p>
      </div>
      <button type="button" onClick={doCopy} className="bp-copy-btn" style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
        border: 'none', background: copied ? 'rgba(22,163,74,0.15)' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} color={dark ? '#94a3b8' : '#64748b'} />}
      </button>
    </div>
  );
}

// ── The multi-step "Process Payment" modal ───────────────────────────────
function PaymentModal({ dark, onClose, onSubmitted }) {
  const [step, setStep] = useState('plans'); // plans | instructions
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
        toast.error('Could not load payment plans. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const choosePlan = (plan) => {
    setSelectedPlan(plan);
    setStep('instructions');
  };

  const submitClaim = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/billing/manual-pay', { plan_id: selectedPlan._id, sender_phone: senderPhone.trim() || undefined });
      toast.success('Payment claim submitted — awaiting confirmation.');
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit your payment claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: 16,
    }}>
      <div className="bp-modal" style={{
        width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        background: dark ? '#111827' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.14)'}`,
        borderRadius: 24, padding: '1.75rem', boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step === 'instructions' && (
              <button onClick={() => setStep('plans')} style={{
                width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ArrowLeft size={13} color={dark ? '#94a3b8' : '#64748b'} />
              </button>
            )}
            <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 16, color: dark ? '#f1f5f9' : '#1e1b4b', margin: 0 }}>
              {step === 'plans' ? 'Choose a plan' : 'Send payment'}
            </h2>
          </div>
          <button onClick={onClose} style={{
            width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={13} color={dark ? '#94a3b8' : '#64748b'} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center' }}>
            <Loader2 size={22} className="bp-spin" color="#f97316" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: 12.5, color: dark ? '#94a3b8' : '#64748b', margin: 0 }}>Loading plans…</p>
          </div>
        ) : step === 'plans' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plans.length === 0 ? (
              <p style={{ fontSize: 12.5, color: dark ? '#94a3b8' : '#64748b', textAlign: 'center', padding: '20px 0' }}>
                No payment plans are available right now. Please contact Edupla support.
              </p>
            ) : plans.map(plan => (
              <div key={plan._id} className="bp-plan-card" onClick={() => choosePlan(plan)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 14,
                border: `1.5px solid ${dark ? 'rgba(255,255,255,0.09)' : '#f1d9c5'}`,
                background: dark ? 'rgba(255,255,255,0.03)' : '#fff8f2',
              }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: dark ? '#f1f5f9' : '#1e1b4b', margin: 0 }}>{plan.name}</p>
                  <p style={{ fontSize: 11.5, color: dark ? '#94a3b8' : '#92552f', margin: '2px 0 0' }}>{plan.days} days of access</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: '#f97316' }}>
                    {formatMoney(plan.amount, plan.currency)}
                  </span>
                  <ArrowRight size={14} color={dark ? '#5b6485' : '#c2895d'} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: dark ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.06)',
              border: '1px solid rgba(249,115,22,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 16,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: dark ? '#f1f5f9' : '#1e1b4b' }}>{selectedPlan.name}</span>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: '#f97316' }}>
                {formatMoney(selectedPlan.amount, selectedPlan.currency)}
              </span>
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, color: dark ? '#94a3b8' : '#64748b', margin: '0 0 8px' }}>
              Send this exact amount via MTN Mobile Money to:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              <CopyField icon={User} label="Recipient name" value={payee.name} dark={dark} />
              <CopyField icon={PhoneCall} label="MoMo number" value={payee.phone} dark={dark} />
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: dark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>
              Your MoMo number (the one you paid from) — optional
            </label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Smartphone size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: dark ? '#5b6485' : '#c2895d' }} />
              <input
                type="tel"
                placeholder="e.g. 0785 683 347"
                className="bp-input"
                value={senderPhone}
                onChange={e => setSenderPhone(e.target.value)}
                style={{
                  width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12,
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#f1d9c5'}`,
                  background: dark ? 'rgba(255,255,255,0.05)' : '#fff8f2',
                  color: dark ? '#f1f5f9' : '#0f172a', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: dark ? '#5b6485' : '#a1745a', margin: '-10px 0 16px', lineHeight: 1.5 }}>
              Helps Edupla administrators match your transaction faster when confirming.
            </p>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: dark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 14,
              }}>
                <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
              </div>
            )}

            <button onClick={submitClaim} disabled={submitting} className="bp-pay-btn" style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff',
              border: 'none', borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 700, opacity: submitting ? 0.75 : 1,
            }}>
              {submitting ? (<><Loader2 size={15} className="bp-spin" /> Submitting…</>) : (<>I've Sent the Payment <Check size={14} /></>)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Billing() {
  const { user, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const { billing, refresh } = useBilling();

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Legacy automated MTN MoMo API flow — kept as a collapsed "advanced"
  // option since it's already built and tested (see the sandbox debugging
  // session), but the manual flow above is the primary path until
  // production MTN credentials are in place.
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState('idle'); // idle | requesting | awaiting | success | failed
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    if (billing?.default_phone) setPhone(billing.default_phone);
  }, [billing?.default_phone]);

  useEffect(() => {
    if (billing?.plan?.amount && !amount) setAmount(String(billing.plan.amount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing?.plan?.amount]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const isPayer = billing?.is_payer;
  const isLocked = billing?.status === 'locked';
  const isPayableLock = isLocked && billing?.locked_payable === true;
  const canShowPaymentForm = isPayer && (!isLocked || isPayableLock);
  const plan = billing?.plan;
  const pendingManual = billing?.pending_manual_payment;

  const pollStatus = useCallback((referenceId) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await api.get(`/billing/pay/${referenceId}/status`);
        if (res.data.status === 'SUCCESSFUL') {
          clearInterval(pollRef.current);
          setStage('success');
          toast.success('Payment received — welcome back!');
          await refresh();
        } else if (res.data.status === 'FAILED') {
          clearInterval(pollRef.current);
          setStage('failed');
          setError(res.data.reason || 'Payment was not completed.');
        } else if (attempts > 40) {
          clearInterval(pollRef.current);
          setStage('failed');
          setError('We haven\u2019t heard back yet. If you approved the prompt, wait a moment and try again.');
        }
      } catch {
        // keep polling through transient errors
      }
    }, 5000);
  }, [refresh]);

  const handlePay = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('Enter the MTN Mobile Money number to pay from.');
      return;
    }
    const numericAmount = Number(amount);
    if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid amount to pay.');
      return;
    }
    setStage('requesting');
    try {
      const res = await api.post('/billing/pay', { phone: phone.trim(), amount: numericAmount });
      setStage('awaiting');
      pollStatus(res.data.reference_id);
    } catch (err) {
      setStage('failed');
      setError(err.response?.data?.message || 'Could not start the payment. Please try again.');
    }
  };

  const inputBase = {
    width: '100%',
    padding: '11px 14px 11px 40px',
    borderRadius: 12,
    border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#f1d9c5'}`,
    background: dark ? 'rgba(255,255,255,0.05)' : '#fff8f2',
    color: dark ? '#f1f5f9' : '#0f172a',
    fontSize: 13.5,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{
        minHeight: '100vh', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        background: dark
          ? 'radial-gradient(circle at 20% 20%, #1f150f 0%, #0b0f1a 55%, #060810 100%)'
          : 'radial-gradient(circle at 20% 20%, #fff1e6 0%, #fff8f2 55%, #ffffff 100%)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        <div style={{
          position: 'absolute', top: '-8%', right: '-6%', width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.16) 0%, transparent 70%)',
          animation: 'bp-orb 9s ease-in-out infinite', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-8%', width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)',
          animation: 'bp-orb 12s ease-in-out infinite reverse', pointerEvents: 'none',
        }} />

        <button onClick={toggleTheme} title={dark ? 'Switch to light' : 'Switch to dark'} style={{
          position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          {dark ? <Sun size={15} color="#94a3b8" /> : <Moon size={15} color="#64748b" />}
        </button>

        <div className="bp-fade" style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
          background: dark ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.94)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.14)'}`,
          borderRadius: 28, padding: '2.5rem 2.25rem',
          boxShadow: dark ? '0 30px 80px rgba(0,0,0,0.55)' : '0 30px 70px rgba(249,115,22,0.14)',
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
        }}>
          {/* Brand mark */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#4338ca)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={16} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', color: dark ? '#f1f5f9' : '#1e1b4b' }}>
              EDUPLA
            </span>
          </div>

          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 18px',
            background: dark ? 'rgba(249,115,22,0.14)' : 'rgba(249,115,22,0.1)',
            border: '1px solid rgba(249,115,22,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {stage === 'success' ? (
              <CheckCircle2 size={26} color="#16a34a" />
            ) : pendingManual ? (
              <Hourglass size={26} color="#f97316" />
            ) : isLocked && !isPayableLock ? (
              <ShieldCheck size={26} color="#ef4444" />
            ) : (
              <Clock size={26} color="#f97316" />
            )}
          </div>

          {stage === 'success' ? (
            <>
              <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 19, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '0 0 8px' }}>
                Payment received
              </h1>
              <p style={{ fontSize: 13.5, color: dark ? '#94a3b8' : '#64748b', margin: '0 0 22px', lineHeight: 1.6 }}>
                Your school's Edupla access has been renewed. Reloading you into the app now.
              </p>
              <button onClick={() => window.location.reload()} className="bp-pay-btn" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff',
                border: 'none', borderRadius: 12, padding: '11px 20px', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700,
              }}>
                Continue to Edupla <ArrowRight size={14} />
              </button>
            </>
          ) : pendingManual ? (
            <>
              <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 19, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '0 0 8px' }}>
                Payment awaiting confirmation
              </h1>
              <p style={{ fontSize: 13.5, color: dark ? '#94a3b8' : '#64748b', margin: '0 0 20px', lineHeight: 1.6 }}>
                We've recorded your {pendingManual.plan_name} payment claim ({formatMoney(pendingManual.amount, pendingManual.currency)}). Access resumes automatically once an Edupla administrator confirms receipt.
              </p>
              <div className="bp-pulse" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 18,
              }}>
                <Hourglass size={22} color="#f97316" />
                <p style={{ fontSize: 11.5, color: dark ? '#5b6485' : '#a1745a', margin: 0 }}>
                  Submitted {formatDate(pendingManual.submitted_at)}
                </p>
              </div>
              <button onClick={refresh} className="bp-pay-btn" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: dark ? '#f1f5f9' : '#1e1b4b',
                border: 'none', borderRadius: 12, padding: '10px 18px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700,
              }}>
                Check status
              </button>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 19, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '0 0 8px' }}>
                {isLocked ? (isPayableLock ? 'Payment required to unlock' : 'Access locked') : isPayer ? 'Subscription payment needed' : 'Access paused'}
              </h1>
              <p style={{ fontSize: 13.5, color: dark ? '#94a3b8' : '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
                {isLocked
                  ? (isPayableLock
                      ? `${billing?.locked_reason ? billing.locked_reason + '. ' : ''}Pay with MTN Mobile Money to restore access immediately.`
                      : (billing?.locked_reason
                          ? `Your school's Edupla access has been locked: ${billing.locked_reason}`
                          : 'Your school\u2019s Edupla access has been locked by Edupla administrators. Please contact support.'))
                  : isPayer
                    ? 'Your school\u2019s free trial has ended. Pay with MTN Mobile Money to keep using Edupla.'
                    : 'Your school\u2019s Edupla subscription has ended. Only your school administrator can renew it — please reach out to them.'}
              </p>

              {canShowPaymentForm && (
                <button onClick={() => setPayModalOpen(true)} className="bp-pay-btn" style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '13px 14px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, marginBottom: 6,
                }}>
                  <CreditCard size={16} /> Process Payment
                </button>
              )}

              {canShowPaymentForm && (
                <button onClick={() => setShowAdvanced(v => !v)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, color: dark ? '#5b6485' : '#a1745a',
                  margin: '4px 0 0',
                }}>
                  Pay automatically via MTN API instead (testing) <ChevronDown size={12} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>
              )}

              {canShowPaymentForm && showAdvanced && (
                <div style={{ textAlign: 'left', marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${dark ? 'rgba(255,255,255,0.1)' : '#f1d9c5'}` }}>
                  {plan && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: dark ? 'rgba(255,255,255,0.04)' : '#fff8f2',
                      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f1d9c5'}`,
                      borderRadius: 14, padding: '12px 16px', marginBottom: 14,
                    }}>
                      <span style={{ fontSize: 12.5, color: dark ? '#94a3b8' : '#92552f', fontWeight: 600 }}>
                        {plan.days}-day subscription
                      </span>
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 17, color: dark ? '#f1f5f9' : '#1e1b4b' }}>
                        {plan.amount} {plan.currency}
                      </span>
                    </div>
                  )}

                  {(stage === 'idle' || stage === 'requesting' || stage === 'failed') && (
                    <form onSubmit={handlePay}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: dark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>
                        MTN Mobile Money number
                      </label>
                      <div style={{ position: 'relative', marginBottom: 14 }}>
                        <Smartphone size={15} style={{
                          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                          color: dark ? '#5b6485' : '#c2895d', pointerEvents: 'none',
                        }} />
                        <input
                          type="tel"
                          placeholder="e.g. 0785 683 347"
                          className="bp-input"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          style={inputBase}
                          disabled={stage === 'requesting'}
                        />
                      </div>

                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: dark ? '#94a3b8' : '#64748b', marginBottom: 6 }}>
                        Amount {plan?.currency ? `(${plan.currency})` : ''}
                      </label>
                      <div style={{ position: 'relative', marginBottom: 14 }}>
                        <Banknote size={15} style={{
                          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                          color: dark ? '#5b6485' : '#c2895d', pointerEvents: 'none',
                        }} />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount to pay"
                          className="bp-input"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          style={inputBase}
                          disabled={stage === 'requesting'}
                        />
                      </div>

                      {error && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          background: dark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.07)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 10, padding: '8px 12px', marginBottom: 14,
                        }}>
                          <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                          <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
                        </div>
                      )}

                      <button type="submit" disabled={stage === 'requesting'} className="bp-pay-btn" style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        background: dark ? 'rgba(255,255,255,0.08)' : '#1e1b4b', color: '#fff',
                        border: 'none', borderRadius: 12, padding: '11px 14px', cursor: 'pointer',
                        fontSize: 13, fontWeight: 700,
                        opacity: stage === 'requesting' ? 0.75 : 1,
                      }}>
                        {stage === 'requesting' ? (
                          <><Loader2 size={14} className="bp-spin" /> Sending request…</>
                        ) : (
                          <>Pay with MTN MoMo API <ArrowRight size={13} /></>
                        )}
                      </button>
                    </form>
                  )}

                  {stage === 'awaiting' && (
                    <div className="bp-pulse" style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                      padding: '18px 12px',
                    }}>
                      <Smartphone size={28} color="#f97316" />
                      <p style={{ fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#1e1b4b', margin: 0 }}>
                        Check your phone
                      </p>
                      <p style={{ fontSize: 12.5, color: dark ? '#94a3b8' : '#64748b', margin: 0, maxWidth: 300, textAlign: 'center' }}>
                        Approve the MTN MoMo prompt sent to {phone}. This page will update automatically.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isLocked && billing?.locked_at && (
                <p style={{ fontSize: 11, color: dark ? '#475569' : '#94a3b8', marginTop: 18, marginBottom: 0 }}>
                  Locked {formatDate(billing.locked_at)}
                </p>
              )}
              {!isLocked && billing?.trial_ends_at && (
                <p style={{ fontSize: 11, color: dark ? '#475569' : '#94a3b8', marginTop: 18, marginBottom: 0 }}>
                  Trial ended {formatDate(billing.trial_ends_at)}
                </p>
              )}

              {user && (
                <button onClick={logout} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600, color: dark ? '#64748b' : '#94a3b8',
                  marginTop: 22,
                }}>
                  <LogOut size={12} /> Sign out ({user.name})
                </button>
              )}
            </>
          )}
        </div>

        <div style={{
          position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center',
          fontSize: 11, color: dark ? '#3a4060' : '#c2895d',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <ShieldCheck size={11} /> Secured by MTN Mobile Money
        </div>
      </div>

      {payModalOpen && (
        <PaymentModal
          dark={dark}
          onClose={() => setPayModalOpen(false)}
          onSubmitted={async () => { setPayModalOpen(false); await refresh(); }}
        />
      )}
    </>
  );
}
