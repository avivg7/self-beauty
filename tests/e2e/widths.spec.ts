import { test, expect } from '@playwright/test';
import { noHorizontalOverflow, u } from './helpers';

const WIDTHS = [320, 360, 375, 390, 414, 430, 768, 1024, 1440];
const PAGES = [
  '/he/',
  '/he/puppies/',
  '/he/puppies/bichon-frise-2026/',
  '/he/shows/',
  '/he/gallery/',
  '/he/grooming/',
  '/ru/',
  '/ru/about/',
  '/en/contact/',
  '/en/stories/',
  '/he/litters/',
  '/he/accessibility/',
];
const SHOTS = process.env.SHOTS === '1';

for (const w of WIDTHS) {
  for (const p of PAGES) {
    test(`${w}px ${p} has no horizontal overflow${SHOTS ? ' (screenshot)' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w < 700 ? 800 : 900 });
      await page.goto(u(p));
      await page.evaluate(() =>
        document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')),
      );
      await noHorizontalOverflow(page);
      // Sticky bar must not overlap the page's last CTA on mobile
      if (w < 1024) {
        const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
        expect(pad).toBeGreaterThanOrEqual(56);
      }
      // Tap targets: every button/link in header & sticky bar ≥ 44px tall
      const small = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('header a, header button, [data-sticky-bar] a'))
            .filter((el) => (el as HTMLElement).offsetParent !== null)
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.height < 44 || r.width < 44).length,
      );
      expect(small, 'small tap targets in header/sticky bar').toBe(0);
      if (SHOTS)
        await page.screenshot({
          path: `test-results/shots/${w}${p.replace(/\//g, '_')}.png`,
          fullPage: true,
        });
    });
  }
}
