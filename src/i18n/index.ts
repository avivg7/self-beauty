import { he } from './he';
import { ru } from './ru';
import { en } from './en';
import type { Dictionary } from './types';
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, isLocale, type Locale } from './locales';

export { DEFAULT_LOCALE, LOCALES, LOCALE_META, isLocale };
export type { Locale, Dictionary };

const dictionaries: Record<Locale, Dictionary> = { he, ru, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Simple, safe interpolation: "{name}" → values.name. Unknown keys are left as-is. */
export function interpolate(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m));
}

export type LocalizedOptional = { [K in Locale]?: string | undefined };
export function localizedField(field: LocalizedOptional | undefined, locale: Locale): string {
  if (!field) return '';
  return field[locale] ?? field[DEFAULT_LOCALE] ?? field.en ?? field.ru ?? '';
}

/** Paths for every locale of the same page, for the switcher and hreflang. */
export function alternatesFor(path: string): Record<Locale, string> {
  const rest = stripLocale(path);
  return Object.fromEntries(LOCALES.map((l) => [l, `/${l}${rest}`])) as Record<Locale, string>;
}

/** "/he/puppies/" → "/puppies/"; "/he/" → "/" */
export function stripLocale(path: string): string {
  const m = path.match(/^\/(he|ru|en)(\/.*)?$/);
  if (!m) return path.startsWith('/') ? path : `/${path}`;
  return m[2] && m[2].length ? m[2] : '/';
}

export function localeFromPath(path: string): Locale {
  const m = path.match(/^\/(he|ru|en)(\/|$)/);
  return m && isLocale(m[1]) ? m[1] : DEFAULT_LOCALE;
}

export const formatters = {
  date(locale: Locale, iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return new Intl.DateTimeFormat(LOCALE_META[locale].intl, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  },
  monthYear(locale: Locale, iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return new Intl.DateTimeFormat(LOCALE_META[locale].intl, { year: 'numeric', month: 'long' }).format(d);
  },
};
