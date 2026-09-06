import { test, expect, type Page } from '@playwright/test';
import { u, noHorizontalOverflow } from './helpers';

/**
 * Live puppy listings (Supabase RPC) with the network mocked. The e2e build points at
 * https://supabase.mock.invalid, so nothing here can reach a real project.
 */
const L1 = '11111111-1111-4111-8111-111111111111';
const I1 = '22222222-2222-4222-8222-222222222222';
const L2 = '33333333-3333-4333-8333-333333333333';
const I2 = '44444444-4444-4444-8444-444444444444';
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
  'base64',
);
const listing = (id: string, img: string, extra: Record<string, unknown> = {}) => ({
  id,
  breed: 'bichon',
  sex: 'female',
  birth_date: '2026-07-01',
  status: 'available',
  featured: true,
  sort_order: 100,
  updated_at: '2026-09-01T10:00:00Z',
  name: { he: 'גורת בישון לבנה', ru: null, en: 'White Bichon girl' },
  description: { he: 'תיאור בעברית בלבד.', ru: null, en: null },
  pedigree: { he: null, ru: null, en: null },
  sire_name: 'Sire',
  dam_name: 'Dam',
  show_prospect: true,
  images: [
    {
      position: 1,
      width: 640,
      height: 800,
      path_large: `listings/${id}/${img}-1600.jpg`,
      path_card: `listings/${id}/${img}-640.jpg`,
    },
  ],
  ...extra,
});
const ROWS = [
  listing(L1, I1),
  listing(L2, I2, { status: 'reserved', featured: false, name: { he: 'גור פודל', ru: 'Пудель', en: null } }),
];

async function mock(page: Page, mode: 'ok' | 'empty' | 'down') {
  await page.route('https://supabase.mock.invalid/**', async (route) => {
    const url = route.request().url();
    if (mode === 'down') return route.abort('connectionfailed');
    if (url.includes('/storage/v1/object/public/'))
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG });
    if (url.endsWith('/rpc/public_listings_json'))
      return route.fulfill({ json: mode === 'empty' ? [] : ROWS });
    if (url.endsWith('/rpc/public_listing_json')) {
      const body = route.request().postDataJSON() as { p_id: string };
      const row = mode === 'empty' ? null : (ROWS.find((r) => r.id === body.p_id) ?? null);
      return route.fulfill({ json: row });
    }
    return route.fulfill({ status: 404, json: { message: 'unmocked' } });
  });
}

test.describe('live listings', () => {
  test('renders live cards in the shared card design and links to the detail view', async ({ page }) => {
    await mock(page, 'ok');
    await page.goto(u('/he/puppies/'));
    const cards = page.locator('[data-live-list] .pcard');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('[data-live-skeleton]')).toBeHidden();
    await expect(cards.first().locator('.chip')).toHaveText('זמין');
    await expect(cards.nth(1).locator('.chip')).toHaveText('שמור');
    await expect(cards.first().locator('.pcard__title a')).toHaveAttribute(
      'href',
      new RegExp(`/he/puppies/view/\\?id=${L1}$`),
    );
    await expect(cards.first().locator('img')).toHaveAttribute('src', /listing-media-public\/listings\//);
    await expect(page.locator('main')).not.toContainText(/₪|מחיר:/);
    await noHorizontalOverflow(page);

    await cards.first().locator('.pcard__title a').click();
    await expect(page).toHaveURL(new RegExp(`/he/puppies/view/\\?id=${L1}$`));
    await expect(page.locator('[data-live-content] h1')).toHaveText('גורת בישון לבנה');
    await expect(page.locator('[data-live-content] .rosette')).toBeVisible();
    const wa = page.locator('[data-live-content] a[href^="https://wa.me"]');
    await expect(wa).toContainText('דברו איתנו על הגור');
    expect(decodeURIComponent((await wa.getAttribute('href'))!)).toContain('גורת בישון לבנה');
    await noHorizontalOverflow(page);
  });

  test('empty result shows the honest empty state with the litter-updates CTA', async ({ page }) => {
    await mock(page, 'empty');
    await page.goto(u('/he/puppies/'));
    await expect(page.locator('[data-live-empty]')).toBeVisible();
    await expect(page.locator('[data-live-empty] a[href^="https://wa.me"]')).toBeVisible();
    await expect(page.locator('[data-live-error]')).toBeHidden();
  });

  test('backend down shows the error state, never "no puppies"', async ({ page }) => {
    await mock(page, 'down');
    await page.goto(u('/he/puppies/'));
    await expect(page.locator('[data-live-error]')).toBeVisible();
    await expect(page.locator('[data-live-error] a[href^="https://wa.me"]')).toBeVisible();
    await expect(page.locator('[data-live-empty]')).toBeHidden();
    await expect(page.locator('main')).not.toContainText('כרגע אין גורים זמינים', { useInnerText: true });
  });

  test('unknown id on the detail view shows "not found"', async ({ page }) => {
    await mock(page, 'empty');
    await page.goto(u(`/he/puppies/view/?id=${L1}`));
    await expect(page.locator('[data-live-notfound]')).toBeVisible();
  });

  test('russian falls back to Hebrew text with an honest note', async ({ page }) => {
    await mock(page, 'ok');
    await page.goto(u('/ru/puppies/'));
    const first = page.locator('[data-live-list] .pcard').first();
    await expect(first.locator('.pcard__title')).toHaveText('גורת בישון לבנה');
    await expect(first.locator('.pcard__note')).toBeVisible();
    await expect(first.locator('.pcard__note')).toContainText('иврите');
  });

  test('home shows featured live puppies (max 3)', async ({ page }) => {
    await mock(page, 'ok');
    await page.goto(u('/he/'));
    await expect(page.locator('[data-live-list] .pcard')).toHaveCount(2);
  });
});
