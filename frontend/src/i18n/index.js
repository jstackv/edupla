import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import rw from './locales/rw.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
];

function getInitialLanguage() {
  try {
    const stored = localStorage.getItem('edupla_language');
    if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) return stored;
  } catch {}
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      rw: { translation: rw },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });

export function setAppLanguage(code) {
  if (!SUPPORTED_LANGUAGES.some(l => l.code === code)) return;
  i18n.changeLanguage(code);
  try { localStorage.setItem('edupla_language', code); } catch {}
  try { document.documentElement.setAttribute('lang', code); } catch {}
}

// Keep <html lang="..."> in sync from the start.
try { document.documentElement.setAttribute('lang', i18n.language); } catch {}

export default i18n;
