# Admin image upload — specification

Binding rules for the owner admin (Part B). Written before the backend exists so the architecture gate and the
implementation are held to the same contract. Nothing here is implemented yet.

## Limits

| Rule               | Value                                                                                              | Enforced in                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Images per listing | **max 3**                                                                                          | UI (add button disabled at 3/3) **and** API (transactional count check; 4th upload rejected with `LIMIT_REACHED`) |
| Original file size | **max 10 MB**                                                                                      | UI (before upload) **and** API (request size cap + checked again after receipt)                                   |
| Allowed types      | `.jpg` `.jpeg` `.png` `.heic` `.heif` (`.webp` optional, only if the pipeline decodes it reliably) | UI accept list **and** API allowlist                                                                              |
| Rejected always    | SVG, PDF, GIF, HTML, ZIP, executables, unknown binaries, anything that fails decoding              | API                                                                                                               |

Why 10 MB: a 12 MP phone HEIC is 2–4 MB and a JPEG 4–7 MB; 10 MB leaves headroom without inviting 40 MB RAW-like uploads
that time out on mobile connections. Change only with an argued reason.

## Validation layers

The browser does the cheap checks for instant feedback; the Edge Function repeats everything that matters on
the derivatives it receives, treating them as untrusted input (nothing the browser reports is used).

Client (before upload): extension allowlist → declared MIME allowlist → magic bytes (JPEG `FF D8 FF`, PNG
signature, HEIC/HEIF `ftyp` brands `heic|heix|hevc|hevx|heif|mif1|msf1`, WebP `RIFF….WEBP`) → decode
(HEIC via libheif WASM, others via `createImageBitmap` with EXIF orientation) → reject decoded images above
50 MP → downscale/encode JPEG 1600 px (q0.85) and 480 px (q0.82). A renamed `malware.exe` fails at the magic
bytes; a truncated photo fails at decode.

Server (`listing-ops: register`), per derivative:

1. **Bytes** (checked from object metadata before download): `-1600` ≤ 2 MB, `-960` ≤ 800 KB, `-480` ≤ 300 KB.
2. **Magic bytes**: JPEG only (`FF D8 FF`); the client never produces other derivative formats, so anything else is rejected.
   2b. **Segment sanitisation**: keep SOI, DQT, SOF0/1/2, DHT, DRI, SOS + entropy data, EOI; drop every APPn (EXIF, GPS,
   ICC, XMP) and COM; truncate at EOI (defeats JPEG/ZIP/HTML polyglots); reject other SOF types and multiple SOFs.
   The sanitised bytes are what gets stored. ICC may be dropped only because the client renders into an sRGB canvas.
3. **Header-first pixel bounds** (parsed from the SOF marker of the sanitised buffer before any pixel buffer is allocated):
   long edge ≤ 1600 / 960 / 480, short edge ≥ 300 / 180 / 120, ≤ 2.6 MP, 1 or 3 components (grayscale and progressive are fine). A 2 MB file whose header claims
   30000×30000 is rejected in under a millisecond — this is the decompression-bomb guard.
4. **Real decode** with `jpeg-js` capped at `maxResolutionInMP: 3` and `maxMemoryUsageInMB: 64`; decoded dimensions
   must equal the header; any decode error rejects (truncated, garbage entropy data).
5. Stored `width`, `height`, `bytes` are the server-measured values.

Why these numbers: a 1600 px long-edge derivative is at most 1600×1600 = 2.56 MP → ~10 MB RGBA, far inside the
256 MB Edge Function memory; a 12–48 MP phone photo is handled on the client, never on the server.

## Processing (never serve an owner upload as-is)

- Apply EXIF/HEIF orientation, then strip all metadata (location, device, timestamps).
- Produce three JPEG derivatives in the browser: 1600 px long edge (q0.85, detail/lightbox), 960 px (q0.85, cards),
  480 px (q0.82, admin thumbnails), named `<uuid>-1600.jpg`, `<uuid>-960.jpg`, `<uuid>-480.jpg`. The original
  filename is shown to the owner only, never used as a key.
- HEIC/HEIF → JPEG **before** upload in the admin UI (libheif WASM), so an iPhone photo "just works"; the server still
  validates and decodes what it receives and rejects raw HEIC it cannot decode (with the friendly type message).
- Originals are not stored (the browser converts and downscales); re-processing at a higher resolution needs a re-upload.

## Owner experience (mobile-first)

- Large "Add photos" button opens the native picker/camera; multiple selection allowed up to the remaining slots.
- Counter always visible: `0/3 · 1/3 · 2/3 · 3/3`; at 3/3 the add button is disabled with the limit message.
- Immediate thumbnails, per-file progress, success tick or error message under the thumbnail.
- Per photo: **remove**, **replace**, **set as main** (clear star/label), **reorder** (drag on desktop; up/down
  buttons on touch — no drag-only interaction).
- The first photo is the main photo unless another is chosen; the choice is stored explicitly.
- Unsaved-changes guard on leaving the form.

## Localized messages (already in the site dictionaries under `admin.upload`)

| Key             | Hebrew                                                         | Russian                                                                        | English                                                                      |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| maxImages       | ניתן להעלות עד 3 תמונות לכל כלב.                               | Можно загрузить не более 3 фотографий для каждой собаки.                       | You can upload up to 3 photos per dog.                                       |
| unsupportedType | סוג הקובץ אינו נתמך. ניתן להעלות JPG, JPEG, PNG, HEIC או HEIF. | Формат файла не поддерживается. Можно загрузить JPG, JPEG, PNG, HEIC или HEIF. | This file type isn't supported. You can upload JPG, JPEG, PNG, HEIC or HEIF. |
| tooLarge        | התמונה גדולה מדי. ניתן להעלות קובץ בגודל של עד 10MB.           | Фотография слишком большая. Максимальный размер файла — 10 МБ.                 | This photo is too large. The maximum file size is 10 MB.                     |
| invalidImage    | הקובץ אינו תמונה תקינה.                                        | Файл не является корректным изображением.                                      | This file is not a valid image.                                              |

Technical details (MIME types, server errors, stack traces) are never shown to the owner; they go to logs.

## Security

- Object keys are generated UUIDs; user filenames never touch a path.
- Two buckets: `listing-media-private` (all validated derivatives; owner uploads land in `incoming/` and are moved by the
  function after validation; anonymous reads fail even with the exact path) and `listing-media-public` (copies for
  currently published listings only; written by the Edge Function alone; public by URL, not listable; 1-hour CDN TTL).
- Storage credentials live server-side only; the browser uploads with the owner's session under a narrow `incoming/` policy.
- Rate limit uploads per session; reject oversized bodies before buffering.
