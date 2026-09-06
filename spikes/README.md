# Spikes (reproducible technical evidence for the Stage 2 design)

Not part of the site build. Run from the repository root with the project Node.

| Spike | Command | Proves |
|---|---|---|
| `server-validate/` | `node spikes/server-validate/run.mjs` | Magic-byte sniffing, JPEG segment sanitisation, header-first pixel bounds and capped real decode on real and hostile inputs (renamed executable, truncated file, SVG/HTML, 30000×30000 header bomb, trailing polyglot bytes, oversized photo). |
| `server-validate/heic-cpu.cjs` | `node spikes/server-validate/heic-cpu.cjs <file.heic>` | Single-threaded WASM HEIC decode CPU time and peak RSS — the reason HEIC is converted in the browser, not in an Edge Function (256 MB limit). Needs a HEIC file; the source vault is git-ignored. |
| `heic-browser/` | `node spikes/heic-browser/serve.mjs` then open the printed URL (on a phone: same Wi-Fi) | Browser-side HEIC → upright 1600/960/480 JPEG derivatives with timings; native `createImageBitmap` first, `libheif-js` WASM fallback. This is the page for the Phase H iPhone matrix. |
