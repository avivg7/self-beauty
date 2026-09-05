import { getDictionary, interpolate, type Locale } from '@/i18n';

/** Human age from an ISO birth date, relative to `now`. Returns '' when the date is in the future. */
export function ageLabel(locale: Locale, birthDate: string, now: Date = new Date()): string {
  const dict = getDictionary(locale);
  const born = new Date(birthDate + 'T00:00:00');
  const ms = now.getTime() - born.getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const days = Math.floor(ms / 86_400_000);
  if (days < 7 * 16) {
    const weeks = Math.max(1, Math.floor(days / 7));
    return interpolate(dict.common.weeksOld, { count: weeks });
  }
  const months = Math.floor(days / 30.4375);
  if (months < 12)
    return months === 1 ? dict.common.oneMonth : interpolate(dict.common.monthsOld, { count: months });
  const years = Math.floor(months / 12);
  return years === 1 ? dict.common.oneYear : interpolate(dict.common.yearsOld, { count: years });
}
