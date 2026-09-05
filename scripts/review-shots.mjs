#!/usr/bin/env node
/**
 * Manual-review screenshots (not part of CI). Produces artifacts/review/*.png:
 *  1. production build: required pages/locales/widths, plus open menu / lightbox / a11y panel / language menu
 *  2. demo builds with SB_LISTING_LIMIT=1,2,3,6,10: puppies page layouts and every status chip variant
 * Usage: node scripts/review-shots.mjs [--skip-demo]
 */
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = path.join(ROOT, 'artifacts/review');
const BASE = '/self-beauty';
const SKIP_DEMO = process.argv.includes('--skip-demo');
const ONLY_DEMO = process.argv.includes('--only-demo');
const problems = [];
await mkdir(OUT, { recursive: true });

const run = (cmd, args, env = {}) =>
  new Promise((res, rej) => {
    const p = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (c) =>
      c === 0 ? res(out) : rej(new Error(`${cmd} ${args.join(' ')} failed:\n${out.slice(-1500)}`)),
    );
  });
function serve(dist, port) {
  const p = spawn(process.execPath, [path.join(ROOT, 'scripts/serve-dist.mjs'), String(port)], {
    env: { ...process.env, DIST: dist },
    stdio: 'ignore',
  });
  return { stop: () => p.kill() };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error(`server not ready: ${url}`);
}

async function shot(page, url, file, { width, height = width < 700 ? 800 : 900, full = true, before } = {}) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
  if (before) await before(page);
  // Overflow guard: any element wider than the viewport, or any card clipping its own content
  const issues = await page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    document.querySelectorAll('.pcard').forEach((c, i) => {
      if (c.scrollWidth > c.clientWidth + 1)
        out.push(`card ${i} clips content (${c.scrollWidth} > ${c.clientWidth})`);
    });
    return out;
  });
  for (const i of issues) problems.push(`${file}: ${i}`);
  await page.screenshot({ path: path.join(OUT, file), fullPage: full });
  console.log('[shot]', file);
}

const browser = await chromium.launch();
const page = await browser.newPage();

// ---------- 1. production build ----------
if (!ONLY_DEMO) {
  const srv = serve(path.join(ROOT, 'dist'), 4610);
  const u = (p) => `http://localhost:4610${BASE}${p}`;
  await waitFor(u('/he/'));
  // First published listing (if any) — never a hard-coded id
  await page.goto(u('/he/puppies/'));
  const detailHref = await page
    .locator('article .pcard__title a')
    .first()
    .getAttribute('href')
    .catch(() => null);
  const detail = detailHref ? `http://localhost:4610${detailHref}` : null;
  await shot(page, u('/he/'), 'he-home-desktop.png', { width: 1440 });
  await shot(page, u('/he/'), 'he-home-mobile.png', { width: 390 });
  await shot(page, u('/he/puppies/'), 'he-puppies-desktop.png', { width: 1440 });
  await shot(page, u('/he/puppies/'), 'he-puppies-mobile.png', { width: 390 });
  if (detail) await shot(page, detail, 'he-puppy-detail-mobile.png', { width: 390 });
  await shot(page, u('/ru/'), 'ru-home-mobile.png', { width: 390 });
  await shot(page, u('/ru/puppies/'), 'ru-puppies-mobile.png', { width: 390 });
  await shot(page, u('/en/'), 'en-home-mobile.png', { width: 390 });
  await shot(page, u('/en/puppies/'), 'en-puppies-mobile.png', { width: 390 });
  // RTL component states (viewport-only shots)
  await shot(page, u('/he/'), 'he-menu-open-mobile.png', {
    width: 390,
    full: false,
    before: async (p) => {
      await p.locator('[data-menu-open]').click();
      await sleep(300);
    },
  });
  await shot(page, u('/he/shows/'), 'he-lightbox-mobile.png', {
    width: 390,
    full: false,
    before: async (p) => {
      await p.locator('[data-lb-item]').nth(1).click();
      await sleep(500);
    },
  });
  await shot(page, u('/he/'), 'he-a11y-panel-desktop.png', {
    width: 1440,
    full: false,
    before: async (p) => {
      await p.locator('[data-a11y-open]').first().click();
      await sleep(300);
    },
  });
  await shot(page, u('/he/'), 'he-lang-menu-desktop.png', {
    width: 1440,
    full: false,
    before: async (p) => {
      await p.locator('header [data-lang-btn]').click();
      await sleep(200);
    },
  });
  if (detail) await shot(page, detail, 'he-puppy-detail-top-desktop.png', { width: 1440, full: false });
  await shot(page, u('/he/contact/'), 'he-contact-mobile.png', { width: 390 });
  await shot(page, u('/he/puppies/'), 'he-puppies-320.png', { width: 320 });
  await shot(page, u('/he/puppies/'), 'he-puppies-768.png', { width: 768 });
  srv.stop();
}

// ---------- 2. demo builds: listing counts and status variants ----------
if (!SKIP_DEMO) {
  for (const limit of [1, 2, 3, 6, 10]) {
    const dist = path.join(ROOT, `.demo-dist/limit-${limit}`);
    await rm(dist, { recursive: true, force: true });
    console.log(`[build] demo, SB_LISTING_LIMIT=${limit}`);
    await run('npx', ['astro', 'build', '--outDir', dist], {
      SB_INCLUDE_DEMO: '1',
      SB_LISTING_LIMIT: String(limit),
    });
    const srv = serve(dist, 4611);
    const u = (p) => `http://localhost:4611${BASE}${p}`;
    await waitFor(u('/he/puppies/'));
    for (const l of ['he', 'ru', 'en']) {
      await shot(page, u(`/${l}/puppies/`), `demo-${limit}-${l}-puppies-1440.png`, { width: 1440 });
      await shot(page, u(`/${l}/puppies/`), `demo-${limit}-${l}-puppies-390.png`, { width: 390 });
    }
    if (limit === 10) {
      await shot(page, u('/he/puppies/'), 'demo-10-he-puppies-768.png', { width: 768 });
      await shot(page, u('/en/puppies/'), 'demo-10-en-puppies-1440.png', { width: 1440 });
    }
    if (limit === 6) {
      await shot(page, u('/he/puppies/'), 'demo-6-he-puppies-360.png', { width: 360 });
      await shot(page, u('/ru/puppies/'), 'demo-6-ru-puppies-430.png', { width: 430 });
      await shot(page, u('/en/puppies/'), 'demo-6-en-puppies-768.png', { width: 768 });
      await shot(page, u('/he/'), 'demo-6-he-home-1440.png', { width: 1440 });
    }
    srv.stop();
  }
}
await browser.close();
if (problems.length) {
  console.error('[review] PROBLEMS:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('[done]', OUT);
