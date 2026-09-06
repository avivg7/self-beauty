import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileTypeFromBuffer } from 'file-type';
import jpeg from 'jpeg-js';
import { validateDerivative, sanitizeJpeg } from './validator.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const real = readFileSync(path.join(ROOT, 'src/assets/media/years/bichon-puppy-bows.jpg')); // 1179x1170 JPEG from the repo
const oversized = readFileSync(path.join(ROOT, 'src/assets/media/shows/trophy-hall.jpg')); // 2000x1126
// Build a genuine 739x1600-class derivative from repo pixels so the accept path is exercised without the vault
const decoded = jpeg.decode(real, { useTArray: true });
const derivative = jpeg.encode({ data: decoded.data, width: decoded.width, height: decoded.height }, 85).data;
const bomb = Buffer.from(derivative); // patch SOF dims to 30000x30000
for (let i = 2; i < bomb.length;) {
  const m = bomb[i + 1];
  if (m === 0xc0 || m === 0xc2) {
    bomb.writeUInt16BE(30000, i + 5);
    bomb.writeUInt16BE(30000, i + 7);
    break;
  }
  i += 2 + bomb.readUInt16BE(i + 2);
}
const polyglot = Buffer.concat([
  derivative,
  Buffer.from('PK\x03\x04 trailing zip payload <html><script>alert(1)</script>'),
]);
const exifPayload = Buffer.from('Exif\0\0GPSDATA!!');
const app1Len = Buffer.alloc(2);
app1Len.writeUInt16BE(exifPayload.length + 2);
const withExif = Buffer.concat([
  derivative.subarray(0, 2),
  Buffer.from([0xff, 0xe1]),
  app1Len,
  exifPayload,
  derivative.subarray(2),
]);
const fakeJpg = Buffer.concat([Buffer.from('MZ\x90\x00\x03\x00'), Buffer.alloc(4000, 0x41)]);
const truncated = real.subarray(0, Math.floor(real.length * 0.4));
const cases = [
  ['browser-style derivative (1179x1170)', derivative, 1600],
  ['same file as 480 tier (too large)', derivative, 480],
  ['oversized 2000x1126 photo', oversized, 1600],
  ['header bomb 30000x30000', bomb, 1600],
  ['JPEG+ZIP/HTML polyglot (trailing bytes)', polyglot, 1600],
  ['JPEG with EXIF/GPS APP1 segment', withExif, 1600],
  ['malware.exe renamed .jpg', fakeJpg, 1600],
  ['truncated jpg', truncated, 1600],
  ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 1600],
];
for (const [name, buf, tier] of cases) {
  const t0 = performance.now();
  const sniff = (await fileTypeFromBuffer(buf))?.mime ?? 'unknown';
  const r = validateDerivative(buf, tier);
  const ms = (performance.now() - t0).toFixed(0);
  console.log(
    `${name.padEnd(42)} sniff=${sniff.padEnd(24)} ${r.ok ? `ACCEPT ${r.width}x${r.height} stored=${r.bytes}B dropped=${r.droppedBytes}B` : `REJECT ${r.code}${r.dims ? ` ${r.dims.width}x${r.dims.height}` : ''}`} (${ms}ms)`,
  );
}
const s = sanitizeJpeg(withExif);
const pg = sanitizeJpeg(polyglot);
console.log(
  `\nsanitised EXIF sample still contains 'GPSDATA'? ${s.buffer?.includes('GPSDATA') ? 'YES (BUG)' : 'no'}; polyglot tail survives? ${pg.buffer?.includes('PK') ? 'YES (BUG)' : 'no'}`,
);
