// Proxy for Edge Function CPU cost: WASM HEIC decode + JS JPEG encode in a single thread.
const fs = require('fs');
const libheif = require('libheif-js/wasm-bundle');
const jpeg = require('jpeg-js');
const files = process.argv.slice(2);
if (!files.length) { console.log('usage: node spikes/server-validate/heic-cpu.cjs <file.heic> …'); process.exit(0); }
(async () => {
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const t0 = process.hrtime.bigint();
    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(buf);
    const img = images[0];
    const w = img.get_width(), h = img.get_height();
    const out = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    await new Promise((res, rej) => img.display(out, (d) => (d ? res(d) : rej(new Error('display failed')))));
    const t1 = process.hrtime.bigint();
    // downscale to 1600 long edge (nearest-box sampling, cheap) then JPEG encode with jpeg-js
    const scale = Math.min(1, 1600 / Math.max(w, h));
    const dw = Math.round(w * scale), dh = Math.round(h * scale);
    const small = new Uint8Array(dw * dh * 4);
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const sx = Math.floor(x / scale), sy = Math.floor(y / scale);
      const si = (sy * w + sx) * 4, di = (y * dw + x) * 4;
      small[di] = out.data[si]; small[di + 1] = out.data[si + 1]; small[di + 2] = out.data[si + 2]; small[di + 3] = 255;
    }
    const enc = jpeg.encode({ data: small, width: dw, height: dh }, 85);
    const t2 = process.hrtime.bigint();
    const ms = (a, b) => Number(b - a) / 1e6;
    console.log(`${f.split('/').pop()}: ${(buf.length/1e6).toFixed(1)}MB → decoded ${w}x${h} in ${ms(t0,t1).toFixed(0)}ms; resize+jpeg(${dw}x${dh}, ${(enc.data.length/1024).toFixed(0)}KB) ${ms(t1,t2).toFixed(0)}ms; total CPU ~${ms(t0,t2).toFixed(0)}ms; peak RSS ${(process.memoryUsage().rss/1e6).toFixed(0)}MB`);
    fs.writeFileSync(`node-${f.split('/').pop()}.jpg`, enc.data);
  }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
