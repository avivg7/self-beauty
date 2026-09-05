import { LOCALES } from '@/i18n/locales';
/** getStaticPaths helper: one page per locale. */
export function localePaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}
