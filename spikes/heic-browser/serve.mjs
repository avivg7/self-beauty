// Serves the browser HEIC spike page on the LAN so it can be opened on a phone. No dependencies.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, '../..');
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/libheif-bundle.mjs': [path.join(ROOT, 'node_modules/libheif-js/libheif-wasm/libheif-bundle.mjs'), 'text/javascript'],
};
createServer((req, res) => {
  const f = files[req.url.split('?')[0]];
  if (!f) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': f[1] });
  res.end(readFileSync(path.isAbsolute(f[0]) ? f[0] : path.join(DIR, f[0])));
}).listen(4750, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('HEIC spike: http://localhost:4750/  ' + ips.map((ip) => `http://${ip}:4750/`).join('  '));
});
