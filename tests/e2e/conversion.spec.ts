import { test, expect } from '@playwright/test';
import { isMobileNav, u } from './helpers';

const WA = /^https:\/\/wa\.me\/972546781020\?text=/;

test.describe('conversion paths', () => {
  test('phone and WhatsApp are one tap away on mobile via the sticky bar', async ({ page }) => {
    await page.goto(u('/he/'));
    const bar = page.locator('[data-sticky-bar]');
    if (await isMobileNav(page)) {
      await expect(bar).toBeVisible();
      await expect(bar.locator('a[href^="tel:"]')).toHaveAttribute('href', 'tel:+972546781020');
      await expect(bar.locator('a[href^="https://wa.me"]')).toHaveAttribute('href', WA);
      // The bar must not cover the page's own last CTA: body reserves space.
      const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
      expect(pad).toBeGreaterThanOrEqual(56);
    } else {
      await expect(bar).toBeHidden();
      await expect(page.locator('header .site-header__cta')).toBeVisible();
    }
  });

  test('journey A: home → puppies → puppy (or honest empty state) → WhatsApp', async ({ page }) => {
    // e2e builds point at a mock backend: answer "no listings" so the honest empty state is exercised.
    await page.route('https://supabase.mock.invalid/**', (route) => route.fulfill({ json: [] }));
    await page.goto(u('/he/'));
    await page.locator('main a[href$="/he/puppies/"]').first().click();
    await expect(page).toHaveURL(/\/he\/puppies\/$/);
    const island = page.locator('[data-live-puppies]');
    if (await island.count())
      await expect(island.locator('[data-live-skeleton]')).toBeHidden({ timeout: 15_000 });
    if ((await page.locator('article .pcard__title a').count()) === 0) {
      // No verified listing published: the page must say so and route to planned-litter updates
      await expect(page.locator('main .empty:visible')).toBeVisible();
      const cta = page.locator('main .empty:visible a[href^="https://wa.me"]');
      await expect(cta).toBeVisible();
      expect(decodeURIComponent((await cta.getAttribute('href'))!)).toContain('המלטות');
      await expect(page.locator('main')).not.toContainText(/₪|\$|מחיר:|price:/i);
      return;
    }
    await page.locator('article .pcard__title a').first().click();
    await expect(page).toHaveURL(/\/he\/puppies\/(?:[\w-]+\/|view\/\?id=[\w-]+)$/);
    const cta = page.locator('main a[href^="https://wa.me"]').first();
    await expect(cta).toContainText('דברו איתנו על הגור');
    const href = await cta.getAttribute('href');
    expect(href).toMatch(WA);
    expect(decodeURIComponent(href!)).toContain('בישון');
    await expect(page.locator('main')).not.toContainText(/₪|\$|מחיר:|price:/i);
  });

  test('journey B: grooming page books via WhatsApp or phone', async ({ page }) => {
    await page.goto(u('/ru/grooming/'));
    const wa = page.locator('main a[href^="https://wa.me"]').first();
    await expect(wa).toBeVisible();
    expect(decodeURIComponent((await wa.getAttribute('href'))!)).toContain('груминг');
    await expect(page.locator('main a[href="tel:+972546781020"]').first()).toBeVisible();
  });

  test('journey litters: prefilled opt-in message', async ({ page }) => {
    await page.goto(u('/en/litters/'));
    const wa = page.locator('main a[href^="https://wa.me"]').first();
    expect(decodeURIComponent((await wa.getAttribute('href'))!)).toContain('planned litters');
  });

  test('production build contains no demo listings', async ({ page }) => {
    for (const l of ['he', 'ru', 'en']) {
      await page.goto(u(`/${l}/puppies/`));
      await expect(page.locator('.chip--demo')).toHaveCount(0);
      await expect(page.locator('main')).not.toContainText(/DEMO|דמו —|ДЕМО/);
    }
  });

  test('no e-commerce vocabulary anywhere on the puppies page', async ({ page }) => {
    await page.goto(u('/en/puppies/'));
    await expect(page.locator('main')).not.toContainText(/add to cart|buy now|checkout|sale/i);
  });
});
