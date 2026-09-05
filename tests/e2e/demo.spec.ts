import { test, expect } from '@playwright/test';
import { u, noHorizontalOverflow } from './helpers';

/**
 * Runs against the demo build (SB_INCLUDE_DEMO=1, served on its own port): ten listings covering every
 * status, so long Russian/Hebrew status strings, multi-card grids, breed filtering and card overflow are
 * verified in CI. Demo records never reach the production build (guarded in conversion.spec.ts).
 */
const WIDTHS = [320, 360, 390, 430, 768, 1440];
const LOCALES = ['he', 'ru', 'en'] as const;

for (const l of LOCALES) {
  for (const w of WIDTHS) {
    test(`${l} ${w}px: ten listings, every status chip small, no card clips`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w < 700 ? 800 : 900 });
      await page.goto(u(`/${l}/puppies/`));
      await noHorizontalOverflow(page);
      expect(await page.locator('.pcard').count()).toBeGreaterThanOrEqual(10);
      const clipped = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('.pcard')).filter((c) => c.scrollWidth > c.clientWidth + 1)
            .length,
      );
      expect(clipped, 'cards clipping content').toBe(0);
      const statuses = new Set<string>();
      const chips = page.locator('.pcard__chips .chip:not(.chip--demo)');
      for (let i = 0; i < (await chips.count()); i++) {
        const chip = chips.nth(i);
        const box = (await chip.boundingBox())!;
        const img = (await chip.locator('xpath=ancestor::a[contains(@class,"pcard__media")]').boundingBox())!;
        statuses.add((await chip.innerText()).trim());
        expect(box.height).toBeGreaterThan(18);
        expect(box.height).toBeLessThan(40);
        expect(box.width).toBeLessThan(Math.min(240, img.width * 0.7));
        expect(box.y - img.y).toBeLessThan(28);
        if (l === 'he') expect(img.x + img.width - (box.x + box.width)).toBeLessThan(28);
        else expect(box.x - img.x).toBeLessThan(28);
      }
      expect(statuses.size, 'distinct status labels rendered').toBeGreaterThanOrEqual(4);
    });
  }
  test(`${l}: breed filter leaves a lone card centred, not stranded in column one`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(u(`/${l}/puppies/`));
    await page.locator('[data-puppy-filters] input[value="pomeranian"]').check({ force: true });
    const visible = page.locator('[data-puppy-list] > li:not([hidden])');
    await expect(visible).toHaveCount(1);
    const list = (await page.locator('[data-puppy-list]').boundingBox())!;
    const card = (await visible.first().boundingBox())!;
    const left = card.x - list.x;
    const right = list.x + list.width - (card.x + card.width);
    expect(Math.abs(left - right), 'card centred').toBeLessThan(40);
    expect(card.width).toBeLessThan(420);
  });
}
