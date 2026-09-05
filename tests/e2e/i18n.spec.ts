import { test, expect } from '@playwright/test';
import { switchLanguage, LOCALES, u } from './helpers';

test.describe('multilingual', () => {
  test('switching language keeps the equivalent page and persists the choice', async ({ page }) => {
    await page.goto(u('/he/about/'));
    await switchLanguage(page, 'ru');
    await expect(page).toHaveURL(/\/ru\/about\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('h1')).toContainText('Маленький дом');
    await switchLanguage(page, 'en');
    await expect(page).toHaveURL(/\/en\/about\/$/);
    await expect(page.locator('h1')).toContainText('A small home');
    expect(await page.evaluate(() => localStorage.getItem('sb:lang'))).toBe('en');
    // The root gateway honours the persisted choice
    await page.goto(u('/'));
    await expect(page).toHaveURL(/\/en\/$/);
  });

  test('first visit lands on Hebrew', async ({ page }) => {
    await page.goto(u('/'));
    await expect(page).toHaveURL(/\/he\/$/);
  });

  for (const l of LOCALES) {
    test(`${l}: no untranslated UI strings leak from other locales`, async ({ page }) => {
      await page.goto(u(`/${l}/`));
      const nav = await page.locator('header nav, #menu-sheet nav').allInnerTexts();
      const text = nav.join(' ');
      if (l === 'he') expect(text).toMatch(/[֐-׿]/);
      if (l === 'ru') expect(text).toMatch(/[Ѐ-ӿ]/);
      if (l === 'en') {
        expect(text).not.toMatch(/[֐-׿]/);
        expect(text).not.toMatch(/[Ѐ-ӿ]/);
      }
      // hreflang alternates for all three locales + x-default
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(4);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${l}/$`));
      await expect(page.locator('meta[property="og:locale"]')).toHaveCount(1);
    });
  }

  test('Hebrew page keeps phone numbers LTR-isolated', async ({ page }) => {
    await page.goto(u('/he/contact/'));
    const dir = await page
      .locator('main .ccard__big a[href^="tel:"]')
      .first()
      .evaluate((el) => getComputedStyle(el.closest('.phone, .ltr') ?? el).direction);
    expect(dir).toBe('ltr');
  });
});
