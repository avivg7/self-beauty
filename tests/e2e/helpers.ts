import { expect, type Page } from '@playwright/test';

export const BASE = (process.env.BASE ?? '/self-beauty').replace(/\/$/, '');
/** Base-aware URL: Playwright resolves absolute paths against the origin, dropping the Pages base path. */
export const u = (path: string) => `${BASE}${path}`;
export const LOCALES = ['he', 'ru', 'en'] as const;
export const PAGES = [
  '/',
  '/puppies/',
  '/litters/',
  '/grooming/',
  '/shows/',
  '/gallery/',
  '/about/',
  '/stories/',
  '/contact/',
  '/accessibility/',
] as const;

export async function isMobileNav(page: Page) {
  return page.locator('[data-menu-open]').isVisible();
}

/** Navigate via the header (desktop) or the menu sheet (mobile). */
export async function navTo(page: Page, hrefEndsWith: string) {
  if (await isMobileNav(page)) {
    await page.locator('[data-menu-open]').click();
    await expect(page.locator('#menu-sheet')).toBeVisible();
    await page.locator(`#menu-sheet a[href$="${hrefEndsWith}"]`).first().click();
  } else {
    await page.locator(`header nav a[href$="${hrefEndsWith}"]`).first().click();
  }
}

export async function switchLanguage(page: Page, locale: 'he' | 'ru' | 'en') {
  if (await isMobileNav(page)) {
    await page.locator('[data-menu-open]').click();
    await page.locator(`#menu-sheet [data-lang-choice="${locale}"]`).click();
  } else {
    await page.locator('header [data-lang-btn]').click();
    await page.locator(`header [data-lang-menu] [data-lang-choice="${locale}"]`).click();
  }
}

export async function noHorizontalOverflow(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(sw, `scrollWidth ${sw} > innerWidth ${iw}`).toBeLessThanOrEqual(iw + 1);
}
