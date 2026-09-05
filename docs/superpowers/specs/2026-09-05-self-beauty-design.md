# Self Beauty — Product & Design Specification

Date: 2026-09-05 · Status: approved for public-site implementation (admin backend gated, see §10)

## 1. What we are building

A production website for **Self Beauty**, a home-based pedigree dog kennel and professional grooming
business in Bat Yam, Israel (operating since 2017, owner professionally trained since 2016).
Two commercial goals, both first-class:

1. Convert visitors into **puppy inquiries** (conversation via WhatsApp / phone, never e-commerce).
2. Convert visitors into **grooming customers** (appointment via WhatsApp / phone).

Two products in one codebase:

- **Part A — Public website.** Static, trilingual (Hebrew default/RTL, Russian, English), deployed to GitHub Pages.
- **Part B — Owner admin.** Secure, phone-friendly CRUD for dog listings. Backend architecture is
  gated on explicit approval (no fake auth, no secrets in the client). The public site is built first.

## 2. Discovery findings (facts, not assumptions)

### Repository
Empty apart from `images/` and `videos/`. No git, no package files, no CI. GitHub CLI is authenticated
as `avivg7`. Local Node was 21.7 (unsupported by Astro 7, which needs ≥ 22.12); a project-local
Node 24 LTS lives in `.tools/node` (git-ignored) and CI uses Node 24.

### Logo (`images/site_logo.png`, 1254×1254, opaque white background)
Ornate badge: crown, laurel, shield with Yorkie / apricot poodle / bichon, rosette, banner.
Text on the logo: “Home of Show Champions · Elite Show Breeding · Winners in the Ring ·
Yorkshire Terriers · Toy Poodles · Bichon Frise · **since 2014**”.

Sampled colours (k-means by region):
crimson `#A40C0B` / `#AB1C14`, deep red `#631A0D` / `#4B0601`, gold `#D9AE72` / `#C1A583` / `#B28B5E`,
bronze shadow `#6F421D`, black `#0C0909`, ivory `#F2EFEA` / `#E7DFD5`.

> **Inconsistency to resolve with the owner:** the logo says *since 2014*; the brief says *established 2017*.
> The site copy follows the brief (2017) because it is the client's explicit instruction; the logo is used as-is.
> Tracked as TODO-001.

### Media inventory
| Set | Files | Notes |
|---|---|---|
| `images/general_dogs` | 6 HEIC, 5 JPEG, 1 PNG (32 MB) | Samsung S26 Ultra phone photos, 1848×4000 portrait (9:19.5), EXIF dates May–Aug 2026. One PNG is a ChatGPT-processed image of a child (face pixelated) — **excluded**. One newborn-litter photo is too graphic for a premium public site — **excluded**. One cluttered pen photo — excluded from curated gallery, kept in source. |
| `images/shows` | 12 JPEG (1.7 MB) | Mixed 640–2048 px, landscape and portrait, no EXIF. Two carry photographer watermarks (kept, credited as "photo courtesy" only if owner confirms). One is a screenshot containing an accessibility-widget icon — cropped out. |
| `videos/general_dogs` | 1 MP4 (28 MB) | 1080×1920 portrait, **HEVC 10-bit** (not browser-safe), 18.5 s |
| `videos/shows` | 2 MP4 (26 MB) | 1920×1080 HEVC 10-bit 13.6 s; 478×850 H.264 WhatsApp 32 s |
| Grooming media | **none** | No before/after material exists. Section built with a clearly labelled placeholder state. |
| Profile | `profile_pic.jpg` 886×886 | Warm golden-hour portrait with a Yorkie. About page. |

No byte-level duplicates. No corrupted files. All HEIC decode correctly with ImageMagick/libheif.

## 3. Information architecture

Every route exists under `/he/`, `/ru/`, `/en/`. Root `/` is a language gateway (stored preference → else Hebrew).

| Route | Page | Job |
|---|---|---|
| `/` (per locale) | Home | Explain the dual business in 5 seconds; route to puppies or grooming |
| `/puppies/` | Available puppies | Primary conversion. Cards → detail → WhatsApp |
| `/puppies/{id}/` | Puppy detail | Photos, pedigree summary, conversational CTA |
| `/litters/` | Planned litters | WhatsApp update opt-in (prefilled message) |
| `/grooming/` | Professional grooming | Services, show prep, appointment CTA |
| `/shows/` | Shows & achievements | Trust: ring photos, trophies, video; filters; lightbox |
| `/gallery/` | Our dogs through the years | Emotional story gallery, photo + video, lightbox |
| `/about/` | About Self Beauty | Owner, kennel, breeds, guidance to buyers |
| `/stories/` | Testimonials | The real Russian story as long-form editorial; invitation to share |
| `/contact/` | Contact | Phone, WhatsApp, Facebook, location (city only) |
| `/accessibility/` | Accessibility statement | Honest statement, no certification claims |

Navigation (6 items): Puppies · Grooming · Shows · Gallery · About · Contact. Litters is reached from
Puppies (section + empty state), Home, and footer. Stories is reached from Home, About, and footer.

## 4. User journeys and conversion paths

- **A** Home hero → “Available puppies” → card → detail → **“דברו איתנו על הגור”** (WhatsApp, prefilled with puppy name) or call.
- **B** Home grooming band → `/grooming/` → **“קביעת תור ב-WhatsApp”** / **“התקשרו לקביעת תור”**.
- **C** `/shows/` gallery → closing band “Looking for a puppy from these lines?” → `/puppies/`.
- **D** `/stories/` → “Ask us about a puppy like this” → WhatsApp / contact.
- **Litters** `/litters/` → **“קבלו עדכון ב-WhatsApp”** (prefilled opt-in message). No auto popup; a quiet inline banner on Puppies.
- **E (admin)** Owner → login → add puppy → upload ≤3 photos → set cover → publish. (Gated.)

Mobile always has Call + WhatsApp reachable: a two-segment sticky bottom bar with safe-area padding,
hidden while the menu sheet or a lightbox is open, and never overlapping page CTAs (body reserves space).

## 5. Visual direction — “European show-ring prestige, modern boutique”

**Palette (derived from the logo, modernised)**

| Token | Value | Use |
|---|---|---|
| `--c-bg` | `#F8F4EC` | Page ground (warm ivory) |
| `--c-cream` | `#F1EAE0` | Alternate section ground |
| `--c-surface` | `#FFFDF9` | Cards |
| `--c-border` | `#E2D8C8` | Hairlines |
| `--c-burgundy` | `#7B1B22` | Primary action, links, emphasis (9.5:1 on ivory) |
| `--c-burgundy-deep` | `#4F0D14` | Pressed states, dark accents |
| `--c-crimson` | `#A8121A` | Logo red; tiny accents only |
| `--c-charcoal` | `#1F1B1A` | Text, dark sections |
| `--c-black` | `#0C0909` | Footer, lightbox |
| `--c-gold` | `#C9A46A` | Lines, frames, chips on dark (decorative only on light) |
| `--c-gold-bright` | `#DDB877` | Gold text on dark (9:1 on charcoal) |
| `--c-gold-text` | `#7E603A` | Gold-toned text on light (5.3:1) |
| `--c-text` / `--c-text-2` | `#1F1B1A` / `#5C544F` | Body / secondary (6.7:1) |
| `--c-focus` | `#7B1B22` light / `#DDB877` dark | 2 px ring + 2 px offset |
| success / warning / error | `#2F6F4E` / `#8A5E0E` / `#A8232B` | All ≥ 5:1 on ivory |

Gold is a line, a frame, a chip — never a background. Burgundy is the action colour. Most of the page is ivory and photograph.

**Typography (self-hosted, OFL, subset per script)**
- Display: **Bona Nova** 400/700 + italic — one serif that natively covers Hebrew, Cyrillic and Latin, so
  the brand voice is identical in all three languages. Refined, slightly calligraphic; feels like a
  pedigree certificate without pastiche.
- Body: **IBM Plex Sans** (Latin/Cyrillic, variable) + **IBM Plex Sans Hebrew** 400/500/600 —
  the same design family across scripts; crisp on phones; not the default “Inter”.
- Scale (fluid): body 1rem→1.0625rem; h1 `clamp(2.25rem, 1.5rem + 3.5vw, 4.25rem)`; line-height 1.55 body, 1.1 display.
  Hebrew display uses slightly larger size and tighter leading; Russian strings get `text-wrap: balance` and a wider container.

**Signature: the mounted photograph.** Featured images sit in a thin gold hairline frame offset from the
photo edge (like a mounted show print). It appears on the hero, the About portrait, and featured cards —
and nowhere else. Secondary system element: the **rosette chip** (small circle + two ribbon tails) reserved
strictly for verified show titles. Puppy status uses plain pills (a status is not an award).

**Motion.** One orchestrated hero sequence on load (headline lines rise, frame draws), IntersectionObserver
reveals (12 px, 400 ms, ease-out), image hover scale 1.03, lightbox crossfade 200 ms. Everything off under
`prefers-reduced-motion` and the site's own “reduce motion” control. No parallax, no scroll-jacking.

**Anti-patterns explicitly avoided:** gold backgrounds, paw-print patterns, cartoon dogs, e-commerce
badges, gradient-heavy heroes, template “01/02/03” numbering, hairline-broadsheet cosplay.

## 6. Architecture

- **Astro 7 + TypeScript**, `output: 'static'`, zero client JS by default; small vanilla-TS islands for
  nav sheet, language menu, accessibility panel, lightbox, gallery filters, litter banner. No React on the
  public site (nothing needs it). React/Preact may be introduced for the admin if the gate approves.
- **i18n:** Astro built-in i18n with `prefixDefaultLocale: true`; pages live under `src/pages/[lang]/…`
  with `getStaticPaths()` over the three locales; a typed dictionary per locale (`src/i18n/{he,ru,en}.ts`)
  checked by a unit test for key parity. `<html lang dir>`, `hreflang` alternates, localized
  title/description/OG per page. Language preference persisted in `localStorage`; switching keeps the
  equivalent page.
- **Content:** Astro content collections (JSON, Zod-validated) for puppies, litters, breeds, testimonials,
  services. Listings marked `demo: true` are excluded from production builds (`SB_INCLUDE_DEMO=1` enables).
- **Media pipeline (deterministic, committed derivatives):** `scripts/media/ingest.mjs` runs locally,
  converts HEIC→JPEG web masters (≤2000 px, EXIF-oriented, metadata stripped) and HEVC→H.264 MP4
  (720p + 480p, faststart) + poster frames, guided by `scripts/media/manifest.json` (selection, crop, focal
  point, captions). Masters are committed under `src/assets/media/`; Astro's sharp image service derives
  AVIF/WebP `srcset`s at build time in CI. Originals in `images/` and `videos/` are never modified and are
  git-ignored (documented as the source vault). Rationale: HEIC/HEVC decoding in CI is unreliable; JPEG/PNG
  via sharp is not.
- **Deployment:** GitHub Actions — CI (lint, typecheck, unit, build, link check, Playwright) and Pages
  deploy via `withastro/action` + `actions/deploy-pages`. `site`/`base` come from env so a custom domain is a
  one-line change plus `public/CNAME`.

## 7. Accessibility model
Semantic landmarks, one `h1` per page, skip link, visible focus, 44 px targets, labelled icon buttons,
focus-trapped dialogs (menu, lightbox) with Esc, `aria-live` for status, reduced motion, and an
accessibility panel (text size ×1.25/×1.5, high contrast, reduce motion) persisted per device.
Automated axe checks in Playwright per locale and viewport; manual keyboard passes documented.

## 8. Testing
Vitest (i18n parity, WhatsApp/phone builders, manifest integrity, listing filters), `astro check`,
ESLint, Playwright at 320/360/375/390/414/430/768/1024/1440 for navigation, language switch, RTL,
CTAs, gallery/lightbox keyboard flow, accessibility panel; axe on every page/locale; dist link checker;
production build with the GitHub Pages base path.

## 9. Honesty rules encoded in data
No prices, no invented puppies/reviews/awards/registration numbers/URLs. Kennel-club link is a config
field left empty (TODO-002). Titles attach to a dog only when `verified: true` with a source note.
Grooming gallery shows an honest “portfolio coming soon” state until real material exists (TODO-003).

## 10. Admin backend gate (Phase 4)
Before any authentication/persistence is built, 2–3 architectures will be presented (auth, DB, storage,
GitHub Pages compatibility, security, cost, free tier, complexity, usability, vendor risk, backups,
limits) with a recommendation. No accounts, paid services, or keys are created without approval. The
admin UI may be developed against an in-memory repository interface labelled “DEV ONLY”.
