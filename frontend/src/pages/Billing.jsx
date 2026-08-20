import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useBilling } from '../context/BillingContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  GraduationCap, Smartphone, LogOut, ArrowRight, ArrowLeft, Sun, Moon,
  CheckCircle2, AlertCircle, Loader2, Clock, ShieldCheck,
  X, Copy, Check, User, PhoneCall, CreditCard, Hourglass,
  Sparkles, Star, Zap, Crown, Wallet, RefreshCw, CalendarClock, Lock,
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
  @keyframes bp2-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
  @keyframes bp2-pop-in { from { opacity:0; transform: translateY(10px) scale(0.98); } to { opacity:1; transform: translateY(0) scale(1); } }
  @keyframes bp2-glow-pulse { 0%,100% { opacity:0.55; } 50% { opacity:1; } }

  /* ── new: icon ring system, breathing card, staggered content ── */
  @keyframes bp3-ring-expand {
    0%   { transform: scale(0.75); opacity: 0.55; }
    70%  { opacity: 0; }
    100% { transform: scale(1.55); opacity: 0; }
  }
  @keyframes bp3-icon-pop {
    0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
    60%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes bp3-card-breathe {
    0%,100% { box-shadow: 0 30px 80px rgba(0,0,0,0.55), 0 0 0 rgba(249,115,22,0); }
    50%     { box-shadow: 0 34px 90px rgba(0,0,0,0.55), 0 0 46px rgba(249,115,22,0.10); }
  }
  @keyframes bp3-card-breathe-light {
    0%,100% { box-shadow: 0 30px 70px rgba(249,115,22,0.14), 0 0 0 rgba(249,115,22,0); }
    50%     { box-shadow: 0 34px 80px rgba(249,115,22,0.18), 0 0 40px rgba(249,115,22,0.08); }
  }
  @keyframes bp3-stagger-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bp3-dash-flow {
    to { stroke-dashoffset: -24; }
  }
  @keyframes bp3-check-draw {
    from { stroke-dashoffset: 24; }
    to   { stroke-dashoffset: 0; }
  }

  .bp-fade { animation: bp-fade-up 0.5s ease both; }
  .bp-modal { animation: bp-modal-in 0.22s cubic-bezier(0.16,1,0.3,1) both; }
  .bp-pulse { animation: bp-pulse 1.6s ease-in-out infinite; }
  .bp-spin { animation: bp-spin 1s linear infinite; }

  .bp-input { transition: border-color .2s, box-shadow .2s, background .2s; }
  .bp-input:focus { border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.15); }

  .bp-pay-btn { transition: transform .2s, box-shadow .2s, filter .2s; }
  .bp-pay-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(249,115,22,0.35); filter: brightness(1.05); }
  .bp-pay-btn:active:not(:disabled) { transform: translateY(0); }

  .bp-copy-btn { transition: background .15s, transform .1s; }
  .bp-copy-btn:hover { transform: scale(1.05); }
  .bp-copy-btn:active { transform: scale(0.96); }

  .bp2-shell { position: relative; border-radius: 24px; overflow: hidden; }
  .bp2-orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(2px); animation: bp-orb 8s ease-in-out infinite; }

  .bp2-progress-track { display:flex; align-items:center; gap:6px; }
  .bp2-progress-dot { height: 5px; border-radius: 3px; flex: 1; background: rgba(99,102,241,0.16); transition: background .3s; position: relative; overflow: hidden; }
  .bp2-progress-dot.active { background: linear-gradient(90deg,#6366f1,#f97316); }
  .bp2-progress-dot.done { background: #6366f1; }

  .bp2-plan-card { position: relative; cursor: pointer; text-align: left; border-radius: 18px; transition: transform .18s cubic-bezier(0.16,1,0.3,1); animation: bp2-pop-in .4s cubic-bezier(0.16,1,0.3,1) both; }
  .bp2-plan-card:hover { transform: translateY(-3px); }
  .bp2-plan-card:active { transform: translateY(-1px) scale(0.99); }
  .bp2-plan-card .bp2-plan-glow { position: absolute; inset: -1px; border-radius: 19px; opacity: 0; transition: opacity .25s; }
  .bp2-plan-card:hover .bp2-plan-glow, .bp2-plan-card.selected .bp2-plan-glow { opacity: 1; }
  .bp2-plan-card .bp2-plan-body { position: relative; border-radius: 18px; z-index: 1; }

  .bp2-icon-badge { display:flex; align-items:center; justify-content:center; flex-shrink:0; position: relative; overflow: hidden; }
  .bp2-icon-badge::after { content:''; position:absolute; inset:0; background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 60%); }

  .bp2-step-num { width: 22px; height: 22px; border-radius: 999px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; font-size: 10.5px; font-weight: 800; font-family:'Sora',sans-serif; }

  .bp2-shimmer-btn { position: relative; overflow: hidden; }
  .bp2-shimmer-btn::after { content: ''; position: absolute; top: 0; bottom: 0; width: 40%; background: linear-gradient(115deg, transparent, rgba(255,255,255,0.35), transparent); animation: bp2-shimmer 2.6s ease-in-out infinite; }

  .bp2-copy-field { transition: transform .15s, border-color .15s, box-shadow .15s; }
  .bp2-copy-field:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.14); }

  .bp2-badge-glow { animation: bp2-glow-pulse 2.4s ease-in-out infinite; }

  /* ── outer status card polish ── */
  .bp3-card-dark { animation: bp3-card-breathe 4.5s ease-in-out infinite; }
  .bp3-card-light { animation: bp3-card-breathe-light 4.5s ease-in-out infinite; }

  .bp3-icon-wrap { position: relative; width: 76px; height: 76px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
  .bp3-icon-ring { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid currentColor; animation: bp3-ring-expand 2.6s ease-out infinite; }
  .bp3-icon-ring.r2 { animation-delay: 0.9s; }
  .bp3-icon-core { position: relative; width: 60px; height: 60px; border-radius: 18px; display: flex; align-items: center; justify-content: center; animation: bp3-icon-pop 0.55s cubic-bezier(0.16,1,0.3,1) both; z-index: 1; overflow: hidden; }
  .bp3-icon-core::after { content:''; position:absolute; inset:0; background: radial-gradient(circle at 28% 22%, rgba(255,255,255,0.4), transparent 60%); }

  .bp3-status-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 999px; font-size: 10.5px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;
    animation: bp3-stagger-in 0.4s ease 0.05s both;
  }

  .bp3-stagger-1 { animation: bp3-stagger-in 0.45s ease 0.1s both; }
  .bp3-stagger-2 { animation: bp3-stagger-in 0.45s ease 0.18s both; }
  .bp3-stagger-3 { animation: bp3-stagger-in 0.45s ease 0.26s both; }
  .bp3-stagger-4 { animation: bp3-stagger-in 0.45s ease 0.34s both; }

  .bp3-ghost-btn { transition: transform .18s, background .18s, border-color .18s, box-shadow .18s; }
  .bp3-ghost-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
  .bp3-ghost-btn:active { transform: translateY(0); }
  .bp3-ghost-btn .bp3-refresh-icon { transition: transform .5s cubic-bezier(0.16,1,0.3,1); }
  .bp3-ghost-btn:hover .bp3-refresh-icon { transform: rotate(180deg); }

  .bp3-signout-btn { transition: color .18s, gap .18s; }
  .bp3-signout-btn:hover { color: #f97316 !important; gap: 9px; }

  .bp3-meta-row { display: flex; align-items: center; justify-content: center; gap: 6px; transition: transform .18s; }
  .bp3-meta-row:hover { transform: translateY(-1px); }

  .bp3-cta-btn { position: relative; overflow: hidden; }
  .bp3-cta-btn:hover:not(:disabled) { transform: translateY(-2px) !important; box-shadow: 0 14px 34px rgba(249,115,22,0.4) !important; }
  .bp3-cta-icon { transition: transform .25s cubic-bezier(0.34,1.56,0.64,1); }
  .bp3-cta-btn:hover .bp3-cta-icon { transform: translateX(3px); }

  .bp3-timeline-dot { position: relative; }
  .bp3-timeline-dot::before { content:''; position:absolute; inset:-4px; border-radius:50%; background: currentColor; opacity: 0.15; animation: bp2-glow-pulse 2s ease-in-out infinite; }
`;

// Alternating duotone accents per plan card — indigo / orange / violet-mix
const PLAN_THEMES = [
  { icon: Zap, grad: 'linear-gradient(135deg,#6366f1,#4338ca)', glow: 'linear-gradient(135deg,#6366f1,#818cf8,#4338ca)', accent: '#6366f1' },
  { icon: Star, grad: 'linear-gradient(135deg,#f97316,#ea580c)', glow: 'linear-gradient(135deg,#f97316,#fb923c,#ea580c)', accent: '#f97316' },
  { icon: Crown, grad: 'linear-gradient(135deg,#8b5cf6,#6366f1)', glow: 'linear-gradient(135deg,#8b5cf6,#a78bfa,#6366f1)', accent: '#8b5cf6' },
  { icon: Sparkles, grad: 'linear-gradient(135deg,#f97316,#6366f1)', glow: 'linear-gradient(135deg,#f97316,#fb923c,#6366f1)', accent: '#f97316' },
];

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
function CopyField({ icon: Icon, label, value, dark, accent = '#6366f1' }) {
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
    <div className="bp2-copy-field" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      background: dark ? 'rgba(255,255,255,0.04)' : '#fff8f2',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f1d9c5'}`,
      borderRadius: 14,
    }}>
      <div className="bp2-icon-badge" style={{
        width: 34, height: 34, borderRadius: 11, flexShrink: 0,
        background: `linear-gradient(135deg, ${accent}33, ${accent}1a)`,
        border: `1px solid ${accent}40`,
      }}>
        <Icon size={14} color={accent} style={{ position: 'relative', zIndex: 1 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: dark ? '#64748b' : '#a1745a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </p>
        <p style={{ fontSize: 13.5, fontWeight: 800, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </p>
      </div>
      <button type="button" onClick={doCopy} className="bp-copy-btn" style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
        border: 'none', background: copied ? 'rgba(22,163,74,0.15)' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} color={dark ? '#94a3b8' : '#64748b'} />}
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
  const [selectedTheme, setSelectedTheme] = useState(PLAN_THEMES[0]);
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

  const choosePlan = (plan, theme) => {
    setSelectedPlan(plan);
    setSelectedTheme(theme);
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

  const stepIndex = step === 'plans' ? 0 : 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: 16,
    }}>
      <div className="bp-modal bp2-shell" style={{
        width: '100%', maxWidth: 430, maxHeight: '88vh', overflowY: 'auto',
        background: dark ? '#111827' : '#fff',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.14)'}`,
        boxShadow: '0 30px 90px rgba(0,0,0,0.4)',
      }}>
        {/* header */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          padding: '1.5rem 1.75rem 1.1rem',
          background: dark
            ? 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(249,115,22,0.08))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(249,115,22,0.05))',
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.12)'}`,
        }}>
          <div className="bp2-orb" style={{
            width: 130, height: 130, top: -50, right: -40,
            background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {step === 'instructions' && (
                  <button onClick={() => setStep('plans')} style={{
                    width: 28, height: 28, borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ArrowLeft size={13} color={dark ? '#94a3b8' : '#64748b'} />
                  </button>
                )}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {step === 'plans' ? 'Step 1 of 2' : 'Step 2 of 2'}
                  </p>
                  <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 17, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '2px 0 0' }}>
                    {step === 'plans' ? 'Choose your plan' : 'Send your payment'}
                  </h2>
                </div>
              </div>
              <button onClick={onClose} style={{
                width: 28, height: 28, borderRadius: 9, border: 'none', cursor: 'pointer',
                background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <X size={13} color={dark ? '#94a3b8' : '#64748b'} />
              </button>
            </div>
            <div className="bp2-progress-track">
              <div className={`bp2-progress-dot ${stepIndex >= 0 ? 'done' : ''}`} />
              <div className={`bp2-progress-dot ${stepIndex === 1 ? 'active' : stepIndex > 1 ? 'done' : ''}`} />
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem 1.75rem 1.75rem' }}>
          {loading ? (
            <div style={{ padding: '34px 0', textAlign: 'center' }}>
              <Loader2 size={22} className="bp-spin" color="#6366f1" style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: 12.5, color: dark ? '#94a3b8' : '#64748b', margin: 0 }}>Loading plans…</p>
            </div>
          ) : step === 'plans' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {plans.length === 0 ? (
                <p style={{ fontSize: 12.5, color: dark ? '#94a3b8' : '#64748b', textAlign: 'center', padding: '20px 0' }}>
                  No payment plans are available right now. Please contact Edupla support.
                </p>
              ) : plans.map((plan, idx) => {
                const theme = PLAN_THEMES[idx % PLAN_THEMES.length];
                const Icon = theme.icon;
                const isPopular = idx === Math.min(1, plans.length - 1) && plans.length > 1;
                return (
                  <div
                    key={plan._id}
                    className="bp2-plan-card"
                    onClick={() => choosePlan(plan, theme)}
                    style={{ animationDelay: `${idx * 0.06}s` }}
                  >
                    <div className="bp2-plan-glow" style={{ background: theme.glow }} />
                    <div className="bp2-plan-body" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '15px 16px',
                      border: `1.5px solid ${dark ? 'rgba(255,255,255,0.09)' : '#e9e3fb'}`,
                      background: dark ? '#161f30' : '#fff',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div className="bp2-icon-badge" style={{
                          width: 40, height: 40, borderRadius: 13, flexShrink: 0,
                          background: theme.grad,
                        }}>
                          <Icon size={17} color="#fff" style={{ position: 'relative', zIndex: 1 }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ fontSize: 14.5, fontWeight: 800, color: dark ? '#f1f5f9' : '#1e1b4b', margin: 0 }}>{plan.name}</p>
                            {isPopular && (
                              <span className="bp2-badge-glow" style={{
                                fontSize: 9, fontWeight: 800, color: '#6366f1',
                                background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: 999,
                                textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0,
                              }}>
                                Popular
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11.5, color: dark ? '#94a3b8' : '#7c6a90', margin: '2px 0 0' }}>{plan.days} days of full access</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 16, color: theme.accent, whiteSpace: 'nowrap' }}>
                          {formatMoney(plan.amount, plan.currency)}
                        </span>
                        <ArrowRight size={14} color={dark ? '#5b6485' : '#c2895d'} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(249,115,22,0.06))',
                border: '1px solid rgba(99,102,241,0.22)', borderRadius: 14, padding: '13px 16px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: selectedTheme.grad,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Wallet size={14} color="#fff" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#1e1b4b' }}>{selectedPlan.name}</span>
                </div>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 16, color: selectedTheme.accent }}>
                  {formatMoney(selectedPlan.amount, selectedPlan.currency)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div className="bp2-step-num" style={{ background: '#6366f1', color: '#fff' }}>1</div>
                  <div style={{ width: 1.5, flex: 1, background: dark ? 'rgba(255,255,255,0.1)' : '#e9e3fb', margin: '4px 0' }} />
                </div>
                <div style={{ paddingBottom: 14 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '0 0 10px' }}>
                    Send the exact amount via MTN Mobile Money
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CopyField icon={User} label="Recipient name" value={payee.name} dark={dark} accent="#6366f1" />
                    <CopyField icon={PhoneCall} label="MoMo number" value={payee.phone} dark={dark} accent="#f97316" />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div className="bp2-step-num" style={{
                    background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.1)',
                    color: '#f97316', border: '1.5px solid #f97316',
                  }}>2</div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: dark ? '#f1f5f9' : '#1e1b4b', marginBottom: 8 }}>
                    Confirm your MoMo number <span style={{ fontWeight: 500, color: dark ? '#5b6485' : '#a1745a' }}>(optional, speeds up review)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Smartphone size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: dark ? '#5b6485' : '#c2895d' }} />
                    <input
                      type="tel"
                      placeholder="e.g. 0785 683 347"
                      className="bp-input"
                      value={senderPhone}
                      onChange={e => setSenderPhone(e.target.value)}
                      style={{
                        width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12,
                        border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#f1d9c5'}`,
                        background: dark ? 'rgba(255,255,255,0.05)' : '#fff8f2',
                        color: dark ? '#f1f5f9' : '#0f172a', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>
              </div>

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

              <button onClick={submitClaim} disabled={submitting} className="bp-pay-btn bp2-shimmer-btn" style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                background: 'linear-gradient(135deg,#6366f1,#f97316)', color: '#fff',
                border: 'none', borderRadius: 13, padding: '13px 14px', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700, opacity: submitting ? 0.75 : 1,
              }}>
                {submitting ? (<><Loader2 size={15} className="bp-spin" /> Submitting…</>) : (<>I've Sent the Payment <Check size={14} /></>)}
              </button>
              <p style={{ fontSize: 10.5, color: dark ? '#5b6485' : '#a1745a', textAlign: 'center', margin: '10px 0 0' }}>
                Your access resumes automatically once an admin confirms receipt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Billing() {
  const { user, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const { billing, refresh } = useBilling();

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const isPayer = billing?.is_payer;
  const isLocked = billing?.status === 'locked';
  const isPayableLock = isLocked && billing?.locked_payable === true;
  const canShowPaymentForm = isPayer && (!isLocked || isPayableLock);
  const pendingManual = billing?.pending_manual_payment;

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
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

        <button onClick={toggleTheme} title={dark ? 'Switch to light' : 'Switch to dark'} className="bp3-ghost-btn" style={{
          position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          {dark ? <Sun size={15} color="#94a3b8" /> : <Moon size={15} color="#64748b" />}
        </button>

        <div className={`bp-fade ${dark ? 'bp3-card-dark' : 'bp3-card-light'}`} style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
          background: dark ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.94)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.14)'}`,
          borderRadius: 28, padding: '2.5rem 2.25rem',
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
        }}>
          {/* Brand mark */}
          <div className="bp3-stagger-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 26 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#4338ca)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(99,102,241,0.35)',
            }}>
              <GraduationCap size={16} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', color: dark ? '#f1f5f9' : '#1e1b4b' }}>
              EDUPLA
            </span>
          </div>

          {pendingManual ? (
            <>
              <div className="bp3-stagger-1" style={{
                width: 'fit-content', margin: '0 auto', color: '#f97316',
              }}>
                <div className="bp3-status-pill" style={{
                  background: dark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.09)',
                  border: '1px solid rgba(249,115,22,0.28)', color: '#f97316',
                }}>
                  <Hourglass size={11} className="bp-pulse" /> Awaiting review
                </div>
              </div>

              <div className="bp3-icon-wrap bp3-stagger-2" style={{ color: '#f97316' }}>
                <div className="bp3-icon-ring" />
                <div className="bp3-icon-ring r2" />
                <div className="bp3-icon-core" style={{
                  background: 'linear-gradient(135deg,#f97316,#ea580c)',
                  boxShadow: '0 10px 30px rgba(249,115,22,0.35)',
                }}>
                  <Hourglass size={26} color="#fff" style={{ position: 'relative', zIndex: 1 }} />
                </div>
              </div>

              <h1 className="bp3-stagger-2" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '0 0 10px' }}>
                Payment awaiting confirmation
              </h1>
              <p className="bp3-stagger-3" style={{ fontSize: 13.5, color: dark ? '#94a3b8' : '#64748b', margin: '0 0 20px', lineHeight: 1.65, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
                We've recorded your <strong style={{ color: dark ? '#f1f5f9' : '#1e1b4b' }}>{pendingManual.plan_name}</strong> payment claim of{' '}
                <strong style={{ color: '#f97316' }}>{formatMoney(pendingManual.amount, pendingManual.currency)}</strong>. Access resumes automatically the moment an Edupla administrator confirms receipt.
              </p>

              <div className="bp3-stagger-3 bp3-meta-row" style={{
                marginBottom: 22, padding: '10px 16px', borderRadius: 999,
                background: dark ? 'rgba(255,255,255,0.04)' : '#fff8f2',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f1d9c5'}`,
                width: 'fit-content', marginLeft: 'auto', marginRight: 'auto',
              }}>
                <div className="bp3-timeline-dot" style={{ color: '#f97316' }}>
                  <CalendarClock size={13} color="#f97316" style={{ position: 'relative', zIndex: 1 }} />
                </div>
                <span style={{ fontSize: 11.5, color: dark ? '#94a3b8' : '#92552f', fontWeight: 600 }}>
                  Submitted {formatDate(pendingManual.submitted_at)}
                </span>
              </div>

              <button onClick={handleCheckStatus} disabled={checking} className="bp-pay-btn bp3-ghost-btn" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: dark ? '#f1f5f9' : '#1e1b4b',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 12, padding: '11px 20px', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700, opacity: checking ? 0.7 : 1,
              }}>
                {checking ? <Loader2 size={14} className="bp-spin" /> : <RefreshCw size={13} className="bp3-refresh-icon" />}
                {checking ? 'Checking…' : 'Check status'}
              </button>
            </>
          ) : (
            <>
              <div className="bp3-stagger-1" style={{
                width: 'fit-content', margin: '0 auto',
              }}>
                <div className="bp3-status-pill" style={{
                  background: isLocked && !isPayableLock
                    ? (dark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
                    : (dark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.09)'),
                  border: `1px solid ${isLocked && !isPayableLock ? 'rgba(239,68,68,0.28)' : 'rgba(249,115,22,0.28)'}`,
                  color: isLocked && !isPayableLock ? '#ef4444' : '#f97316',
                }}>
                  {isLocked && !isPayableLock ? <Lock size={11} /> : <Clock size={11} />}
                  {isLocked ? (isPayableLock ? 'Action needed' : 'Locked') : isPayer ? 'Trial ended' : 'Access paused'}
                </div>
              </div>

              <div className="bp3-icon-wrap bp3-stagger-2" style={{ color: isLocked && !isPayableLock ? '#ef4444' : '#f97316' }}>
                <div className="bp3-icon-ring" />
                <div className="bp3-icon-ring r2" />
                <div className="bp3-icon-core" style={{
                  background: isLocked && !isPayableLock
                    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                    : 'linear-gradient(135deg,#f97316,#ea580c)',
                  boxShadow: isLocked && !isPayableLock
                    ? '0 10px 30px rgba(239,68,68,0.35)'
                    : '0 10px 30px rgba(249,115,22,0.35)',
                }}>
                  {isLocked && !isPayableLock
                    ? <ShieldCheck size={26} color="#fff" style={{ position: 'relative', zIndex: 1 }} />
                    : <Clock size={26} color="#fff" style={{ position: 'relative', zIndex: 1 }} />}
                </div>
              </div>

              <h1 className="bp3-stagger-2" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '0 0 10px' }}>
                {isLocked ? (isPayableLock ? 'Payment required to unlock' : 'Access locked') : isPayer ? 'Subscription payment needed' : 'Access paused'}
              </h1>
              <p className="bp3-stagger-3" style={{ fontSize: 13.5, color: dark ? '#94a3b8' : '#64748b', margin: '0 0 26px', lineHeight: 1.65, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
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
                <button onClick={() => setPayModalOpen(true)} className="bp-pay-btn bp2-shimmer-btn bp3-cta-btn bp3-stagger-4" style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff',
                  border: 'none', borderRadius: 13, padding: '14px 14px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, marginBottom: 6,
                  boxShadow: '0 8px 24px rgba(249,115,22,0.28)',
                }}>
                  <CreditCard size={16} /> Process Payment <ArrowRight size={15} className="bp3-cta-icon" />
                </button>
              )}

              {isLocked && billing?.locked_at && (
                <div className="bp3-stagger-4 bp3-meta-row" style={{ marginTop: 18 }}>
                  <span style={{ fontSize: 11, color: dark ? '#475569' : '#94a3b8' }}>
                    Locked {formatDate(billing.locked_at)}
                  </span>
                </div>
              )}
              {!isLocked && billing?.trial_ends_at && (
                <div className="bp3-stagger-4 bp3-meta-row" style={{ marginTop: 18 }}>
                  <span style={{ fontSize: 11, color: dark ? '#475569' : '#94a3b8' }}>
                    Trial ended {formatDate(billing.trial_ends_at)}
                  </span>
                </div>
              )}

              {user && (
                <button onClick={logout} className="bp3-signout-btn" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600, color: dark ? '#64748b' : '#94a3b8',
                  marginTop: 24,
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