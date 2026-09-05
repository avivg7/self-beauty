import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LOCALES, PAGES, u } from './helpers';

for (const l of LOCALES) {
  for (const p of PAGES) {
    test(`axe: ${l}${p}`, async ({ page }) => {
      await page.goto(u(`/${l}${p}`));
      await page.evaluate(() =>
        document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')),
      );
      await page.waitForTimeout(500);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes[0]?.target}`),
        JSON.stringify(results.violations, null, 1),
      ).toEqual([]);
      // Everything else is reported but does not fail the build
      if (results.violations.length)
        console.warn(`[axe minor] ${l}${p}:`, results.violations.map((v) => v.id).join(', '));
    });
  }
}

test('accessibility panel changes text size and contrast and persists', async ({ page }) => {
  await page.goto(u('/he/'));
  await page.locator('[data-a11y-open]').first().click();
  const panel = page.locator('#a11y-panel');
  await expect(panel).toHaveAttribute('open', '');
  await panel.locator('input[name="text"][value="lg"]').check({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-text', 'lg');
  await panel.locator('input[name="contrast"]').check({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await panel.locator('input[name="motion"]').check({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.keyboard.press('Escape');
  await expect(panel).not.toHaveAttribute('open', '');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'lg');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  // Layout still sound with large text + high contrast
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(sw).toBeLessThanOrEqual(iw + 1);
  await page.locator('[data-a11y-open]').first().click();
  await panel.locator('[data-a11y-reset]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-text', /.+/);
});

test('keyboard: header controls are reachable and focus is visible', async ({ page }) => {
  await page.goto(u('/en/'));
  await page.keyboard.press('Tab'); // skip link
  await page.keyboard.press('Tab'); // brand
  await expect(page.locator('a.brand')).toBeFocused();
  const outline = await page.locator('a.brand').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});
