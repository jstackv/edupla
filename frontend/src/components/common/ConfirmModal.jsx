import { useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  AlertTriangle, Trash2, CheckCircle, XCircle, Send,
  Save, X, ShieldAlert, Info,
} from 'lucide-react';

/**
 * Beautiful Confirmation Modal
 *
 * Props:
 *  open        – boolean
 *  onClose     – () => void
 *  onConfirm   – () => void
 *  loading     – boolean (shows spinner on confirm button)
 *  variant     – 'danger' | 'success' | 'warning' | 'info'   (default 'warning')
 *  title       – string
 *  message     – string | ReactNode
 *  confirmText – string  (default 'Confirm')
 *  cancelText  – string  (default 'Cancel')
 *  children    – optional extra content rendered between message and buttons (e.g. textarea)
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  variant = 'warning',
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  children,
}) {
  const { dark } = useTheme();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const variants = {
    danger: {
      icon: Trash2,
      iconBg: 'rgba(239,68,68,0.12)',
      iconColor: '#ef4444',
      btnBg: 'linear-gradient(135deg,#ef4444,#dc2626)',
      btnShadow: '0 4px 16px rgba(239,68,68,0.35)',
      accentBorder: '#ef444440',
    },
    success: {
      icon: CheckCircle,
      iconBg: 'rgba(16,185,129,0.12)',
      iconColor: '#10b981',
      btnBg: 'linear-gradient(135deg,#10b981,#059669)',
      btnShadow: '0 4px 16px rgba(16,185,129,0.35)',
      accentBorder: '#10b98140',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'rgba(245,158,11,0.12)',
      iconColor: '#f59e0b',
      btnBg: 'linear-gradient(135deg,#f59e0b,#d97706)',
      btnShadow: '0 4px 16px rgba(245,158,11,0.35)',
      accentBorder: '#f59e0b40',
    },
    info: {
      icon: Info,
      iconBg: 'rgba(99,102,241,0.12)',
      iconColor: '#6366f1',
      btnBg: 'linear-gradient(135deg,#6366f1,#4f46e5)',
      btnShadow: '0 4px 16px rgba(99,102,241,0.35)',
      accentBorder: '#6366f140',
    },
    reject: {
      icon: XCircle,
      iconBg: 'rgba(239,68,68,0.12)',
      iconColor: '#ef4444',
      btnBg: 'linear-gradient(135deg,#ef4444,#dc2626)',
      btnShadow: '0 4px 16px rgba(239,68,68,0.35)',
      accentBorder: '#ef444440',
    },
    submit: {
      icon: Send,
      iconBg: 'rgba(16,185,129,0.12)',
      iconColor: '#10b981',
      btnBg: 'linear-gradient(135deg,#10b981,#059669)',
      btnShadow: '0 4px 16px rgba(16,185,129,0.35)',
      accentBorder: '#10b98140',
    },
    save: {
      icon: Save,
      iconBg: 'rgba(99,102,241,0.12)',
      iconColor: '#6366f1',
      btnBg: 'linear-gradient(135deg,#6366f1,#4f46e5)',
      btnShadow: '0 4px 16px rgba(99,102,241,0.35)',
      accentBorder: '#6366f140',
    },
  };

  const v = variants[variant] || variants.warning;
  const IconComp = v.icon;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'cmFadeIn 0.18s ease',
      }}
    >
      <style>{`
        @keyframes cmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmSlideUp { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .cm-confirm-btn:hover { opacity: 0.88 !important; transform: translateY(-1px); }
        .cm-cancel-btn:hover { background: ${dark ? '#22283a' : '#f1f5f9'} !important; }
        .cm-confirm-btn, .cm-cancel-btn { transition: all 0.15s ease; }
      `}</style>

      <div style={{
        width: 440, maxWidth: '100%',
        borderRadius: 22,
        background: dark ? '#13161f' : '#ffffff',
        border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`,
        boxShadow: dark
          ? '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
          : '0 32px 80px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        animation: 'cmSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Coloured accent strip at top */}
        <div style={{
          height: 4,
          background: v.btnBg,
        }} />

        <div style={{ padding: '26px 28px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 14,
                background: v.iconBg,
                border: `1px solid ${v.accentBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <IconComp size={22} color={v.iconColor} />
              </div>
              <div>
                <h3 style={{
                  margin: 0, fontSize: 16, fontWeight: 800,
                  color: dark ? '#f1f5f9' : '#111827',
                  fontFamily: "'Sora', sans-serif",
                  letterSpacing: '-0.01em',
                }}>{title}</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: dark ? '#1e2130' : '#f3f4f6',
                borderRadius: 9, width: 32, height: 32,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: dark ? '#7b839a' : '#6b7280',
                flexShrink: 0, marginLeft: 8,
                transition: 'all 0.15s',
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Message */}
          {message && (
            <p style={{
              margin: '0 0 16px',
              fontSize: 13, lineHeight: 1.6,
              color: dark ? '#94a3b8' : '#4b5563',
            }}>{message}</p>
          )}

          {/* Extra content slot (e.g. textarea for reject reason) */}
          {children && (
            <div style={{ marginBottom: 16 }}>
              {children}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: dark ? '#1e2130' : '#f1f5f9', margin: '4px 0 18px' }} />

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="cm-cancel-btn"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1, padding: '11px 16px',
                borderRadius: 11,
                border: `1px solid ${dark ? '#2a3042' : '#e5e7eb'}`,
                background: dark ? '#1a1f2e' : '#f9fafb',
                color: dark ? '#94a3b8' : '#6b7280',
                fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >{cancelText}</button>

            <button
              className="cm-confirm-btn"
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex: 2, padding: '11px 16px',
                borderRadius: 11, border: 'none',
                background: v.btnBg,
                color: '#fff',
                fontSize: 13, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: v.btnShadow,
                opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    animation: 'cmSpin 0.7s linear infinite',
                    display: 'inline-block',
                  }} />
                  <style>{`@keyframes cmSpin { to { transform: rotate(360deg); } }`}</style>
                  Processing…
                </>
              ) : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
