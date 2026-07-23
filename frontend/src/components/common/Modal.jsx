import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl', '2xl': 'max-w-5xl', full: 'max-w-[96vw]' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className={`w-full ${widths[size]} animate-scale-in rounded-2xl overflow-hidden max-h-[92vh] flex flex-col`}
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--card-border)' }}>
          <h2 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}