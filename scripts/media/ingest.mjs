#!/usr/bin/env node
/**
 * Self Beauty media ingest.
 *
 * Deterministic, local preprocessing step. Reads scripts/media/manifest.json and produces:
 *   - src/assets/media/<set>/<id>.jpg|png   web masters (EXIF-oriented, cropped, ≤ maxEdge, metadata stripped)
 *   - public/media/video/<id>-720.mp4, -480.mp4, -poster.jpg, -poster.webp
 *   - src/assets/brand/logo-transparent.png (derived from the official logo)
 *
 * Why local + committed: HEIC/HEIF and 10-bit HEVC decoding is not something we want a production
 * build in GitHub CI to depend on. JPEG/PNG masters are then handled by Astro's sharp image service
 * (AVIF/WebP srcsets) at build time, which is reliable in CI.
 *
 * Originals in images/ and videos/ are read-only inputs and are never modified.
 *
 * Usage: node scripts/media/ingest.mjs [--force] [--only <id>] [--skip-video]
 */
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SKIP_VIDEO = args.includes('--skip-video');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const manifest = JSON.parse(await readFile(path.join(ROOT, 'scripts/media/manifest.json'), 'utf8'));

const exists = async (p) => !!(await stat(p).catch(() => null));
const log = (...m) => console.log('[media]', ...m);

async function decodeToSharp(absSrc) {
  const ext = path.extname(absSrc).toLowerCase();
  if (ext === '.heic' || ext === '.heif') {
    // libheif (wasm) applies the container-level orientation; output JPEG carries no EXIF,
    // so no double rotation happens downstream.
    const heicConvert = require('heic-convert');
    const buf = await readFile(absSrc);
    const jpeg = await heicConvert({ buffer: buf, format: 'JPEG', quality: 1 });
    return sharp(Buffer.from(jpeg));
  }
  // .rotate() with no args applies EXIF orientation and strips the tag.
  return sharp(absSrc).rotate();
}

async function ingestImage(item) {
  const absSrc = path.join(ROOT, item.src);
  const format = item.format ?? 'jpg';
  const outDir = path.join(ROOT, 'src/assets/media', item.set);
  const outPath = path.join(outDir, `${item.id}.${format}`);
  await mkdir(outDir, { recursive: true });
  if (!FORCE && (await exists(outPath))) return log('skip (exists)', path.relative(ROOT, outPath));
  if (!(await exists(absSrc))) throw new Error(`Missing source: ${item.src}`);

  let img = await decodeToSharp(absSrc);
  const meta = await img.metadata();
  // After rotate(), sharp reports the pre-rotation size in metadata; compute display size ourselves.
  const rotated = meta.orientation && meta.orientation >= 5;
  const dispW = rotated ? meta.height : meta.width;
  const dispH = rotated ? meta.width : meta.height;

  if (item.crop) {
    const { x, y, w, h } = item.crop;
    if (x + w > dispW || y + h > dispH) {
      throw new Error(
        `Crop out of bounds for ${item.id}: image is ${dispW}x${dispH}, crop ${JSON.stringify(item.crop)}`,
      );
    }
    img = img.extract({ left: x, top: y, width: w, height: h });
  }
  const maxEdge = item.maxEdge ?? 2000;
  img = img.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
  if (format === 'png') img = img.png({ compressionLevel: 9, palette: false });
  else img = img.jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:2:0' });
  const info = await img.toFile(outPath);
  log(
    'image',
    path.relative(ROOT, outPath),
    `${info.width}x${info.height}`,
    `${(info.size / 1024).toFixed(0)} KB`,
  );
}

function run(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-2000)}`)),
    );
  });
}

async function ingestVideo(item) {
  const ffmpeg = require('ffmpeg-static');
  const absSrc = path.join(ROOT, item.src);
  const outDir = path.join(ROOT, 'public/media/video');
  await mkdir(outDir, { recursive: true });
  const tiers = [
    { name: '720', edge: 1280, crf: 24 },
    { name: '480', edge: 854, crf: 26 },
  ];
  for (const t of tiers) {
    const out = path.join(outDir, `${item.id}-${t.name}.mp4`);
    if (!FORCE && (await exists(out))) {
      log('skip (exists)', path.relative(ROOT, out));
      continue;
    }
    // Long-edge scaling that works for both portrait and landscape; -2 keeps the other side even.
    const scale = `scale='if(gte(iw,ih),min(${t.edge},iw),-2)':'if(gte(iw,ih),-2,min(${t.edge},ih))'`;
    await run(ffmpeg, [
      '-y',
      '-v',
      'error',
      '-i',
      absSrc,
      '-vf',
      scale,
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      String(t.crf),
      '-profile:v',
      'high',
      '-level',
      '4.0',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '2',
      '-map_metadata',
      '-1',
      out,
    ]);
    const s = await stat(out);
    log('video', path.relative(ROOT, out), `${(s.size / 1024 / 1024).toFixed(2)} MB`);
  }
  const posterJpg = path.join(outDir, `${item.id}-poster.jpg`);
  if (FORCE || !(await exists(posterJpg))) {
    const tmp = path.join(outDir, `${item.id}-poster.raw.png`);
    await run(ffmpeg, [
      '-y',
      '-v',
      'error',
      '-ss',
      String(item.poster ?? 1),
      '-i',
      absSrc,
      '-frames:v',
      '1',
      tmp,
    ]);
    const poster = sharp(tmp).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true });
    await poster.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(posterJpg);
    await poster
      .clone()
      .webp({ quality: 78 })
      .toFile(path.join(outDir, `${item.id}-poster.webp`));
    const { unlink } = await import('node:fs/promises');
    await unlink(tmp);
    log('poster', path.relative(ROOT, posterJpg));
  }
}

async function probeVideos() {
  const ffprobe = require('ffprobe-static').path;
  const out = {};
  for (const v of manifest.videos) {
    for (const tier of ['720', '480']) {
      const f = path.join(ROOT, 'public/media/video', `${v.id}-${tier}.mp4`);
      if (!(await exists(f))) continue;
      const json = await new Promise((resolve, reject) => {
        const p = spawn(ffprobe, [
          '-v',
          'error',
          '-print_format',
          'json',
          '-show_streams',
          '-show_format',
          f,
        ]);
        let s = '';
        p.stdout.on('data', (d) => (s += d));
        p.on('close', (c) => (c === 0 ? resolve(JSON.parse(s)) : reject(new Error('ffprobe failed'))));
      });
      const vs = json.streams.find((x) => x.codec_type === 'video');
      out[`${v.id}-${tier}`] = {
        width: vs.width,
        height: vs.height,
        duration: Number(json.format.duration),
        bytes: Number(json.format.size),
        codec: vs.codec_name,
        hasAudio: json.streams.some((x) => x.codec_type === 'audio'),
      };
    }
  }
  await writeFile(path.join(ROOT, 'src/data/video.generated.json'), JSON.stringify(out, null, 2) + '\n');
  log('wrote src/data/video.generated.json');
}

async function deriveLogoTransparent() {
  // Sharp has no flood fill; we key out near-white pixels ONLY in a background mask built by
  // thresholding, then keep the white bichon/outline by limiting removal to pixels that are
  // near-white AND whose neighbourhood is near-white (a cheap erosion). Good enough for a badge on ivory.
  const src = path.join(ROOT, manifest.images.find((i) => i.id === 'logo').src);
  const out = path.join(ROOT, 'src/assets/brand/logo-transparent.png');
  await mkdir(path.dirname(out), { recursive: true });
  if (!FORCE && (await exists(out))) return log('skip (exists)', path.relative(ROOT, out));
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const isWhite = (i) => data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244;
  // Flood fill from the four corners over near-white pixels: only the connected background becomes transparent.
  const visited = new Uint8Array(width * height);
  const stack = [0, width - 1, (height - 1) * width, height * width - 1];
  while (stack.length) {
    const p = stack.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * channels;
    if (!isWhite(i)) continue;
    data[i + 3] = 0;
    const x = p % width,
      y = (p - x) / width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }
  await sharp(data, { raw: { width, height, channels } }).png({ compressionLevel: 9 }).toFile(out);
  log('brand', path.relative(ROOT, out));
}

// ---- main
await mkdir(path.join(ROOT, 'src/data'), { recursive: true });
for (const item of manifest.images) {
  if (ONLY && item.id !== ONLY) continue;
  await ingestImage(item);
}
if (!ONLY) await deriveLogoTransparent();
if (!SKIP_VIDEO) {
  for (const v of manifest.videos) {
    if (ONLY && v.id !== ONLY) continue;
    await ingestVideo(v);
  }
  await probeVideos();
}
log('done');
