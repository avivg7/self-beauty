import { describe, expect, it } from 'vitest';
import { whatsappLink, telLink } from '@/lib/contact';
import { ageLabel } from '@/lib/age';
import { pagePath, href } from '@/lib/urls';

describe('contact links', () => {
  it('builds wa.me links with the business number and an encoded localized message', () => {
    const url = new URL(whatsappLink('he'));
    expect(url.hostname).toBe('wa.me');
    expect(url.pathname).toBe('/972546781020');
    expect(url.searchParams.get('text')).toContain('Self Beauty');
  });
  it('interpolates the puppy intent', () => {
    const url = new URL(whatsappLink('en', 'puppy', { name: 'Luna', breed: 'Poodle' }));
    expect(url.searchParams.get('text')).toBe(
      'Hi, I found Luna (Poodle) on the Self Beauty website and would like to hear more.',
    );
  });
  it('tel link is E.164', () => {
    expect(telLink).toBe('tel:+972546781020');
  });
});

describe('age', () => {
  const now = new Date('2026-09-05T00:00:00');
  it('weeks under 16 weeks', () => expect(ageLabel('en', '2026-07-01', now)).toBe('9 weeks'));
  it('months under a year', () => expect(ageLabel('en', '2026-01-10', now)).toBe('7 months'));
  it('one month singular', () => expect(ageLabel('en', '2026-05-01', now)).toBe('4 months'));
  it('years', () => expect(ageLabel('en', '2023-01-01', now)).toBe('3 years'));
  it('future dates are empty', () => expect(ageLabel('en', '2027-01-01', now)).toBe(''));
  it('localizes', () => expect(ageLabel('he', '2026-07-01', now)).toBe('9 שבועות'));
});

describe('urls', () => {
  it('page paths are locale-prefixed and trailing-slashed', () => {
    expect(pagePath('he')).toBe('/he/');
    expect(pagePath('ru', 'puppies')).toBe('/ru/puppies/');
    expect(pagePath('en', '/about/')).toBe('/en/about/');
  });
  it('href joins the base without double slashes', () => {
    expect(href('/he/')).toMatch(/^\/[^/].*\/he\/$|^\/he\/$/);
    expect(href('/he/')).not.toContain('//');
  });
});
