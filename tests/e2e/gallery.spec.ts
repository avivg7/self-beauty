import { test, expect } from '@playwright/test';
import { u } from './helpers';

test.describe('galleries and lightbox', () => {
  test('opens, navigates by keyboard (RTL-aware), closes and restores focus', async ({ page }) => {
    await page.goto(u('/he/shows/'));
    const first = page.locator('[data-lb-item]').first();
    await first.scrollIntoViewIfNeeded();
    await first.click();
    const lb = page.locator('#lightbox');
    await expect(lb).toHaveAttribute('open', '');
    await expect(lb.locator('img, video')).toHaveCount(1);
    await expect(lb.locator('[data-lb-counter]')).toContainText('1');
    await page.keyboard.press('ArrowLeft'); // forward in RTL
    await expect(lb.locator('[data-lb-counter]')).toContainText('2');
    await page.keyboard.press('ArrowRight');
    await expect(lb.locator('[data-lb-counter]')).toContainText('1');
    await page.keyboard.press('Escape');
    await expect(lb).not.toHaveAttribute('open', '');
    await expect(first).toBeFocused();
  });

  test('English lightbox uses ArrowRight to go forward', async ({ page }) => {
    await page.goto(u('/en/gallery/'));
    await page.locator('[data-lb-item]').first().click();
    const lb = page.locator('#lightbox');
    await page.keyboard.press('ArrowRight');
    await expect(lb.locator('[data-lb-counter]')).toContainText('2');
  });

  test('video tiles do not load media until opened, then play inside the lightbox', async ({ page }) => {
    await page.goto(u('/he/shows/'));
    expect(await page.locator('main video').count()).toBe(0);
    const tile = page.locator('[data-lb-type="video"]').first();
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    const video = page.locator('#lightbox video');
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute('controls', '');
    expect(await video.getAttribute('src')).toMatch(/\/media\/video\/.+-(480|720)\.mp4$/);
    await page.keyboard.press('Escape');
  });

  test('type filter narrows the grid and the lightbox group follows', async ({ page }) => {
    await page.goto(u('/en/shows/'));
    await page.locator('input[data-filter="type"][value="video"]').check({ force: true });
    const visible = page.locator('.gallery__item:not([hidden])');
    await expect(visible.first()).toBeVisible();
    const n = await visible.count();
    expect(n).toBeGreaterThan(0);
    expect(await page.locator('.gallery__item:not([hidden]) [data-lb-type="image"]').count()).toBe(0);
    await page.locator('.gallery__item:not([hidden]) [data-lb-item]').first().click();
    await expect(page.locator('#lightbox [data-lb-counter]')).toContainText(`of ${n}`);
  });

  test('all gallery images declare dimensions (no layout shift) and alt text', async ({ page }) => {
    await page.goto(u('/he/gallery/'));
    const imgs = page.locator('main img');
    const count = await imgs.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const img = imgs.nth(i);
      expect(await img.getAttribute('width'), `img ${i} width`).toBeTruthy();
      expect(await img.getAttribute('height'), `img ${i} height`).toBeTruthy();
      expect(await img.getAttribute('alt'), `img ${i} alt attr`).not.toBeNull();
    }
  });
});
