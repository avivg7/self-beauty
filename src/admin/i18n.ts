import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { getDictionary, interpolate, type Dictionary, type Locale } from '@/i18n';

export interface AdminI18n {
  locale: Locale;
  dict: Dictionary;
  ui: Dictionary['admin']['ui'];
  fmt: (template: string, values?: Record<string, string | number>) => string;
}
export function makeI18n(locale: Locale): AdminI18n {
  const dict = getDictionary(locale);
  return { locale, dict, ui: dict.admin.ui, fmt: interpolate };
}
export const I18nContext = createContext<AdminI18n>(makeI18n('he'));
export const useT = () => useContext(I18nContext);

const KEY = 'sb-admin-locale';
export function loadLocale(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'he' || v === 'ru' || v === 'en') return v;
  } catch {
    /* storage unavailable */
  }
  return 'he';
}
export function storeLocale(l: Locale) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
}
