#!/usr/bin/env node
/**
 * Minimal static server for dist/ that behaves like GitHub Pages:
 *  - serves under the BASE path (/self-beauty), 404 outside it
 *  - directory requests resolve to index.html; missing trailing slash redirects (301)
 *  - unknown paths return dist/404.html with a real 404 status
 * Used by Playwright (webServer) and handy for manual checks: node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const BASE = (process.env.BASE ?? '/self-beauty').replace(/\/$/, '');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4321);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const stat = (p) => {
  try {
    return statSync(p);
  } catch {
    return null;
  }
};

function send(res, file, status = 200) {
  const s = stat(file);
  if (!s || !s.isFile()) return notFound(res);
  res.writeHead(status, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': s.size,
    'Cache-Control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}
function notFound(res) {
  const f = path.join(DIST, '404.html');
  const s = stat(f);
  if (s) {
    res.writeHead(404, { 'Content-Type': MIME['.html'] });
    createReadStream(f).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (BASE) {
    if (p === BASE) {
      res.writeHead(301, { Location: BASE + '/' + url.search });
      return res.end();
    }
    if (!p.startsWith(BASE + '/')) return notFound(res);
    p = p.slice(BASE.length);
  }
  const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
  const fsPath = path.join(DIST, safe);
  if (!fsPath.startsWith(DIST)) return notFound(res);
  const s = stat(fsPath);
  if (s?.isDirectory()) {
    if (!p.endsWith('/')) {
      res.writeHead(301, { Location: BASE + p + '/' + url.search });
      return res.end();
    }
    return send(res, path.join(fsPath, 'index.html'));
  }
  if (s?.isFile()) return send(res, fsPath);
  return notFound(res);
}).listen(PORT, '127.0.0.1', () => console.log(`[serve] http://localhost:${PORT}${BASE}/ ← dist/`));
