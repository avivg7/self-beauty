export const LOCALES = ['he', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'he';

export interface LocaleMeta {
  code: Locale;
  dir: 'rtl' | 'ltr';
  hreflang: string;
  /** Native name shown in the switcher */
  name: string;
  /** Short label for the compact switcher button */
  short: string;
  /** BCP-47 tag for Intl formatting */
  intl: string;
  ogLocale: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  he: {
    code: 'he',
    dir: 'rtl',
    hreflang: 'he-IL',
    name: 'עברית',
    short: 'עב',
    intl: 'he-IL',
    ogLocale: 'he_IL',
  },
  ru: {
    code: 'ru',
    dir: 'ltr',
    hreflang: 'ru',
    name: 'Русский',
    short: 'RU',
    intl: 'ru-RU',
    ogLocale: 'ru_RU',
  },
  en: {
    code: 'en',
    dir: 'ltr',
    hreflang: 'en',
    name: 'English',
    short: 'EN',
    intl: 'en-GB',
    ogLocale: 'en_GB',
  },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
