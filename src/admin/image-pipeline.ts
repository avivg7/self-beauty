/**
 * Browser-side image pipeline (Lean V1): sniff → decode (native, libheif fallback for HEIC) → orientation-correct
 * → resize → JPEG. Only the generated derivatives leave the device; originals and metadata never do.
 */
export type PipelineErrorCode = 'tooLarge' | 'unsupportedType' | 'invalidImage';
export class PipelineError extends Error {
  constructor(public code: PipelineErrorCode) {
    super(code);
  }
}
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 50_000_000;
export const LARGE_EDGE = 1600;
export const CARD_EDGE = 640;
export const LARGE_QUALITY = 0.85;
export const CARD_QUALITY = 0.82;

export type Kind = 'jpeg' | 'png' | 'heic' | 'webp';

export function sniff(head: Uint8Array): Kind | null {
  if (head.length < 12) return null;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
  const ascii = (a: number, b: number) => String.fromCharCode(...head.subarray(a, b));
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'].includes(brand)) return 'heic';
    return null;
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

async function decodeHeic(file: File): Promise<ImageBitmap> {
  const mod = (await import('libheif-js/libheif-wasm/libheif-bundle.mjs')) as unknown as { default: unknown };
  const factory = mod.default as (() => Promise<LibHeif>) | LibHeif;
  const lib: LibHeif = typeof factory === 'function' ? await factory() : factory;
  const buf = await file.arrayBuffer();
  const images = new lib.HeifDecoder().decode(buf);
  const img = images[0];
  if (!img) throw new PipelineError('invalidImage');
  const w = img.get_width(),
    h = img.get_height();
  if (w * h > MAX_SOURCE_PIXELS) throw new PipelineError('invalidImage');
  const data = new ImageData(w, h);
  await new Promise<void>((res, rej) =>
    img.display(data, (d: unknown) => (d ? res() : rej(new PipelineError('invalidImage')))),
  );
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(data, 0, 0);
  return createImageBitmap(c);
}
interface LibHeif {
  HeifDecoder: new () => {
    decode(
      buf: ArrayBuffer,
    ): { get_width(): number; get_height(): number; display(d: ImageData, cb: (d: unknown) => void): void }[];
  };
}

async function downscale(
  src: ImageBitmap,
  edge: number,
): Promise<{ canvas: HTMLCanvasElement; w: number; h: number }> {
  const scale = Math.min(1, edge / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale)),
    h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  try {
    const bmp = await createImageBitmap(src, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
  } catch {
    // Fallback: stepwise halving for quality when resize options are unsupported
    let cur: CanvasImageSource = src,
      cw = src.width,
      ch = src.height;
    while (cw / 2 > w) {
      const step = document.createElement('canvas');
      step.width = Math.round(cw / 2);
      step.height = Math.round(ch / 2);
      step.getContext('2d')!.drawImage(cur, 0, 0, step.width, step.height);
      cur = step;
      cw = step.width;
      ch = step.height;
    }
    ctx.drawImage(cur, 0, 0, w, h);
  }
  return { canvas, w, h };
}
const toJpeg = (canvas: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new PipelineError('invalidImage'))), 'image/jpeg', q),
  );

export interface Derivatives {
  large: Blob;
  card: Blob;
  width: number;
  height: number;
  kind: Kind;
  via: 'native' | 'libheif';
}

export async function prepareDerivatives(file: File): Promise<Derivatives> {
  if (file.size > MAX_SOURCE_BYTES) throw new PipelineError('tooLarge');
  const kind = sniff(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  if (!kind) throw new PipelineError('unsupportedType');
  let bitmap: ImageBitmap;
  let via: 'native' | 'libheif' = 'native';
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (kind !== 'heic') throw new PipelineError('invalidImage');
    bitmap = await decodeHeic(file);
    via = 'libheif';
  }
  try {
    if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) throw new PipelineError('invalidImage');
    const large = await downscale(bitmap, LARGE_EDGE);
    const card = await downscale(bitmap, CARD_EDGE);
    return {
      large: await toJpeg(large.canvas, LARGE_QUALITY),
      card: await toJpeg(card.canvas, CARD_QUALITY),
      width: large.w,
      height: large.h,
      kind,
      via,
    };
  } finally {
    bitmap.close();
  }
}
