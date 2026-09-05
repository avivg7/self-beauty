import type { Locale } from '@/i18n/locales';

/** Astro's configured base, always with a trailing slash ("/self-beauty/" or "/"). */
export const BASE: string = (() => {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
})();

/** Join the base path with an absolute site path. href("/he/puppies/") → "/self-beauty/he/puppies/" */
export function href(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE}${clean}`;
}

/** Locale-aware page path (no base). Always trailing-slashed. */
export function pagePath(locale: Locale, rest = ''): string {
  const r = rest.replace(/^\/+|\/+$/g, '');
  return r ? `/${locale}/${r}/` : `/${locale}/`;
}

export function localeHref(locale: Locale, rest = ''): string {
  return href(pagePath(locale, rest));
}

/** Absolute URL for canonical / og:url / hreflang. */
export function absoluteUrl(site: URL | undefined, path: string): string {
  const origin = site ? site.origin : '';
  return `${origin}${href(path)}`;
}
