import { site } from '@/data/site';
import { getDictionary, interpolate, type Locale } from '@/i18n';

export type WaIntent = 'general' | 'puppy' | 'litters' | 'grooming' | 'story';

/**
 * Builds a wa.me deep link with a localized, prefilled message.
 * The number is the business number in international format without "+".
 */
export function whatsappLink(
  locale: Locale,
  intent: WaIntent = 'general',
  values: Record<string, string> = {},
): string {
  const dict = getDictionary(locale);
  const text = interpolate(dict.wa[intent], values);
  return `${site.whatsapp.base}?text=${encodeURIComponent(text)}`;
}

export const telLink = site.phone.tel;
export const phoneDisplay = site.phone.display;
export const phoneInternational = site.phone.international;
export const facebookUrl = site.facebook;
