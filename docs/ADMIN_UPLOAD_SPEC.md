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

## Validation layers (server side; the client repeats the cheap ones for instant feedback)

1. **Extension** against the allowlist (case-insensitive).
2. **Declared MIME** against the allowlist (`image/jpeg`, `image/png`, `image/heic`, `image/heif`, optional `image/webp`).
3. **Magic bytes** of the received buffer: JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, HEIC/HEIF `ftyp` box with brand `heic|heix|hevc|hevx|heif|mif1|msf1`, WebP `RIFF….WEBP`. A `.jpg` whose bytes are not JPEG is rejected — this is the case of `malware.exe` renamed to `puppy.jpg`.
4. **Decode** the image with the processing library; any decode failure rejects the file.
5. **Sanity**: dimensions ≥ 400 px on the short side (owner gets a friendly "photo is too small to look good" message), ≤ 12 000 px on the long side (decompression-bomb guard).

## Processing (never serve an owner upload as-is)

- Apply EXIF/HEIF orientation, then strip all metadata (location, device, timestamps).
- Produce: display 1600 px long edge (JPEG q82 + WebP), thumb 480 px, both with generated names `<uuid>-1600.jpg`,
  `<uuid>-480.jpg` … Original filename is stored as metadata for the owner's benefit only, never used as a key.
- HEIC/HEIF → JPEG **before** upload in the admin UI (libheif WASM), so an iPhone photo "just works"; the server still
  validates and decodes what it receives and rejects raw HEIC it cannot decode (with the friendly type message).
- Originals: kept in the private bucket for 30 days (re-processing safety), then deleted. Nothing private is ever
  publicly listable.

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
- Storage credentials live server-side only; the browser uploads through short-lived signed URLs or the authenticated API.
- Public bucket contains derivatives only; private bucket has no public read policy.
- Rate limit uploads per session; reject oversized bodies before buffering.
