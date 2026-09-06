import { test, expect, type Page } from '@playwright/test';
import { u, noHorizontalOverflow } from './helpers';

/** Admin (/admin/) with Supabase mocked at the network layer. Proves the iPhone workflow renders end to end. */
const OWNER = '55555555-5555-4555-8555-555555555555';
const L1 = '66666666-6666-4666-8666-666666666666';
const NEW = '99999999-9999-4999-8999-999999999999';
const img = (id: string, position: number) => ({
  id,
  listing_id: L1,
  position,
  width: 640,
  height: 800,
  created_at: '2026-09-01T00:00:00Z',
});
const row = (images: ReturnType<typeof img>[], extra: Record<string, unknown> = {}) => ({
  id: L1,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-02T00:00:00Z',
  breed: 'yorkshire',
  sex: 'male',
  birth_date: null,
  status: 'available',
  published: false,
  featured: false,
  archived_at: null,
  sort_order: 100,
  name_he: 'יורקי קטן',
  name_ru: null,
  name_en: null,
  description_he: 'תיאור',
  description_ru: null,
  description_en: null,
  pedigree_he: null,
  pedigree_ru: null,
  pedigree_en: null,
  sire_name: null,
  dam_name: null,
  show_prospect: false,
  internal_note: null,
  listing_images: images,
  ...extra,
});
const session = () => ({
  access_token: 'mock-access',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh',
  user: {
    id: OWNER,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'owner@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-09-01T00:00:00Z',
  },
});

async function mock(
  page: Page,
  opts: { login: 'ok' | 'bad' | 'down'; listings?: unknown[]; imagesForNew?: number },
) {
  const rows = opts.listings ?? [row([img('77777777-7777-4777-8777-777777777777', 1)])];
  await page.route('https://supabase.mock.invalid/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (p.endsWith('/auth/v1/token')) {
      if (opts.login === 'down') return route.abort('connectionfailed');
      if (opts.login === 'bad')
        return route.fulfill({
          status: 400,
          json: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
        });
      return route.fulfill({ json: session() });
    }
    if (p.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
    if (p.endsWith('/rest/v1/rpc/is_admin')) return route.fulfill({ json: true });
    if (p.endsWith('/rest/v1/listings')) {
      if (req.method() === 'POST') {
        const body = req.postDataJSON() as Record<string, unknown>;
        const created = row([], { ...body, id: NEW });
        rows.push(created);
        return route.fulfill({ json: created });
      }
      const id = url.searchParams.get('id');
      if (id)
        return route.fulfill({
          json: rows.filter((r) => (r as { id: string }).id === id.replace('eq.', '')),
        });
      return route.fulfill({ json: rows });
    }
    if (p.includes('/storage/v1/object/sign/'))
      return route.fulfill({ json: { signedURL: '/object/sign/x?token=y' } });
    return route.fulfill({ status: 404, json: { message: `unmocked ${p}` } });
  });
}

test.describe('admin', () => {
  test('login page is Hebrew RTL, noindex, and reports bad credentials generically', async ({ page }) => {
    await mock(page, { login: 'bad' });
    await page.goto(u('/admin/'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveText('כניסה לניהול');
    await page.getByLabel('אימייל').fill('owner@example.com');
    await page.getByLabel('סיסמה', { exact: true }).fill('not-the-password-1');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.locator('[data-login-error]')).toHaveText('האימייל או הסיסמה שגויים.');
    await noHorizontalOverflow(page);
  });

  test('backend unreachable shows the "try later" message', async ({ page }) => {
    await mock(page, { login: 'down' });
    await page.goto(u('/admin/'));
    await page.getByLabel('אימייל').fill('owner@example.com');
    await page.getByLabel('סיסמה', { exact: true }).fill('correct-horse-battery');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.locator('[data-login-error]')).toHaveText('לא ניתן להתחבר כרגע. נסי שוב מאוחר יותר.');
  });

  test('owner workflow: list → add puppy → save → photos 0/3 → 3/3 disables adding', async ({ page }) => {
    await mock(page, { login: 'ok' });
    await page.goto(u('/admin/'));
    await page.getByLabel('אימייל').fill('owner@example.com');
    await page.getByLabel('סיסמה', { exact: true }).fill('correct-horse-battery');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.locator('h1')).toHaveText('גורים באתר');
    await expect(page.locator('[data-listing-row]')).toHaveCount(1);
    await expect(page.locator('[data-listing-row]').first()).toContainText('יורקי קטן');
    await expect(page.locator('[data-listing-row]').first()).toContainText('1/3');
    await noHorizontalOverflow(page);

    await page.locator('[data-add-listing]').click();
    await expect(page.locator('h1')).toHaveText('גור חדש');
    await page.getByLabel(/שם \(עברית\)/).fill('גורת פודל אפורה');
    await page.locator('[data-save]').click();
    await expect(page).toHaveURL(new RegExp(`#/edit/${NEW}$`));
    await expect(page.locator('h1')).toHaveText('עריכת גור');
    await expect(page.locator('[data-photo-manager] h2')).toHaveText('תמונות — 0/3');
    await expect(page.locator('[data-add-photo]')).toBeEnabled();
    await expect(page.locator('[data-publish]')).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test('a listing with three photos shows 3/3 and disables adding', async ({ page }) => {
    const three = row(
      [
        img('88888888-8888-4888-8888-888888888881', 1),
        img('88888888-8888-4888-8888-888888888882', 2),
        img('88888888-8888-4888-8888-888888888883', 3),
      ],
      { published: true },
    );
    await mock(page, { login: 'ok', listings: [three] });
    await page.goto(u('/admin/'));
    await page.getByLabel('אימייל').fill('owner@example.com');
    await page.getByLabel('סיסמה', { exact: true }).fill('correct-horse-battery');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await page.locator('[data-listing-row] a').first().click();
    await expect(page.locator('[data-photo-manager] h2')).toHaveText('תמונות — 3/3');
    await expect(page.locator('[data-add-photo]')).toBeDisabled();
    await expect(page.locator('[data-image-tile]')).toHaveCount(3);
    await expect(page.locator('[data-unpublish]')).toBeVisible();
    await page.getByRole('button', { name: 'שינוי סטטוס' }).click();
    await expect(page.locator('[data-status-sheet]')).toBeVisible();
    await expect(page.locator('[data-status-sheet]')).toContainText('הסרה מפרסום');
    await noHorizontalOverflow(page);
  });
});
