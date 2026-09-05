# Media pipeline

## Principles

- Originals in `images/` and `videos/` are read-only inputs and are **git-ignored** (they are the source vault on
  the owner's machine; keep a backup). Nothing ever writes to them.
- Web derivatives are produced locally by `npm run media:ingest` and **committed**: JPEG/PNG masters under
  `src/assets/media/<set>/<id>.jpg` and MP4/poster files under `public/media/video/`.
- Why not convert in CI: the phone photos are HEIC and the phone videos are 10-bit HEVC. Decoding those reliably
  in GitHub-hosted runners is fragile; JPEG/PNG through sharp is not. The build therefore only ever sees
  JPEG/PNG and pre-encoded MP4.
- Astro's image service turns each master into AVIF + WebP + JPEG `srcset`s at the widths each component asks for.

## Inventory (2026-09-05)

| Source                   | Count | Format                                       | Used | Notes                                                                                                                                                        |
| ------------------------ | ----- | -------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `images/general_dogs`    | 12    | 6 HEIC, 5 JPEG, 1 PNG                        | 9    | Samsung phone photos 1848×4000 (EXIF dates May–Aug 2026). Excluded: ChatGPT-processed image of a child; newborn litter photo (graphic); cluttered pen photo. |
| `images/shows`           | 12    | JPEG                                         | 12   | 640–2048px, no EXIF dates. Two carry photographer watermarks (kept; confirm rights). One is a screenshot with an accessibility-widget icon (cropped out).    |
| `videos/general_dogs`    | 1     | MP4 HEVC 10-bit 1080×1920                    | 1    | 18.5 s, portrait                                                                                                                                             |
| `videos/shows`           | 2     | MP4 HEVC 10-bit 1920×1080; MP4 H.264 478×850 | 2    | 13.6 s; 32 s WhatsApp (low-res, no audio)                                                                                                                    |
| `images/site_logo.png`   | 1     | PNG 1254² opaque                             | yes  | Transparent variant derived (flood-fill from corners)                                                                                                        |
| `images/profile_pic.jpg` | 1     | JPEG 886²                                    | yes  | About / home                                                                                                                                                 |

No duplicates, no unreadable files. Full per-file decisions: `scripts/media/manifest.json`, where every entry carries a
`status`: `included`, `needs_review` (used on the site but with an open question for the owner, e.g. watermark rights or
whether the Bichon photos show the current litter) or `excluded` (documented, never processed). **Source files are never
deleted or modified**, including excluded ones; removal from the vault requires explicit approval.

## Commands

```
npm run media:ingest            # convert new/changed sources (skips existing outputs)
npm run media:ingest -- --force # regenerate everything
node scripts/media/ingest.mjs --only <id> --skip-video
node scripts/media/brand.mjs    # favicons, OG image, web manifest
```

## Adding a photo

1. Drop the original into `images/<set>/`.
2. Add an entry to `scripts/media/manifest.json` (`id`, `set`, `src`, optional `crop` in display-orientation pixels).
3. Add the catalogue entry in `src/data/media.ts` with alt text in all three languages, a focal point
   (0–1; where the face is) and a chapter.
4. Run `npm run media:ingest`, check the output, commit the master.
5. `npm run test:unit` verifies the manifest, files and catalogue agree.

## Video encoding

H.264 High 4.0, `yuv420p`, CRF 24 (720 tier) / 26 (480 tier), `+faststart`, AAC 96k, metadata stripped.
Long-edge scaling handles portrait and landscape. Posters are JPEG + WebP at the timestamp given in the manifest.
Players never autoplay; the tier is chosen at play time (480p under 640px viewports or with Save-Data).

## Media to replace later (quality notes)

- `brand/hero-red-poodle` (740×925 after crop) is soft on large retina displays; a higher-resolution show
  photo of the same dog would improve the home hero.
- `shows/owner-two-yorkies` (640×960) is card-size only.
- `shows/shih-tzu-ring-video` (478×850) is low resolution; kept for authenticity.
- No grooming before/after material exists (TODO-003).
