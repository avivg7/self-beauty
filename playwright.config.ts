import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build served by scripts/serve-dist.mjs, which mimics GitHub Pages
 * (base path, trailing slashes, real 404 status) so the site is exercised exactly as deployed.
 */
const BASE = process.env.BASE ?? '/self-beauty';
const PORT = 4321;
const DEMO_PORT = 4322;
/** Set E2E_BASE_URL=https://avivg7.github.io to run the production projects against the live site (no local servers). */
const LIVE = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    baseURL: LIVE ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: LIVE
    ? undefined
    : [
        {
          command: `node scripts/serve-dist.mjs ${PORT}`,
          url: `http://localhost:${PORT}${BASE}/he/`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          // Demo build (SB_INCLUDE_DEMO=1 → .demo-dist/ci): long status strings, ten-card grids and filters in CI
          command: `DIST=.demo-dist/ci node scripts/serve-dist.mjs ${DEMO_PORT}`,
          url: `http://localhost:${DEMO_PORT}${BASE}/he/puppies/`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
  projects: [
    {
      name: 'mobile-360',
      testIgnore: /(a11y|widths|demo)\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } },
    },
    {
      name: 'mobile-390',
      testIgnore: /(a11y|widths|demo)\.spec\.ts/,
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'tablet-768',
      testIgnore: /(a11y|widths|demo)\.spec\.ts/,
      use: {
        ...devices['iPad Mini'],
        defaultBrowserType: 'chromium',
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'desktop-1440',
      testIgnore: /(a11y|widths|demo)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'a11y', testMatch: /a11y\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'widths', testMatch: /widths\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'demo-listings',
      testMatch: /demo\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEMO_PORT}` },
    },
  ],
});
