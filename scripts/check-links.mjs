#!/usr/bin/env node
/**
 * Verifies every internal link and asset reference in dist/ resolves to a built file.
 * Covers href, src, srcset, poster, <link rel=alternate/canonical> and og:image (same-origin only).
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const BASE = (process.env.BASE ?? '/self-beauty').replace(/\/$/, '');
const SITE = process.env.SITE ?? 'https://avivg7.github.io';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const exists = async (p) => {
  try {
    const s = await stat(p);
    return s.isFile() || s.isDirectory();
  } catch {
    return false;
  }
};

function candidates(url, fromFile) {
  let u = url.split('#')[0].split('?')[0];
  if (!u) return null;
  if (u.startsWith(SITE)) u = u.slice(SITE.length);
  if (
    /^(https?:)?\/\//.test(u) ||
    u.startsWith('mailto:') ||
    u.startsWith('tel:') ||
    u.startsWith('data:') ||
    u.startsWith('javascript:')
  )
    return null;
  let fsPath;
  if (u.startsWith('/')) {
    if (BASE && !u.startsWith(BASE + '/') && u !== BASE) return { error: `missing base prefix: ${u}` };
    fsPath = path.join(DIST, u.slice(BASE.length));
  } else {
    fsPath = path.resolve(path.dirname(fromFile), u);
  }
  const list = [fsPath];
  if (fsPath.endsWith('/')) list.push(path.join(fsPath, 'index.html'));
  else list.push(path.join(fsPath, 'index.html'), fsPath + '.html');
  return { list };
}

const files = await walk(DIST);
const problems = [];
let checked = 0;
const attrRe = /(?:href|src|poster|content)=["']([^"']+)["']/g;
const srcsetRe = /srcset=["']([^"']+)["']/g;
for (const f of files) {
  const html = await readFile(f, 'utf8');
  const urls = new Set();
  for (const m of html.matchAll(attrRe)) {
    let v = m[1];
    // <meta http-equiv="refresh" content="1; url=/x/"> → keep only the URL part
    const refresh = v.match(/url=(.+)$/i);
    if (refresh) v = refresh[1];
    if (/^(https?:)?\/\//.test(v) && !v.startsWith(SITE)) continue;
    if (
      !v.startsWith('/') &&
      !v.startsWith(SITE) &&
      !/\.(html|css|js|jpg|jpeg|png|webp|avif|svg|mp4|ico|xml|txt|webmanifest)$/i.test(v) &&
      !v.endsWith('/')
    )
      continue;
    urls.add(v);
  }
  for (const m of html.matchAll(srcsetRe))
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u) urls.add(u);
    }
  for (const u of urls) {
    const c = candidates(u, f);
    if (!c) continue;
    checked++;
    if (c.error) {
      problems.push(`${path.relative(DIST, f)}: ${c.error}`);
      continue;
    }
    let ok = false;
    for (const p of c.list)
      if (await exists(p)) {
        ok = true;
        break;
      }
    if (!ok) problems.push(`${path.relative(DIST, f)}: broken → ${u}`);
  }
}
// ---- Production content guards (fail the build, never silently ship) ----
const manifest = JSON.parse(await readFile(path.join(ROOT, 'scripts/media/manifest.json'), 'utf8'));
const reviewIds = [...manifest.images, ...manifest.videos]
  .filter((m) => m.status === 'needs_review' || m.status === 'excluded')
  .map((m) => m.id);
const demoMarker = /DEMO —|דמו —|ДЕМО —|chip--demo"|class="chip chip--demo/;
for (const f of files) {
  const html = await readFile(f, 'utf8');
  for (const id of reviewIds)
    if (html.includes(`/${id}.`) || html.includes(`${id}-`))
      problems.push(`${path.relative(DIST, f)}: references needs_review/excluded media "${id}"`);
  if (demoMarker.test(html))
    problems.push(`${path.relative(DIST, f)}: demo listing content in production HTML`);
  if (/\/puppies\/demo-/.test(html)) problems.push(`${path.relative(DIST, f)}: link to a demo listing page`);
}
for (const f of files)
  if (/\/puppies\/demo-/.test(f)) problems.push(`demo listing page built: ${path.relative(DIST, f)}`);
console.log(
  `[links] ${files.length} pages, ${checked} references checked; guards: ${reviewIds.length} needs_review ids, demo markers`,
);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('[links] OK');
