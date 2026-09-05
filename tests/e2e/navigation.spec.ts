import { test, expect } from '@playwright/test';
import { navTo, noHorizontalOverflow, u } from './helpers';

test.describe('site shell', () => {
  test('Hebrew home is RTL, has one h1, landmarks and a skip link', async ({ page }) => {
    await page.goto(u('/he/'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.locator('footer#footer')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
    await noHorizontalOverflow(page);
  });

  test('navigates from home to puppies, grooming, shows and contact', async ({ page }) => {
    await page.goto(u('/he/'));
    await navTo(page, '/he/puppies/');
    await expect(page).toHaveURL(/\/he\/puppies\/$/);
    await expect(page.locator('h1')).toContainText('גורים');
    await navTo(page, '/he/grooming/');
    await expect(page).toHaveURL(/\/he\/grooming\/$/);
    await navTo(page, '/he/shows/');
    await expect(page).toHaveURL(/\/he\/shows\/$/);
    await navTo(page, '/he/contact/');
    await expect(page).toHaveURL(/\/he\/contact\/$/);
    await expect(
      page.locator('header nav a[aria-current="page"], #menu-sheet a[aria-current="page"]').first(),
    ).toHaveAttribute('href', /\/he\/contact\/$/);
  });

  test('mobile menu traps focus, closes with Escape and restores focus', async ({ page }) => {
    await page.goto(u('/he/'));
    const opener = page.locator('[data-menu-open]');
    test.skip(!(await opener.isVisible()), 'desktop layout has no menu sheet');
    await opener.click();
    await expect(page.locator('#menu-sheet')).toBeVisible();
    await expect(page.locator('[data-menu-close]')).toBeFocused();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-sheet')).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  });

  test('404 page renders for unknown routes in the built output', async ({ page }) => {
    const res = await page.goto(u('/he/does-not-exist/'));
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
