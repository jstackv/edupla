import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, loading, title, message, confirmText = 'Confirm', variant = 'danger' }) {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm animate-scale-in rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDanger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              <AlertTriangle className={`w-5 h-5 ${isDanger ? 'text-red-600' : 'text-emerald-600'}`} />
            </div>
            <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          </div>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{message}</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center" disabled={loading}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading}
              className={`flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all text-white disabled:opacity-50 ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
