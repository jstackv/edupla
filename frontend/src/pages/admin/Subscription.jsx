import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useBilling } from '../../context/BillingContext';
import {
  Wallet, GraduationCap, Wifi, Clock, CheckCircle2, XCircle, Loader2,
  PlusCircle, ArrowRight, ArrowLeft, X, Copy, Check, User, Mail, PhoneCall,
  Smartphone, Printer, Receipt, Hourglass,
  RefreshCw, Inbox, TrendingUp, Zap, Star, Crown, Sparkles, AlertCircle,
} from 'lucide-react';

const TOKENS = { emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b', slate: '#64748b', gold: '#d97706', indigo: '#6366f1', indigoDeep: '#4338ca', violet: '#8b5cf6' };

const STATUS_META = {
  PENDING: { label: 'Pending', color: TOKENS.amber, bg: 'rgba(245,158,11,0.1)', icon: Clock },
  SUCCESSFUL: { label: 'Confirmed', color: TOKENS.emerald, bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: TOKENS.rose, bg: 'rgba(244,63,94,0.1)', icon: XCircle },
  FAILED: { label: 'Failed', color: TOKENS.rose, bg: 'rgba(244,63,94,0.1)', icon: XCircle },
};

// Duotone theme cycled across plan cards in the Add Subscription modal
const PLAN_THEMES = [
  { icon: Zap, grad: 'linear-gradient(135deg,#6366f1,#4338ca)', glow: 'linear-gradient(135deg,#6366f1,#818cf8,#4338ca)', accent: '#6366f1' },
  { icon: Star, grad: 'linear-gradient(135deg,#d97706,#f59e0b)', glow: 'linear-gradient(135deg,#d97706,#fbbf24,#f59e0b)', accent: '#d97706' },
  { icon: Crown, grad: 'linear-gradient(135deg,#8b5cf6,#6366f1)', glow: 'linear-gradient(135deg,#8b5cf6,#a78bfa,#6366f1)', accent: '#8b5cf6' },
  { icon: Sparkles, grad: 'linear-gradient(135deg,#d97706,#6366f1)', glow: 'linear-gradient(135deg,#d97706,#fbbf24,#6366f1)', accent: '#d97706' },
];

const GLOBAL_STYLES = `
  @keyframes sub-fade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sub-scale { from { opacity:0; transform:scale(0.94) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes sub-card-in { from { opacity:0; transform: perspective(1000px) rotateX(8deg) translateY(24px); } to { opacity:1; transform: perspective(1000px) rotateX(0) translateY(0); } }
  @keyframes sub-shine-sweep { 0% { transform: translateX(-120%) rotate(20deg); } 100% { transform: translateX(220%) rotate(20deg); } }
  @keyframes sub-shimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }
  @keyframes sub-glow-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
  @keyframes sub-stamp-in { 0% { opacity:0; transform: scale(2.4) rotate(-14deg); } 60% { opacity:1; } 100% { opacity:1; transform: scale(1) rotate(-8deg); } }
  @keyframes sub-pop-in { from { opacity:0; transform: translateY(10px) scale(0.98); } to { opacity:1; transform: translateY(0) scale(1); } }
  @keyframes sub-btn-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
  @keyframes sub-icon-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  @keyframes sub-empty-pulse { 0%,100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.05); opacity: 1; } }

  .sub-card-wrap { animation: sub-card-in 0.7s cubic-bezier(0.16,1,0.3,1) both; }
  .sub-row { animation: sub-fade 0.4s cubic-bezier(0.16,1,0.3,1) both; transition: background .18s, transform .15s; }
  .sub-row:hover { background: var(--surface-100); transform: translateX(2px); }
  .sub-modal { animation: sub-scale 0.22s cubic-bezier(0.16,1,0.3,1) both; }

  .sub-btn { transition: transform .15s cubic-bezier(0.16,1,0.3,1), filter .15s, box-shadow .2s, background .15s, border-color .15s; }
  .sub-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
  .sub-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
  .sub-btn:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
  .sub-input { transition: border-color .18s, box-shadow .18s, background .18s; }
  .sub-input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }

  .sub-refresh-icon { transition: transform .5s cubic-bezier(0.16,1,0.3,1); }
  .sub-btn:hover .sub-refresh-icon { transform: rotate(180deg); }

  .sub-cta { position: relative; overflow: hidden; }
  .sub-cta::after { content:''; position:absolute; top:0; bottom:0; width:35%; background: linear-gradient(115deg, transparent, rgba(255,255,255,0.32), transparent); animation: sub-btn-shimmer 2.8s ease-in-out infinite; }
  .sub-cta:hover:not(:disabled) { box-shadow: 0 14px 32px rgba(99,102,241,0.4) !important; transform: translateY(-2px) !important; }
  .sub-cta-arrow { transition: transform .25s cubic-bezier(0.34,1.56,0.64,1); }
  .sub-cta:hover .sub-cta-arrow { transform: translateX(3px); }

  .sub-stat-card { transition: transform .18s cubic-bezier(0.16,1,0.3,1), box-shadow .18s, border-color .18s; }
  .sub-stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); border-color: rgba(99,102,241,0.3) !important; }

  .sub-plan-card { position: relative; cursor: pointer; text-align: left; border-radius: 18px; transition: transform .18s cubic-bezier(0.16,1,0.3,1); animation: sub-pop-in .4s cubic-bezier(0.16,1,0.3,1) both; }
  .sub-plan-card:hover { transform: translateY(-3px); }
  .sub-plan-card:active { transform: translateY(-1px) scale(0.99); }
  .sub-plan-glow { position: absolute; inset: -1px; border-radius: 19px; opacity: 0; transition: opacity .25s; }
  .sub-plan-card:hover .sub-plan-glow { opacity: 1; }
  .sub-plan-body { position: relative; border-radius: 18px; z-index: 1; }
  .sub-plan-icon { position: relative; overflow: hidden; }
  .sub-plan-icon::after { content:''; position:absolute; inset:0; background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 60%); }

  .sub-copy-field { transition: transform .15s, box-shadow .15s, border-color .15s; }
  .sub-copy-field:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.12); }
  .sub-copy-btn { transition: background .15s, transform .1s; }
  .sub-copy-btn:hover { transform: scale(1.08); }
  .sub-copy-btn:active { transform: scale(0.94); }

  .sub-step-num { width: 22px; height: 22px; border-radius: 999px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; font-size: 10.5px; font-weight: 800; font-family:'Sora',sans-serif; }

  .sub-progress-track { display:flex; align-items:center; gap:6px; }
  .sub-progress-dot { height: 5px; border-radius: 3px; flex: 1; background: rgba(99,102,241,0.16); transition: background .3s; }
  .sub-progress-dot.active { background: linear-gradient(90deg,#6366f1,#d97706); }
  .sub-progress-dot.done { background: #6366f1; }

  .sub-receipt-btn { transition: transform .15s, box-shadow .15s, background .15s, border-color .15s; }
  .sub-receipt-btn:hover { transform: translateY(-1px); background: rgba(99,102,241,0.08) !important; border-color: rgba(99,102,241,0.35) !important; color: #6366f1 !important; }

  .sub-close-btn { transition: transform .15s, background .15s; }
  .sub-close-btn:hover { transform: rotate(90deg); background: rgba(244,63,94,0.1) !important; }

  .sub-empty-icon { animation: sub-empty-pulse 2.6s ease-in-out infinite; }

  .sub-skel {
    background: linear-gradient(90deg, var(--surface-100) 25%, rgba(148,163,184,0.14) 37%, var(--surface-100) 63%);
    background-size: 400px 100%;
    animation: sub-shimmer 1.4s ease-in-out infinite;
    border-radius: 8px;
  }
  .sub-glow { animation: sub-glow-pulse 2.4s ease-in-out infinite; }
  .sub-stamp { animation: sub-stamp-in 0.5s cubic-bezier(0.16,1,0.3,1) both; }

  @media (prefers-reduced-motion: reduce) {
    .sub-card-wrap, .sub-row, .sub-modal, .sub-glow, .sub-stamp, .sub-plan-card, .sub-empty-icon { animation: none !important; }
    .sub-shine, .sub-cta::after { display: none !important; }
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

// ── Premium membership card — compact layout, matching the original
// card's height. Chip + masked number share one row again, spacing is
// tightened throughout, and the cardholder/plan row is smaller. ─────────
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
    setTilt({ x: (py - 0.5) * -5, y: (px - 0.5) * 6 });
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
  const planName = billing?.plan?.name || (isActive ? 'Active plan' : 'Free trial');
  const schoolName = billing?.school_admin_name || billing?.school_name || 'Your School';

  const rawId = String(billing?._id || billing?.school_id || '0000').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const last4 = (rawId.slice(-4) || '0000').padStart(4, '0');

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
        position: 'relative', borderRadius: 24, padding: '24px 26px', overflow: 'hidden',
        background: `
          radial-gradient(circle at 18% 12%, rgba(255,255,255,0.22) 0%, transparent 40%),
          radial-gradient(circle at 88% 88%, rgba(124,58,237,0.5) 0%, transparent 55%),
          linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #7c3aed 100%)
        `,
        boxShadow: hovering
          ? '0 30px 62px rgba(67,56,202,0.45), inset 0 1px 0 rgba(255,255,255,0.2)'
          : '0 22px 50px rgba(67,56,202,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.08)',
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovering ? 1.012 : 1})`,
        transition: hovering ? 'box-shadow .3s, transform .08s linear' : 'transform .5s cubic-bezier(0.16,1,0.3,1), box-shadow .4s',
        transformStyle: 'preserve-3d',
      }}>
        {/* giant brand watermark, sits behind all content, oblique diagonal */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: "'Sora',sans-serif", fontWeight: 810, fontSize: 90, lineHeight: 1,
            color: 'rgba(255,255,255,0.07)', letterSpacing: '0.03em', whiteSpace: 'nowrap',
            transform: 'rotate(-34deg)', userSelect: 'none',
          }}>
            EDUPLA
          </span>
        </div>
        <GraduationCap
          size={64}
          color="rgba(255,255,255,0.06)"
          style={{ position: 'absolute', right: 18, bottom: 14, zIndex: 0, transform: 'rotate(-10deg)', pointerEvents: 'none' }}
        />

        {hovering && (
          <div className="sub-shine" style={{
            position: 'absolute', top: '-50%', left: 0, width: '35%', height: '200%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)',
            animation: 'sub-shine-sweep 1.1s ease forwards', pointerEvents: 'none',
          }} />
        )}

        {/* top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
            }}>
              <GraduationCap size={15} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 13.5, color: '#fff', letterSpacing: '0.02em' }}>
              EDUPLA
            </span>
          </div>
          <Wifi size={18} color="rgba(255,255,255,0.75)" style={{ transform: 'rotate(90deg)' }} />
        </div>

        {/* chip + masked number, same row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 12, position: 'relative' }}>
          <div style={{
            width: 38, height: 26, borderRadius: 6, flexShrink: 0, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #fde9b8 0%, #d4af6a 50%, #b3873f 100%)',
            border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
          }}>
            <div style={{ position: 'absolute', top: '32%', left: 3, right: 3, height: 1, background: 'rgba(120,85,30,0.35)' }} />
            <div style={{ position: 'absolute', top: '68%', left: 3, right: 3, height: 1, background: 'rgba(120,85,30,0.35)' }} />
            <div style={{ position: 'absolute', left: '48%', top: 3, bottom: 3, width: 1, background: 'rgba(120,85,30,0.35)' }} />
          </div>
          <p style={{ fontFamily: "'Courier New',monospace", fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.13em', margin: 0 }}>
            •••• •••• •••• {last4}
          </p>
        </div>

        {/* cardholder (school name) + plan — compact */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, position: 'relative' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>
              Cardholder
            </p>
            <p style={{
              fontSize: 12, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.02em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220, textTransform: 'uppercase',
            }}>
              {schoolName}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>
              Plan
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>
              {planName}
            </p>
          </div>
        </div>

        {/* days remaining */}
        <div style={{ marginBottom: 14, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em',
              color: urgent ? '#fde68a' : '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}>
              {isLocked || isOverdue ? '—' : daysRemaining}
            </span>
            {!isLocked && !isOverdue && (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                day{daysRemaining === 1 ? '' : 's'} remaining
              </span>
            )}
          </div>
          {(isLocked || isOverdue) && (
            <p style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '3px 0 0' }}>
              {isLocked ? 'Access is locked' : 'Subscription expired'}
            </p>
          )}
          {urgent && (
            <p style={{ fontSize: 10.5, fontWeight: 700, color: '#fde68a', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertCircle size={10} /> Renew soon to avoid interruption
            </p>
          )}
        </div>

        {/* bottom row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 3px' }}>
              {isActive ? 'Valid until' : isLocked || isOverdue ? 'Status' : 'Trial ends'}
            </p>
            <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13.5, fontWeight: 700, color: '#fff', margin: 0 }}>
              {isLocked || isOverdue ? statusLabel : formatDateShort(validUntil)}
            </p>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 10.5, fontWeight: 700,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 5px ${statusColor}` }} />
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Copy-to-clipboard chip, used inside the payee instructions step ──────
function CopyField({ icon: Icon, label, value, accent = '#6366f1' }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error('Could not copy.'); }
  };
  return (
    <div className="sub-copy-field" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', background: 'var(--surface-100)', border: '1px solid var(--card-border)', borderRadius: 13 }}>
      <div className="sub-plan-icon" style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: `linear-gradient(135deg, ${accent}30, ${accent}18)`, border: `1px solid ${accent}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={13} color={accent} style={{ position: 'relative', zIndex: 1 }} />
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

// ── Add subscription modal (plan select → payee instructions → submit) ──
function AddSubscriptionModal({ onClose, onSubmitted }) {
  const [step, setStep] = useState('plans');
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
        toast.error('Could not load payment plans.');
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
      setError(err.response?.data?.message || 'Could not submit your payment claim.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = step === 'plans' ? 0 : 1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="sub-modal" style={{
        width: '100%', maxWidth: 430, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 22,
        boxShadow: '0 30px 90px rgba(0,0,0,0.35)',
      }}>
        {/* header */}
        <div style={{
          position: 'relative', overflow: 'hidden', padding: '1.4rem 1.6rem 1.05rem',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(217,119,6,0.06))',
          borderBottom: '1px solid var(--card-border)',
        }}>
          <div style={{
            position: 'absolute', top: -50, right: -40, width: 130, height: 130, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.24) 0%, transparent 70%)', pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {step === 'instructions' && (
                  <button onClick={() => setStep('plans')} className="sub-btn" style={{ width: 27, height: 27, borderRadius: 9, border: 'none', cursor: 'pointer', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowLeft size={13} color="var(--text-secondary)" />
                  </button>
                )}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {step === 'plans' ? 'Step 1 of 2' : 'Step 2 of 2'}
                  </p>
                  <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 16.5, color: 'var(--text-primary)', margin: '2px 0 0' }}>
                    {step === 'plans' ? 'Add subscription time' : 'Send payment'}
                  </h2>
                </div>
              </div>
              <button onClick={onClose} className="sub-btn sub-close-btn" style={{ width: 27, height: 27, borderRadius: 9, border: 'none', cursor: 'pointer', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={13} color="var(--text-secondary)" />
              </button>
            </div>
            <div className="sub-progress-track">
              <div className={`sub-progress-dot ${stepIndex >= 0 ? 'done' : ''}`} />
              <div className={`sub-progress-dot ${stepIndex === 1 ? 'active' : stepIndex > 1 ? 'done' : ''}`} />
            </div>
          </div>
        </div>

        <div style={{ padding: '1.4rem 1.6rem 1.6rem' }}>
          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center' }}>
              <Loader2 size={22} className="animate-spin" color="#6366f1" style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>Loading plans…</p>
            </div>
          ) : step === 'plans' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {plans.map((plan, idx) => {
                const theme = PLAN_THEMES[idx % PLAN_THEMES.length];
                const Icon = theme.icon;
                const isPopular = idx === Math.min(1, plans.length - 1) && plans.length > 1;
                return (
                  <div key={plan._id} className="sub-plan-card" onClick={() => choosePlan(plan, theme)} style={{ animationDelay: `${idx * 0.06}s` }}>
                    <div className="sub-plan-glow" style={{ background: theme.glow }} />
                    <div className="sub-plan-body" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '14px 15px', border: '1.5px solid var(--card-border)', background: 'var(--surface-100)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div className="sub-plan-icon" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: theme.grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={16} color="#fff" style={{ position: 'relative', zIndex: 1 }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{plan.name}</p>
                            {isPopular && (
                              <span style={{ fontSize: 9, fontWeight: 800, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
                                Popular
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{plan.days} days added</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: theme.accent, whiteSpace: 'nowrap' }}>{formatMoney(plan.amount, plan.currency)}</span>
                        <ArrowRight size={13} color="var(--text-secondary)" />
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
                background: `linear-gradient(135deg, ${selectedTheme.accent}18, rgba(217,119,6,0.06))`,
                border: `1px solid ${selectedTheme.accent}38`, borderRadius: 14, padding: '13px 15px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: selectedTheme.grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={13} color="#fff" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedPlan.name}</span>
                </div>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: selectedTheme.accent }}>{formatMoney(selectedPlan.amount, selectedPlan.currency)}</span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div className="sub-step-num" style={{ background: '#6366f1', color: '#fff' }}>1</div>
                  <div style={{ width: 1.5, flex: 1, background: 'var(--card-border)', margin: '4px 0' }} />
                </div>
                <div style={{ paddingBottom: 14 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
                    Send the exact amount via MTN Mobile Money
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CopyField icon={User} label="Recipient name" value={payee.name} accent="#6366f1" />
                    <CopyField icon={PhoneCall} label="MoMo number" value={payee.phone} accent="#d97706" />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div className="sub-step-num" style={{ background: 'var(--surface-100)', color: '#d97706', border: '1.5px solid #d97706' }}>2</div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                    Confirm your MoMo number <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>(optional)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Smartphone size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                      type="tel" placeholder="e.g. 0785 683 347" className="sub-input" value={senderPhone}
                      onChange={e => setSenderPhone(e.target.value)}
                      style={{
                        width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1px solid var(--card-border)',
                        background: 'var(--surface-100)', color: 'var(--text-primary)', fontSize: 13.5, boxSizing: 'border-box', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
                  <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
                </div>
              )}

              <button onClick={submitClaim} disabled={submitting} className="sub-btn sub-cta" style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff', border: 'none', borderRadius: 13,
                padding: '13px 14px', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, opacity: submitting ? 0.75 : 1,
                boxShadow: '0 8px 22px rgba(99,102,241,0.28)',
              }}>
                {submitting ? (<><Loader2 size={15} className="animate-spin" /> Submitting…</>) : (<>I've Sent the Payment <Check size={14} /></>)}
              </button>
              <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', textAlign: 'center', margin: '10px 0 0' }}>
                Access resumes automatically once an admin confirms receipt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Printable receipt — opens in its own window so nothing from the app
// layout can clip it, and forces exact color printing so it looks
// identical on screen, in the print preview, and in the saved PDF. ──────
function buildReceiptHtml(payment, schoolName) {
  const isManual = payment.method === 'manual';
  const statusKey = payment.status || 'PENDING';
  const isPaid = statusKey === 'SUCCESSFUL';
  const isRejected = statusKey === 'REJECTED' || statusKey === 'FAILED';
  const sealClass = isPaid ? 'paid' : isRejected ? 'rejected' : 'pending';
  const sealLabel = isPaid ? 'PAID' : isRejected ? (statusKey === 'REJECTED' ? 'REJECTED' : 'FAILED') : 'PENDING';
  const statusLabel = STATUS_META[statusKey]?.label || 'Pending';
  const statusColor = isPaid ? '#10b981' : isRejected ? '#f43f5e' : '#f59e0b';
  const receiptNo = String(payment._id).slice(-10).toUpperCase();
  const now = new Date();

  const rows = [
    ['School', schoolName],
    ['Plan', payment.plan_name || `${payment.plan_days}-day plan`],
    ['Payment method', isManual ? 'MTN Mobile Money' : 'MTN Mobile Money (API)'],
    ['Paid via', payment.phone || '—'],
    ['Date', formatDate(payment.reviewed_at || payment.created_at)],
    ['Access valid until', formatDate(payment.paid_until_after)],
  ];

  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td class="r-label">${label}</td>
      <td class="r-value">${value}</td>
    </tr>`).join('');

  const watermarkRows = Array.from({ length: 7 }).map((_, r) => `
    <div class="wm-row" style="margin-left:${r % 2 === 0 ? '0' : '-90px'}">
      ${Array.from({ length: 6 }).map(() => '<span>EDUPLA</span>').join('')}
    </div>`).join('');

  const barcode = Array.from({ length: 50 }).map((_, i) => {
    const seed = (i * 37 + receiptNo.charCodeAt(i % receiptNo.length)) % 100;
    const h = 12 + (seed % 22);
    const w = seed % 5 === 0 ? 3 : 2;
    return `<span style="height:${h}px;width:${w}px;"></span>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Edupla Receipt — ${receiptNo}</title>
<style>
  @page { size: A4; margin: 0; }
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body {
    margin: 0; padding: 0; background: #eef0f8;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a; display: flex; justify-content: center; padding: 28px 0;
  }
  .sheet {
    width: 210mm; min-height: 297mm; background: #fff; position: relative; overflow: hidden;
    box-shadow: 0 12px 44px rgba(30,27,75,0.16); border-radius: 6px;
  }
  .side-accent {
    position: absolute; left: 0; top: 0; bottom: 0; width: 7px; z-index: 4;
    background: linear-gradient(180deg,#6366f1 0%,#8b5cf6 45%,#d97706 100%);
  }
  .watermark {
    position: absolute; inset: 0; z-index: 0; opacity: 0.028; pointer-events: none;
    transform: rotate(-24deg) scale(1.5); transform-origin: center; padding-top: 20px;
  }
  .wm-row { display: flex; gap: 70px; margin-bottom: 46px; }
  .wm-row span { font-weight: 800; font-size: 30px; letter-spacing: 0.1em; color: #4338ca; white-space: nowrap; }

  .band {
    position: relative; z-index: 1; height: 132px; margin-left: 7px;
    background: linear-gradient(135deg,#4338ca 0%,#6366f1 55%,#7c3aed 100%);
    display: flex; align-items: center; justify-content: space-between; padding: 0 48px;
  }
  .band::before {
    content: ''; position: absolute; top: -45%; right: -6%; width: 280px; height: 280px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 70%);
  }
  .band::after {
    content: ''; position: absolute; bottom: -55%; left: 8%; width: 200px; height: 200px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
  }
  .brand { display: flex; align-items: center; gap: 13px; position: relative; z-index: 1; }
  .brand .logo {
    width: 44px; height: 44px; border-radius: 13px; background: rgba(255,255,255,0.18);
    display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25);
  }
  .brand .name { font-weight: 800; font-size: 20px; color: #fff; letter-spacing: 0.02em; margin: 0; }
  .brand .tag { font-size: 11px; color: rgba(255,255,255,0.78); margin-top: 2px; }
  .receipt-title { text-align: right; position: relative; z-index: 1; }
  .receipt-title .label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.68); text-transform: uppercase; letter-spacing: 0.12em; margin: 0 0 5px; }
  .receipt-title .num { font-size: 19px; font-weight: 800; color: #fff; margin: 0; font-family: 'Courier New', monospace; letter-spacing: 0.04em; }

  .body-content { position: relative; z-index: 1; padding: 46px 50px 36px; margin-left: 7px; }

  .eyebrow {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px;
    background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); color: #4338ca;
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 14px;
  }

  .seal { position: absolute; top: 84px; right: 46px; width: 108px; height: 108px; transform: rotate(-11deg); z-index: 3; }
  .seal-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px dashed currentColor; opacity: 0.5; }
  .seal-inner {
    position: absolute; inset: 8px; border-radius: 50%; border: 2.5px solid currentColor;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.6);
  }
  .seal-inner svg { margin-bottom: 2px; }
  .seal-inner .seal-label { font-weight: 800; font-size: 13px; letter-spacing: 0.06em; }
  .seal-inner .seal-sub { font-size: 6.5px; font-weight: 700; letter-spacing: 0.14em; opacity: 0.75; margin-top: 1px; }
  .seal.paid { color: #10b981; }
  .seal.rejected { color: #f43f5e; }
  .seal.pending { color: #f59e0b; }

  h1.title { font-size: 21px; font-weight: 800; color: #1e1b4b; margin: 0 0 4px; }
  .issued { font-size: 12px; color: #94a3b8; margin: 0 0 22px; }

  .amount-block {
    display: flex; justify-content: space-between; align-items: center;
    background: linear-gradient(135deg, rgba(99,102,241,0.07), rgba(217,119,6,0.05));
    border: 1px solid rgba(99,102,241,0.18); border-left: 4px solid #d97706;
    border-radius: 14px; padding: 22px 26px; margin: 0 0 30px;
  }
  .amount-block .label { font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 5px; }
  .amount-block .amount { font-size: 33px; font-weight: 800; color: #d97706; margin: 0; letter-spacing: -0.01em; }
  .status-pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px;
    font-size: 12.5px; font-weight: 800;
  }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; }

  .section-label {
    display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 800; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 10px;
  }

  .table-wrap { border: 1px solid #e9e7f5; border-radius: 13px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  tr:nth-child(even) { background: #faf9ff; }
  tr:not(:last-child) td { border-bottom: 1px solid #f1f0fa; }
  .r-label { padding: 11px 16px; font-size: 12.5px; font-weight: 600; color: #64748b; white-space: nowrap; }
  .r-value { padding: 11px 16px; font-size: 12.5px; font-weight: 700; color: #1e1b4b; text-align: right; }

  .footer { margin-top: 40px; padding-top: 22px; border-top: 1.5px dashed #e2e8f0; text-align: center; }
  .footer .thanks { font-size: 13.5px; font-weight: 700; color: #1e1b4b; margin: 0 0 6px; }
  .footer p { font-size: 11px; color: #94a3b8; line-height: 1.7; margin: 0; }

  .barcode { display: flex; gap: 2px; align-items: flex-end; justify-content: center; margin: 22px 0 6px; height: 36px; }
  .barcode span { display: inline-block; background: #1e1b4b; opacity: 0.72; }

  .meta-row {
    display: flex; justify-content: space-between; margin-top: 26px; padding-top: 14px;
    border-top: 1px solid #f1f0fa; font-size: 9.5px; color: #b3b8ce; letter-spacing: 0.03em;
  }

  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; width: 100%; min-height: 100vh; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="side-accent"></div>
    <div class="watermark">${watermarkRows}</div>

    <div class="band">
      <div class="brand">
        <div class="logo">
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/>
          </svg>
        </div>
        <div>
          <p class="name">EDUPLA</p>
          <p class="tag">School Management &amp; Online Assessment</p>
        </div>
      </div>
      <div class="receipt-title">
        <p class="label">Receipt No.</p>
        <p class="num">#${receiptNo}</p>
      </div>
    </div>

    <div class="body-content">
      <div class="seal ${sealClass}">
        <div class="seal-ring"></div>
        <div class="seal-inner">
          ${isPaid ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>` : ''}
          <span class="seal-label">${sealLabel}</span>
          <span class="seal-sub">EDUPLA · VERIFIED</span>
        </div>
      </div>

      <span class="eyebrow">Official Receipt</span>
      <h1 class="title">Payment Receipt</h1>
      <p class="issued">Issued on ${formatDate(now)}</p>

      <div class="amount-block">
        <div>
          <p class="label">Total amount paid</p>
          <p class="amount">${formatMoney(payment.amount, payment.currency)}</p>
        </div>
        <span class="status-pill" style="background:${statusColor}18;color:${statusColor};">
          <span class="status-dot" style="background:${statusColor};box-shadow:0 0 6px ${statusColor};"></span>
          ${statusLabel}
        </span>
      </div>

      <p class="section-label">Transaction Details</p>
      <div class="table-wrap">
        <table><tbody>${rowsHtml}</tbody></table>
      </div>

      <div class="footer">
        <p class="thanks">Thank you for keeping Edupla running at your school.</p>
        <p>This receipt was generated automatically by Edupla.<br/>Questions about this receipt? jstackvm@gmail.com</p>
        <div class="barcode">${barcode}</div>
        <p style="font-size:9.5px;letter-spacing:0.1em;">${receiptNo}</p>
      </div>

      <div class="meta-row">
        <span>Generated electronically — no signature required</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 350);
    };
  </script>
</body>
</html>`;
}

function ReceiptModal({ payment, schoolName, onClose }) {
  const isManual = payment.method === 'manual';

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=880,height=1120');
    if (!w) {
      toast.error('Please allow pop-ups to print the receipt.');
      return;
    }
    w.document.open();
    w.document.write(buildReceiptHtml(payment, schoolName));
    w.document.close();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', padding: 16 }}>
      <div className="sub-modal" style={{ width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto', background: 'var(--card-bg)', borderRadius: 22, border: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Receipt</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} className="sub-btn sub-cta" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={12} /> Print
            </button>
            <button onClick={onClose} className="sub-btn sub-close-btn" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        <div style={{ padding: '28px 26px', background: '#fff', color: '#0f172a' }}>
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
              ['Payment method', isManual ? 'MTN Mobile Money' : 'MTN MoMo (API)'],
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
  const [refreshing, setRefreshing] = useState(false);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshBilling?.(), loadHistory()]);
    } finally {
      setRefreshing(false);
    }
  };

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
        <button onClick={handleRefresh} disabled={refreshing} className="sub-btn" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 11,
          border: '1px solid var(--card-border)', background: 'var(--surface-100)', color: 'var(--text-primary)', fontSize: 12.5, fontWeight: 700,
          cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.75 : 1,
        }}>
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} className="sub-refresh-icon" />}
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 26, alignItems: 'flex-start' }}>
        <MembershipCard billing={billing} />

        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingManual ? (
            <div className="sub-row" style={{
              padding: '16px 18px', borderRadius: 16, border: `1.5px solid ${TOKENS.amber}`,
              background: 'rgba(245,158,11,0.06)', display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <Hourglass size={18} color={TOKENS.amber} className="sub-glow" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Payment awaiting confirmation</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.5 }}>
                  Your {pendingManual.plan_name} claim ({formatMoney(pendingManual.amount, pendingManual.currency)}) is being reviewed. Submitted {formatDate(pendingManual.submitted_at)}.
                </p>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddModal(true)} className="sub-btn sub-cta" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 20px', borderRadius: 16,
              border: 'none', background: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#fff', cursor: 'pointer',
              fontSize: 14.5, fontWeight: 700, boxShadow: '0 10px 24px rgba(99,102,241,0.3)',
            }}>
              <PlusCircle size={18} /> Add Subscription <ArrowRight size={15} className="sub-cta-arrow" />
            </button>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="sub-stat-card" style={{ flex: 1, padding: '13px 15px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Total paid</p>
              <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: TOKENS.gold, margin: 0 }}>{totalPaid.toLocaleString('en-US')} RWF</p>
            </div>
            <div className="sub-stat-card" style={{ flex: 1, padding: '13px 15px', borderRadius: 14, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
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
            <div className="sub-empty-icon" style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
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
                  <button onClick={() => setReceiptTarget(payment)} className="sub-btn sub-receipt-btn" style={{
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