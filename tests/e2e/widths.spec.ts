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
      if (SHOTS) await page.emulateMedia({ reducedMotion: 'reduce' });
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
      if (SHOTS) {
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForLoadState('networkidle');
      }
      if (SHOTS)
        await page.screenshot({
          path: `artifacts/shots/${w}${p.replace(/\//g, '_')}.png`,
          fullPage: true,
        });
    });
  }
}

/**
 * Status chip geometry: a small content-sized pill pinned to the top inline-start corner of the card
 * image (top-right in Hebrew, top-left in Russian/English). It must never stretch or cover the puppy.
 */
const CHIP_WIDTHS = [320, 360, 390, 430, 768, 1440];
for (const l of ['he', 'ru', 'en'] as const) {
  for (const w of CHIP_WIDTHS) {
    test(`${l} ${w}px puppy status chip is a small corner pill`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w < 700 ? 800 : 900 });
      await page.goto(u(`/${l}/puppies/`));
      // Card bodies must never be wider than their card (translation overflow guard)
      const clipped = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('.pcard')).filter((c) => c.scrollWidth > c.clientWidth + 1)
            .length,
      );
      expect(clipped, 'cards clipping their content').toBe(0);
      const chips = page.locator('.pcard__chips .chip');
      expect(await chips.count()).toBeGreaterThan(0);
      const rtl = l === 'he';
      for (let i = 0; i < (await chips.count()); i++) {
        const chip = chips.nth(i);
        const box = (await chip.boundingBox())!;
        const img = (await chip.locator('xpath=ancestor::a[contains(@class,"pcard__media")]').boundingBox())!;
        expect(await chip.innerText(), 'chip has text').not.toBe('');
        expect(box.height, 'chip height').toBeGreaterThan(18);
        expect(box.height, 'chip height').toBeLessThan(40);
        expect(box.width, 'chip width').toBeLessThan(Math.min(240, img.width * 0.7));
        expect(box.y - img.y, 'chip near top edge').toBeLessThan(28);
        if (rtl) expect(img.x + img.width - (box.x + box.width), 'chip at right edge (RTL)').toBeLessThan(28);
        else expect(box.x - img.x, 'chip at left edge (LTR)').toBeLessThan(28);
        // covers at most a small fraction of the image
        expect((box.width * box.height) / (img.width * img.height), 'chip area share').toBeLessThan(0.08);
      }
    });
  }
}
