import { describe, expect, it } from 'vitest';
import { he } from '@/i18n/he';
import { ru } from '@/i18n/ru';
import { en } from '@/i18n/en';
import { interpolate, stripLocale, alternatesFor, localeFromPath } from '@/i18n';

type Node = string | Node[] | { [k: string]: Node };
function paths(obj: Node, prefix = ''): string[] {
  if (typeof obj === 'string') return [prefix];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
  return Object.entries(obj).flatMap(([k, v]) => paths(v as Node, prefix ? `${prefix}.${k}` : k));
}
function get(obj: Node, p: string): string {
  const parts = p.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur: unknown = obj;
  for (const part of parts) cur = (cur as Record<string, unknown>)[part];
  return cur as string;
}
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('dictionaries', () => {
  const heKeys = paths(he as unknown as Node);
  it.each([
    ['ru', ru],
    ['en', en],
  ] as const)('%s has every Hebrew key and no extras', (_name, dict) => {
    const keys = paths(dict as unknown as Node);
    expect(keys).toEqual(heKeys);
  });
  it.each([
    ['he', he],
    ['ru', ru],
    ['en', en],
  ] as const)('%s has no empty strings', (_n, dict) => {
    for (const p of paths(dict as unknown as Node)) expect(get(dict as unknown as Node, p), p).not.toBe('');
  });
  it('placeholders match across locales', () => {
    for (const p of heKeys) {
      const h = placeholders(get(he as unknown as Node, p));
      expect(placeholders(get(ru as unknown as Node, p)), `ru ${p}`).toBe(h);
      expect(placeholders(get(en as unknown as Node, p)), `en ${p}`).toBe(h);
    }
  });
  it('WhatsApp prefilled messages name the business', () => {
    for (const d of [he, ru, en]) for (const v of Object.values(d.wa)) expect(v).toContain('Self Beauty');
  });
});

describe('helpers', () => {
  it('interpolates known keys only', () => {
    expect(interpolate('Hi {name} ({breed}) {x}', { name: 'A', breed: 'B' })).toBe('Hi A (B) {x}');
  });
  it('strips and detects locales', () => {
    expect(stripLocale('/he/puppies/')).toBe('/puppies/');
    expect(stripLocale('/ru/')).toBe('/');
    expect(stripLocale('/ru')).toBe('/');
    expect(localeFromPath('/en/about/')).toBe('en');
    expect(localeFromPath('/about/')).toBe('he');
    expect(alternatesFor('/he/shows/')).toEqual({ he: '/he/shows/', ru: '/ru/shows/', en: '/en/shows/' });
  });
});
