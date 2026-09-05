#!/usr/bin/env node
/**
 * Brand assets: favicon (SVG + ICO + PNG), apple-touch-icon, web manifest, Open Graph image.
 * The favicon is a derived mark (the crown from the logo, simplified) — the full badge is illegible at 16px.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PUB = path.join(ROOT, 'public');
await mkdir(PUB, { recursive: true });

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#7B1B22"/>
  <path d="M14 42 L11 22 L22 30 L32 16 L42 30 L53 22 L50 42 Z" fill="#DDB877"/>
  <rect x="14" y="44" width="36" height="5" rx="1.5" fill="#DDB877"/>
</svg>`;
await writeFile(path.join(PUB, 'favicon.svg'), faviconSvg);

const png = (size) => sharp(Buffer.from(faviconSvg)).resize(size, size).png();
await png(180).toFile(path.join(PUB, 'apple-touch-icon.png'));
await png(192).toFile(path.join(PUB, 'icon-192.png'));
await png(512).toFile(path.join(PUB, 'icon-512.png'));
const png32 = await png(32).toBuffer();
const png16 = await png(16).toBuffer();

// Minimal ICO container holding PNG-encoded images (supported by all modern browsers).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const dirs = [],
    datas = [];
  for (const { size, buf } of images) {
    const d = Buffer.alloc(16);
    d.writeUInt8(size === 256 ? 0 : size, 0);
    d.writeUInt8(size === 256 ? 0 : size, 1);
    d.writeUInt8(0, 2);
    d.writeUInt8(0, 3);
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(buf.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += buf.length;
    dirs.push(d);
    datas.push(buf);
  }
  return Buffer.concat([header, ...dirs, ...datas]);
}
await writeFile(
  path.join(PUB, 'favicon.ico'),
  ico([
    { size: 16, buf: png16 },
    { size: 32, buf: png32 },
  ]),
);

await writeFile(
  path.join(PUB, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'Self Beauty',
      short_name: 'Self Beauty',
      start_url: './',
      display: 'browser',
      background_color: '#f8f4ec',
      theme_color: '#f8f4ec',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  ) + '\n',
);

// Open Graph: ivory ground, gold hairline frame, the official logo centred. Language-neutral by design.
const W = 1200,
  H = 630;
const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F8F4EC"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="#C9A46A" stroke-width="2" rx="6"/>
</svg>`);
const logo = await sharp(path.join(ROOT, 'src/assets/brand/logo-transparent.png'))
  .resize(520, 520, { fit: 'inside' })
  .png()
  .toBuffer();
await sharp(frame)
  .composite([{ input: logo, gravity: 'centre' }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(PUB, 'og.jpg'));
console.log(
  '[brand] wrote favicon.svg/.ico, apple-touch-icon.png, icon-192/512.png, site.webmanifest, og.jpg',
);
