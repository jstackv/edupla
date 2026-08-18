import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal.jsx — shared modal shell.
 *
 * Optional props (fully backward-compatible — every existing call site
 * keeps working unchanged, it just picks up the nicer entrance and
 * click-outside-to-close):
 *   icon      — a lucide-react component rendered in a gradient badge
 *               next to the title, with a soft pulsing ring behind it.
 *   accent    — hex color driving the icon badge, the spinning border
 *               ring, the background orbs, and any `--qm-accent`-based
 *               styling inside the modal body (defaults to indigo).
 *   accent2   — second gradient stop (defaults to `accent`).
 *
 * Every consumer that passes the same accent/accent2 pair gets a
 * visually identical treatment — keep colors uniform across modals by
 * reusing the same two hex values everywhere rather than inventing a
 * new palette per modal.
 */
export default function Modal({ isOpen, onClose, title, children, size = 'md', icon: Icon, accent, accent2 }) {
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
  const accentColor = accent || '#6366f1';
  const accentColor2 = accent2 || accentColor;

  return (
    <div
      className="qm-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)', '--qm-accent': accentColor, '--qm-accent-2': accentColor2 }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="qm2-orb-field" aria-hidden="true">
        <span className="qm2-orb qm2-orb-1" />
        <span className="qm2-orb qm2-orb-2" />
      </div>

      <div className={`qm2-sheet-wrap w-full ${widths[size]}`}>
        <span className="qm2-sheet-ring" aria-hidden="true" />
        <div
          className="qm-sheet rounded-2xl overflow-hidden max-h-[92vh] flex flex-col"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
            '--qm-accent': accentColor,
            '--qm-accent-2': accentColor2,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--card-border)' }}>
            {Icon && (
              <div className="qm-header-icon">
                <span className="qm-header-icon-ring" aria-hidden="true" />
                <Icon className="w-[18px] h-[18px]" />
              </div>
            )}
            <h2 className="font-display font-bold text-base flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            <button onClick={onClose} className="qm-close p-1.5 rounded-xl flex-shrink-0">
              <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
          {/* Body */}
          <div className="overflow-y-auto px-5 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}