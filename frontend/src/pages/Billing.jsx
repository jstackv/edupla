import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useBilling } from '../context/BillingContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  GraduationCap, Smartphone, LogOut, ArrowRight, Sun, Moon,
  Sparkles, CheckCircle2, AlertCircle, Loader2, Clock, ShieldCheck,
} from 'lucide-react';

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');

  @keyframes bp-orb {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(26px,-18px) scale(1.05); }
    66%     { transform: translate(-18px,14px) scale(0.96); }
  }
  @keyframes bp-fade-up { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes bp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  @keyframes bp-spin { to { transform: rotate(360deg); } }
  .bp-fade { animation: bp-fade-up 0.5s ease both; }
  .bp-pulse { animation: bp-pulse 1.6s ease-in-out infinite; }
  .bp-spin { animation: bp-spin 1s linear infinite; }

  .bp-input { transition: border-color .2s, box-shadow .2s, background .2s; }
  .bp-input:focus { border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.15); }

  .bp-pay-btn { transition: transform .2s, box-shadow .2s, filter .2s; }
  .bp-pay-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(249,115,22,0.35); filter: brightness(1.05); }
  .bp-pay-btn:active:not(:disabled) { transform: translateY(0); }
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

export default function Billing() {
  const { user, logout } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const { billing, refresh } = useBilling();

  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState('idle'); // idle | requesting | awaiting | success | failed
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    if (billing?.default_phone) setPhone(billing.default_phone);
  }, [billing?.default_phone]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const isPayer = billing?.is_payer;
  const isLocked = billing?.status === 'locked';
  const plan = billing?.plan;

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
          // ~3.5 minutes of polling — stop and let them retry manually
          clearInterval(pollRef.current);
          setStage('failed');
          setError('We haven\u2019t heard back yet. If you approved the prompt, wait a moment and try again.');
        }
      } catch (err) {
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
    setStage('requesting');
    try {
      const res = await api.post('/billing/pay', { phone: phone.trim() });
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
            ) : isLocked ? (
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
          ) : (
            <>
              <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 19, color: dark ? '#f1f5f9' : '#1e1b4b', margin: '0 0 8px' }}>
                {isLocked ? 'Access locked' : isPayer ? 'Subscription payment needed' : 'Access paused'}
              </h1>
              <p style={{ fontSize: 13.5, color: dark ? '#94a3b8' : '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
                {isLocked
                  ? (billing?.locked_reason
                      ? `Your school's Edupla access has been locked: ${billing.locked_reason}`
                      : 'Your school\u2019s Edupla access has been locked by Edupla administrators. Please contact support.')
                  : isPayer
                    ? 'Your school\u2019s free trial has ended. Pay with MTN Mobile Money to keep using Edupla.'
                    : 'Your school\u2019s Edupla subscription has ended. Only your school administrator can renew it — please reach out to them.'}
              </p>

              {isPayer && !isLocked && plan && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: dark ? 'rgba(255,255,255,0.04)' : '#fff8f2',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#f1d9c5'}`,
                  borderRadius: 14, padding: '12px 16px', marginBottom: 20,
                }}>
                  <span style={{ fontSize: 12.5, color: dark ? '#94a3b8' : '#92552f', fontWeight: 600 }}>
                    {plan.days}-day subscription
                  </span>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 17, color: dark ? '#f1f5f9' : '#1e1b4b' }}>
                    {plan.amount} {plan.currency}
                  </span>
                </div>
              )}

              {isPayer && !isLocked && (stage === 'idle' || stage === 'requesting' || stage === 'failed') && (
                <form onSubmit={handlePay} style={{ textAlign: 'left' }}>
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
                    background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff',
                    border: 'none', borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                    fontSize: 13.5, fontWeight: 700,
                    opacity: stage === 'requesting' ? 0.75 : 1,
                  }}>
                    {stage === 'requesting' ? (
                      <><Loader2 size={15} className="bp-spin" /> Sending request…</>
                    ) : (
                      <>Pay with MTN MoMo <ArrowRight size={14} /></>
                    )}
                  </button>
                </form>
              )}

              {isPayer && !isLocked && stage === 'awaiting' && (
                <div className="bp-pulse" style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '18px 12px',
                }}>
                  <Smartphone size={28} color="#f97316" />
                  <p style={{ fontSize: 13, fontWeight: 700, color: dark ? '#f1f5f9' : '#1e1b4b', margin: 0 }}>
                    Check your phone
                  </p>
                  <p style={{ fontSize: 12.5, color: dark ? '#94a3b8' : '#64748b', margin: 0, maxWidth: 300 }}>
                    Approve the MTN MoMo prompt sent to {phone}. This page will update automatically.
                  </p>
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
    </>
  );
}
