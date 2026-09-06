/**
 * Server-side derivative validator (design §6). Pure functions, no Supabase dependency, so the Edge Function
 * and the tests share exactly this code path. Input is UNTRUSTED.
 */
import jpeg from 'jpeg-js';

export const LIMITS = {
  1600: { maxBytes: 2 * 1024 * 1024, maxLong: 1600, minShort: 300 },
  960: { maxBytes: 800 * 1024, maxLong: 960, minShort: 180 },
  480: { maxBytes: 300 * 1024, maxLong: 480, minShort: 120 },
};
const MAX_PIXELS = 2_600_000;

/** Keep only structural JPEG segments; drop APPn/COM; truncate at EOI; reject unsupported/multiple SOF. */
export function sanitizeJpeg(buf) {
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return { error: 'MAGIC' };
  const keep = [Buffer.from([0xff, 0xd8])];
  let i = 2;
  let sofSeen = 0;
  let sof = null;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return { error: 'STRUCTURE' };
    if (i + 1 >= buf.length) return { error: 'NO_EOI' };
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    } // fill byte
    if (marker === 0xd9) {
      keep.push(Buffer.from([0xff, 0xd9]));
      return { buffer: Buffer.concat(keep), sof };
    } // EOI: truncate
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    } // standalone
    if (i + 4 > buf.length) return { error: 'STRUCTURE' };
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return { error: 'STRUCTURE' };
    const seg = buf.subarray(i, i + 2 + len);
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      if (![0xc0, 0xc1, 0xc2].includes(marker)) return { error: 'SOF_TYPE' };
      if (++sofSeen > 1) return { error: 'MULTI_SOF' };
      sof = {
        height: seg.readUInt16BE(5),
        width: seg.readUInt16BE(7),
        components: seg[9],
        progressive: marker === 0xc2,
      };
      keep.push(seg);
    } else if (marker === 0xdb || marker === 0xc4 || marker === 0xdd) {
      keep.push(seg); // DQT, DHT, DRI
    } else if (marker === 0xda) {
      // SOS header, then entropy-coded data up to the next real marker (0xFF00 stuffing and RSTn stay inside)
      let j = i + 2 + len;
      while (j + 1 < buf.length) {
        if (buf[j] === 0xff && buf[j + 1] !== 0x00 && !(buf[j + 1] >= 0xd0 && buf[j + 1] <= 0xd7)) break;
        j++;
      }
      keep.push(buf.subarray(i, j));
      i = j;
      continue;
    }
    // APPn (0xe0-0xef), COM (0xfe) and anything else are dropped
    i += 2 + len;
  }
  return { error: 'NO_EOI' };
}

export function validateDerivative(buf, tier) {
  const lim = LIMITS[tier];
  if (!lim) return { ok: false, code: 'TIER' };
  if (buf.length > lim.maxBytes) return { ok: false, code: 'BYTES' };
  const s = sanitizeJpeg(buf);
  if (s.error) return { ok: false, code: s.error };
  const d = s.sof;
  if (!d) return { ok: false, code: 'NO_SOF' };
  if (
    Math.max(d.width, d.height) > lim.maxLong ||
    Math.min(d.width, d.height) < lim.minShort ||
    d.width * d.height > MAX_PIXELS
  )
    return { ok: false, code: 'DIMENSIONS', dims: d };
  if (d.components !== 3 && d.components !== 1) return { ok: false, code: 'COMPONENTS' };
  try {
    const img = jpeg.decode(s.buffer, {
      useTArray: true,
      tolerantDecoding: false,
      maxResolutionInMP: 3,
      maxMemoryUsageInMB: 64,
    });
    if (img.width !== d.width || img.height !== d.height) return { ok: false, code: 'DECODE_MISMATCH' };
    return {
      ok: true,
      width: img.width,
      height: img.height,
      bytes: s.buffer.length,
      sanitized: s.buffer,
      progressive: d.progressive,
      droppedBytes: buf.length - s.buffer.length,
    };
  } catch (e) {
    return { ok: false, code: 'DECODE', detail: String(e.message).slice(0, 60) };
  }
}
