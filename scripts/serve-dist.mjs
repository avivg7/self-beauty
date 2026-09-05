#!/usr/bin/env node
/**
 * Minimal static server for dist/ that behaves like GitHub Pages:
 *  - serves under the BASE path (/self-beauty), 404 outside it
 *  - directory requests resolve to index.html; missing trailing slash redirects (301)
 *  - unknown paths return dist/404.html with a real 404 status
 *  - gzip for text assets when the client accepts it (GitHub Pages compresses too)
 * Used by Playwright (webServer) and handy for manual checks:
 *   node scripts/serve-dist.mjs [port]        (DIST=<dir> to serve another build directory)
 */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = process.env.DIST ? path.resolve(process.env.DIST) : path.join(ROOT, 'dist');
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
const COMPRESSIBLE = new Set([
  '.html',
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.webmanifest',
  '.xml',
  '.txt',
  '.svg',
]);

const stat = (p) => {
  try {
    return statSync(p);
  } catch {
    return null;
  }
};

function send(req, res, file, status = 200) {
  const s = stat(file);
  if (!s || !s.isFile()) return notFound(req, res);
  const ext = path.extname(file).toLowerCase();
  const wantsGzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] ?? ''));
  const gz = COMPRESSIBLE.has(ext) && wantsGzip;
  const headers = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
    Vary: 'Accept-Encoding',
  };
  if (gz) headers['Content-Encoding'] = 'gzip';
  else headers['Content-Length'] = s.size;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file);
  if (gz) stream.pipe(createGzip({ level: 6 })).pipe(res);
  else stream.pipe(res);
}

function notFound(req, res) {
  const f = path.join(DIST, '404.html');
  if (stat(f)) return send(req, res, f, 404);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (BASE) {
    if (p === BASE) {
      res.writeHead(301, { Location: `${BASE}/${url.search}` });
      return res.end();
    }
    if (!p.startsWith(`${BASE}/`)) return notFound(req, res);
    p = p.slice(BASE.length);
  }
  const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, '');
  const fsPath = path.join(DIST, safe);
  if (!fsPath.startsWith(DIST)) return notFound(req, res);
  const s = stat(fsPath);
  if (s?.isDirectory()) {
    if (!p.endsWith('/')) {
      res.writeHead(301, { Location: `${BASE}${p}/${url.search}` });
      return res.end();
    }
    return send(req, res, path.join(fsPath, 'index.html'));
  }
  if (s?.isFile()) return send(req, res, fsPath);
  return notFound(req, res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[serve] http://localhost:${PORT}${BASE}/ ← ${path.relative(ROOT, DIST) || 'dist'}/`);
});
