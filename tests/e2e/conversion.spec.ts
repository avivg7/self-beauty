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

  test('journey A: home → puppy → WhatsApp with the puppy name prefilled', async ({ page }) => {
    await page.goto(u('/he/'));
    await page.locator('main a[href$="/he/puppies/"]').first().click();
    await expect(page).toHaveURL(/\/he\/puppies\/$/);
    await page.locator('article .pcard__title a').first().click();
    await expect(page).toHaveURL(/\/he\/puppies\/[\w-]+\/$/);
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

  test('no e-commerce vocabulary anywhere on the puppies page', async ({ page }) => {
    await page.goto(u('/en/puppies/'));
    await expect(page.locator('main')).not.toContainText(/add to cart|buy now|checkout|sale/i);
  });
});
