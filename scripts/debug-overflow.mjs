#!/usr/bin/env node
/** Lists elements that extend beyond the viewport. Usage: node scripts/debug-overflow.mjs <width> <path> [port] */
import { chromium } from '@playwright/test';
const [w, p, port = '4321'] = process.argv.slice(2);
const BASE = (process.env.BASE ?? '/self-beauty').replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: 900 } });
await page.goto(`http://localhost:${port}${BASE}${p}`);
await page.evaluate(() =>
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')),
);
const out = await page.evaluate(() => {
  const iw = window.innerWidth;
  const rows = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > iw + 1 || r.left < -1)) {
      const cs = getComputedStyle(el);
      rows.push(
        `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')} left=${Math.round(r.left)} right=${Math.round(r.right)} w=${Math.round(r.width)} ws=${cs.whiteSpace} pos=${cs.position}`,
      );
    }
  }
  return { sw: document.documentElement.scrollWidth, iw, rows: rows.slice(0, 25) };
});
console.log(`${w}px ${p}: scrollWidth=${out.sw} innerWidth=${out.iw}`);
out.rows.forEach((r) => console.log('  ' + r));
await browser.close();
