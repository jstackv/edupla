import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES, setAppLanguage } from '../../i18n';

/**
 * Compact globe-icon dropdown for the topbar. Pass `dark` to match the
 * surrounding theme. Matches the visual language of TopbarIconBtn.
 */
export function LanguageSwitcher({ dark }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        title={t('layout.changeLanguage')}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
          background: (hovered || open) ? (dark ? '#1d2235' : '#f3f4f6') : (dark ? '#181c27' : '#f9fafb'),
          border: `1px solid ${(hovered || open) ? '#6366f1' : (dark ? '#1e2130' : '#e5e7eb')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <Globe size={14} color={dark ? '#7b839a' : '#6b7280'} />
      </div>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 190, borderRadius: 14,
          background: dark ? '#141720' : '#ffffff',
          border: `1px solid ${dark ? '#1e2535' : '#e5e7eb'}`,
          boxShadow: dark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.12)',
          zIndex: 1000, overflow: 'hidden', padding: 6,
        }}>
          {SUPPORTED_LANGUAGES.map(lang => {
            const active = lang.code === current.code;
            return (
              <button
                key={lang.code}
                onClick={() => { setAppLanguage(lang.code); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, padding: '8px 10px', borderRadius: 9, border: 'none',
                  background: active ? (dark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)') : 'transparent',
                  color: active ? '#6366f1' : (dark ? '#e2e8f0' : '#111827'),
                  fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = dark ? '#1d2235' : '#f8faff'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{lang.label}</span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
