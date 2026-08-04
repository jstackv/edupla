import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES, setAppLanguage } from '../../i18n';

/**
 * A grid of language options, styled to slot into any of the three
 * Settings.jsx card variants (admin/teacher/student). Pass the card's own
 * accent color so it matches the surrounding section.
 */
export default function LanguageOptionsGrid({ dark, accentColor = '#6366f1' }) {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SUPPORTED_LANGUAGES.length}, 1fr)`, gap: 10 }}>
      {SUPPORTED_LANGUAGES.map(({ code, label }) => {
        const active = current === code;
        return (
          <div
            key={code}
            onClick={() => setAppLanguage(code)}
            style={{
              padding: '14px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
              border: `2px solid ${active ? accentColor : (dark ? '#1e2535' : '#e5e7eb')}`,
              background: active ? `${accentColor}10` : (dark ? '#0f1117' : '#f9fafb'),
              transition: 'all 0.15s', position: 'relative',
            }}
          >
            {active && (
              <div style={{
                position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%',
                background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={10} color="#fff" />
              </div>
            )}
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: active ? accentColor : (dark ? '#e2e8f0' : '#0f172a') }}>
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
