import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { SUPPORTED_LOCALES, translations, errorMessages } from './locales/index.js';

const STORAGE_KEY = 'songngu.uiLocale';
const DEFAULT_LOCALE = 'vi';

const VALID_CODES = new Set(SUPPORTED_LOCALES.map(item => item.code));

function getSavedLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID_CODES.has(saved)) {
      return saved;
    }
  } catch {}
  return DEFAULT_LOCALE;
}

function saveLocale(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {}
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getSavedLocale);

  const setLocale = useCallback(nextLocale => {
    if (VALID_CODES.has(nextLocale)) {
      setLocaleState(nextLocale);
      saveLocale(nextLocale);
    }
  }, []);

  const localeConfig = useMemo(() => {
    return SUPPORTED_LOCALES.find(item => item.code === locale) || SUPPORTED_LOCALES[0];
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = localeConfig.htmlLang;
  }, [localeConfig]);

  const t = useCallback((key, params) => {
    const dict = translations[locale] || translations[DEFAULT_LOCALE];
    let template = dict?.[key] ?? translations[DEFAULT_LOCALE]?.[key] ?? key;
    if (typeof template === 'string' && params && typeof params === 'object') {
      template = template.replace(/\{(\w+)\}/g, (match, paramName) => {
        return params[paramName] !== undefined ? String(params[paramName]) : match;
      });
    }
    return template;
  }, [locale]);

  const localizeError = useCallback(error => {
    if (!error) return '';
    const message = typeof error === 'string' ? error : error.message || error.detail || String(error);
    const mapped = errorMessages[message];
    if (mapped) {
      if (mapped[locale]) return mapped[locale];
      if (locale === 'vi' && typeof mapped === 'object') return message;
      if (mapped.en) return mapped.en;
    }
    return message;
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
    formatLocale: localeConfig.formatLocale,
    localizeError,
    locales: SUPPORTED_LOCALES,
  }), [locale, setLocale, t, localeConfig, localizeError]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}

export function LanguageSelector({ className = '' }) {
  const { locale, setLocale, t, locales } = useI18n();

  return (
    <div className={`language-selector ${className}`}>
      <Globe2 size={16} className="language-selector-icon" aria-hidden="true" />
      <select
        className="language-select"
        value={locale}
        onChange={event => setLocale(event.target.value)}
        aria-label={t('common.selectLanguage')}
        title={t('common.selectLanguage')}
      >
        {locales.map(item => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
