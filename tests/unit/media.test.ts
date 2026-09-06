import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { images, videos, media } from '@/data/media';

const ROOT = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'scripts/media/manifest.json'), 'utf8')) as {
  images: { id: string; set: string; src: string; format?: string; status?: string }[];
  videos: { id: string; set: string; status?: string; src?: string }[];
  excluded: { src: string; reason: string }[];
};

describe('media manifest ↔ committed derivatives ↔ catalogue', () => {
  it('every manifest image has a committed web master', () => {
    for (const m of manifest.images) {
      const f = path.join(ROOT, 'src/assets/media', m.set, `${m.id}.${m.format ?? 'jpg'}`);
      expect(existsSync(f), f).toBe(true);
    }
  });
  it('every catalogue image exists in the manifest and on disk', () => {
    const ids = new Set(manifest.images.map((m) => `${m.set}/${m.id}`));
    for (const im of images) {
      expect(ids.has(im.id), im.id).toBe(true);
      expect(
        existsSync(path.join(ROOT, 'src/assets/media', `${im.id}.jpg`)) ||
          existsSync(path.join(ROOT, 'src/assets/media', `${im.id}.png`)),
        im.id,
      ).toBe(true);
    }
  });
  it('every presented catalogue video has 720/480 tiers and posters', () => {
    for (const v of videos.filter((v) => !v.excluded)) {
      const base = v.id.split('/')[1];
      for (const suffix of ['-720.mp4', '-480.mp4', '-poster.jpg', '-poster.webp']) {
        expect(
          existsSync(path.join(ROOT, 'public/media/video', `${base}${suffix}`)),
          `${base}${suffix}`,
        ).toBe(true);
      }
    }
  });
  it('catalogue ids are unique and have all three alt texts', () => {
    const ids = media.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of media)
      for (const l of ['he', 'ru', 'en'] as const) expect(m.alt[l].length, `${m.id} ${l}`).toBeGreaterThan(8);
  });
  it('excluded sources are never referenced', () => {
    const srcs = new Set(manifest.images.map((m) => m.src));
    for (const ex of manifest.excluded) expect(srcs.has(ex.src), ex.src).toBe(false);
    expect(manifest.excluded.some((e) => e.src.includes('ChatGPT'))).toBe(true);
  });
  it('needs_review status in the manifest matches needsReview in the catalogue (production exclusion)', () => {
    const reviewIds = new Set(
      [...manifest.images, ...manifest.videos]
        .filter((m) => m.status === 'needs_review')
        .map((m) => `${m.set}/${m.id}`),
    );
    for (const m of media) expect(!!m.needsReview, m.id).toBe(reviewIds.has(m.id));
    expect(reviewIds.size, 'the two watermarked show photos').toBe(2);
  });
  it("'excluded' status in the manifest matches excluded in the catalogue (client withdrawal; source kept)", () => {
    const excludedIds = new Set(
      [...manifest.images, ...manifest.videos]
        .filter((m) => m.status === 'excluded')
        .map((m) => `${m.set}/${m.id}`),
    );
    for (const m of media) expect(!!m.excluded, m.id).toBe(excludedIds.has(m.id));
    for (const m of [...manifest.images, ...manifest.videos].filter((m) => m.status === 'excluded'))
      if (m.src) expect(existsSync(path.join(ROOT, m.src)), `${m.src} must stay in the vault`).toBe(true);
  });
  it('focal points are within bounds', () => {
    for (const im of images) {
      expect(im.focal.x).toBeGreaterThanOrEqual(0);
      expect(im.focal.x).toBeLessThanOrEqual(1);
      expect(im.focal.y).toBeGreaterThanOrEqual(0);
      expect(im.focal.y).toBeLessThanOrEqual(1);
    }
  });
});

describe('content honesty rules', () => {
  const dir = path.join(ROOT, 'src/content/puppies');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const ids = new Set(images.map((i) => i.id));
  it('listings carry at most 3 images and reference known media', () => {
    for (const f of files) {
      const d = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      expect(d.images.length, f).toBeLessThanOrEqual(3);
      expect(d.images.length, f).toBeGreaterThan(0);
      for (const im of d.images) expect(ids.has(im.media), `${f} ${im.media}`).toBe(true);
      expect(d).not.toHaveProperty('price');
    }
  });
  it('demo fixtures are demo:true, named DEMO, and nothing else looks like a demo', () => {
    for (const f of files) {
      const d = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      const looksDemo = ['he', 'ru', 'en'].some((l) => /demo|דמו|демо/i.test(String(d.name[l])));
      // filename ⇔ flag ⇔ visible label: a fixture can never silently become a real listing
      expect(d.demo === true, `${f}: demo- filename must carry demo:true`).toBe(f.startsWith('demo-'));
      expect(looksDemo, `${f}: DEMO label must match demo flag`).toBe(d.demo === true);
    }
  });
});
