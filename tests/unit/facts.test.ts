import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { site } from '@/data/site';
import { he } from '@/i18n/he';
import { ru } from '@/i18n/ru';
import { en } from '@/i18n/en';

/**
 * Business-fact guards. Self Beauty was established in 2014; the owner's professional canine education
 * year is 2016. These are easy to mix up in copy, so every dictionary, the site facts and the docs are checked.
 */
const ROOT = process.cwd();
const dicts = { he, ru, en };

describe('establishment year is 2014 everywhere', () => {
  it('site facts', () => {
    expect(site.established).toBe(2014);
    expect(site.ownerEducationYear).toBe(2016);
  });
  it.each(Object.entries(dicts))('%s dictionary', (_l, d) => {
    const json = JSON.stringify(d);
    expect(d.meta.since).toContain('2014');
    expect(json).not.toMatch(/\b2017\b/);
    expect(json).not.toMatch(/\b2015\b/);
    // the education year must still be present (About and Home copy)
    expect(json).toMatch(/\b2016\b/);
    // timeline starts with the founding year
    expect(d.about.timeline[0]?.year).toBe('2014');
    expect(d.about.timeline.some((m) => m.year === '2016')).toBe(true);
  });
  it('content collections never claim another founding year', () => {
    for (const dir of ['puppies', 'litters', 'testimonials']) {
      for (const f of readdirSync(path.join(ROOT, 'src/content', dir))) {
        const txt = readFileSync(path.join(ROOT, 'src/content', dir, f), 'utf8');
        expect(txt, f).not.toMatch(/(since|מאז|с)\s+2017/);
      }
    }
  });
  it('docs and README do not describe 2017 as the founding year', () => {
    const files = [
      'README.md',
      ...readdirSync(path.join(ROOT, 'docs'))
        .filter((f) => f.endsWith('.md'))
        .map((f) => `docs/${f}`),
    ];
    for (const f of files) {
      const txt = readFileSync(path.join(ROOT, f), 'utf8');
      // Strict: no 2015/2017 anywhere in docs (the business history only uses 2014 and 2016)
      expect(txt, f).not.toMatch(/\\b(2015|2017)\\b/);
    }
  });
});
