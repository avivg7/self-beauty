# Stage 2 — Admin interface and dynamic puppy listings (Supabase) — design

Date: 2026-09-06 · Status: **proposed, awaiting approval before any external resource is created**
Production baseline: `main` @ `116c328`, https://avivg7.github.io/self-beauty/

## 0. Discovery (what exists today)

- Public site: Astro 7 static, three locales, deployed by GitHub Actions to GitHub Pages under `/self-beauty/`.
  Puppies pages render from an Astro content collection (`src/content/puppies/*.json`) through
  `src/lib/listings.ts` → `PuppyGrid.astro` / `PuppyCard.astro`; production currently has **no published
  listing** and shows the honest empty state. Nine demo fixtures exist for layout review only.
- Status labels, breeds, WhatsApp intents and the `admin.upload` error messages already exist in all three
  dictionaries. Breed keys (`yorkshire|poodle|bichon|pomeranian|shihtzu`) are stable internal values.
- No framework runs on the public site; islands are vanilla TypeScript. No env secrets exist. Docker is
  installed locally (Supabase CLI local stack is therefore possible); the Supabase CLI is not yet installed.

## 1. Architecture (final proposal)

```
Owner's phone ──HTTPS──▶ GitHub Pages  /self-beauty/admin/   (static Astro page + Preact island, no server)
                                   │  supabase-js (anon key + owner session JWT)
                                   ▼
                         Supabase project (free plan)
                         ├─ Auth (email + password, sign-ups disabled, one admin)
                         ├─ Postgres: listings, listing_images, admins  + RLS + RPC + triggers
                         ├─ Storage bucket listing-media (public read by URL, no listing, owner-only write)
                         └─ Edge Function register-image (service role; validates bytes, enforces ≤3, inserts row)

Visitor ──HTTPS──▶ GitHub Pages /self-beauty/he/puppies/  (static shell)
                        │ fetch RPC public_listings_json() with anon key, cache: no-store
                        ▼  Supabase REST (published rows only) + image URLs on the Storage CDN
```

- Content changes never touch Git, Actions, or Pages. GitHub Actions deploys **code** only.
- Nothing secret is bundled: the anon key and project URL are public by design (RLS is the security
  boundary). The service-role key exists only in the Edge Function runtime and in a local git-ignored file.

## 2. Database schema (SQL migrations in `supabase/migrations/`)

```sql
create type breed          as enum ('yorkshire','poodle','bichon','pomeranian','shihtzu');
create type sex            as enum ('male','female','unspecified');
create type listing_status as enum ('available','reserved','coming_soon','placed');

create table admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table listings (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid not null references auth.users(id),
  breed           breed not null,
  sex             sex not null default 'unspecified',
  birth_date      date,
  status          listing_status not null default 'available',
  published       boolean not null default false,
  published_at    timestamptz,
  featured        boolean not null default false,
  archived_at     timestamptz,                       -- archive = soft delete
  sort_order      int not null default 100,
  name_he         text not null check (length(name_he) between 1 and 80),
  name_ru         text check (length(name_ru) <= 80),
  name_en         text check (length(name_en) <= 80),
  description_he  text not null default '' check (length(description_he) <= 1500),
  description_ru  text check (length(description_ru) <= 1500),
  description_en  text check (length(description_en) <= 1500),
  pedigree_he     text check (length(pedigree_he) <= 600),
  pedigree_ru     text check (length(pedigree_ru) <= 600),
  pedigree_en     text check (length(pedigree_en) <= 600),
  sire_name       text check (length(sire_name) <= 80),
  dam_name        text check (length(dam_name) <= 80),
  show_prospect   boolean not null default false,
  internal_note   text                               -- owner-only, never exposed
);

create table listing_images (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  position    smallint not null check (position between 1 and 3),   -- position 1 = primary photo
  path_1600   text not null,      -- listings/<listing_id>/<image_id>-1600.jpg
  path_480    text not null,      -- listings/<listing_id>/<image_id>-480.jpg
  width       int not null,  height int not null,   -- of the 1600 derivative (CLS-free rendering)
  bytes       int not null,
  created_at  timestamptz not null default now(),
  unique (listing_id, position)                       -- the 3-image invariant, race-proof
);
```

Rules encoded in the database, not only in the UI:

- **≤ 3 images**: `position ∈ {1,2,3}` + `unique(listing_id, position)`. Two concurrent 3rd-image inserts cannot both
  succeed; a 4th has no legal position. A trigger additionally rejects any insert when 3 rows exist (belt and braces).
- **Primary photo = position 1**; "set as main" and reordering are position swaps inside one RPC (`reorder_images`)
  that runs in a transaction, so there is never a moment with two primaries or a gap.
- **Publish gate** (trigger): `published = true` requires `archived_at is null`, ≥ 1 image, non-empty `name_he` and
  `description_he`. Archiving sets `published = false`.
- `updated_at` maintained by trigger. "planned" is **not** a dog status: a planned litter is a litter concept and
  stays on the static litters page; the dog enum is `available / reserved / coming_soon / placed`.
- A listing may describe a single dog or a litter ("Bichon Frise puppies"); `sex = unspecified` hides the sex line.

**Missing translations**: Hebrew is required; Russian/English are optional. Public behaviour: the Russian/English
page shows the localized breed, status and CTA, the name as entered, and the Hebrew description with a small
"available in Hebrew — ask us on WhatsApp for details in Russian/English" note. The admin marks the listing
"translation missing". Nothing is machine-translated.

## 3. Authentication and RLS

- Supabase Auth, email + password. Sign-ups disabled (`auth.enable_signup = false`); the single owner user is created
  once by us in the dashboard; her `user_id` is inserted into `admins`. Password reset by email (built-in provider,
  2 emails/hour — enough for one owner; custom SMTP optional later).
- `is_admin()` = `exists (select 1 from admins where user_id = auth.uid())`, `security definer`, `stable`.
- Failed login shows one generic message ("Email or password incorrect"); no account-existence disclosure.
- Session: supabase-js persisted session (access + refresh token in the browser's storage, the intended model);
  `onAuthStateChange` handles refresh/expiry; expired → login view with "session expired" notice; logout everywhere.

Policies (RLS enabled on every table; no policy = deny):

| Table                                      | anon                                                 | authenticated non-admin | admin                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `listings`                                 | none (reads go through the RPC/view)                 | none                    | select all; insert (`created_by = auth.uid()`); update; delete                                                                  |
| `listing_images`                           | none                                                 | none                    | select; update (position only, via RPC); delete. **No insert** — only the Edge Function (service role) inserts after validation |
| `admins`                                   | none                                                 | none                    | select own row                                                                                                                  |
| `storage.objects` (bucket `listing-media`) | no select (bucket is public-by-URL but not listable) | none                    | insert/update/delete only under `listings/<uuid>/…` where that listing exists                                                   |

Public read path: `rpc public_listings_json()` — `security definer`, `stable`, returns `jsonb` of
`published and archived_at is null` listings with their images and only public columns. Granted to `anon`.
A `public_listings` view exists for humans/tools with the same filter. Direct table access for `anon` is revoked.
There is deliberately no "authenticated can do everything" policy: a second user without an `admins` row can do nothing.

## 4. Storage and privacy model

- One bucket `listing-media`, **public read by URL, not enumerable** (no `select` policy for anon → `list` is denied),
  `allowedMimeTypes = image/jpeg`, `fileSizeLimit = 2 MB` (derivatives only, never originals).
- Object keys are generated: `listings/<listing_uuid>/<image_uuid>-1600.jpg` and `-480.jpg` (two random 122-bit ids).
  Owner filenames are never used as paths; no traversal or collision is possible.
- **Originals are not stored.** The browser converts/downscales, so nothing above 1600 px or above ~500 KB ever reaches
  Supabase, and no HEIC is ever served. (Consequence: "re-process at higher resolution later" needs a re-upload from
  the phone. Accepted for v1 and documented.)
- Unpublished content stays private because the only channel that reveals object paths is the public RPC, which returns
  published rows only. An unpublished listing's images exist at unguessable URLs that no page links to. On
  **delete** (and on archive, after 30 days) the objects are removed. This is the "unguessable public object" model;
  the strict alternative (private bucket + signed URLs) was rejected for the public page because every visitor would
  need a signing round trip and CDN caching would be lost; the copy-on-publish alternative adds failure states
  (publish succeeded, copy failed) for no practical privacy gain.
- Caching: objects are uploaded with `cache-control: max-age=31536000, immutable`; replacing a photo creates a new id.
  Listing data is fetched with `cache: 'no-store'`, so a status change is visible on the visitor's next page load.

## 5. Image pipeline (proven by the spike, see §9)

Client (admin, Preact island):

1. Pick: `<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" multiple>` — up to
   `3 − current` files, 10 MB each, checked before any upload; friendly localized errors from `admin.upload`.
2. Sniff magic bytes (JPEG `FF D8 FF`, PNG signature, HEIC/HEIF `ftyp` brands, WebP `RIFF…WEBP`); anything else is
   rejected client-side with `unsupportedType`, regardless of extension.
3. Decode: JPEG/PNG/WebP via `createImageBitmap(file, { imageOrientation: 'from-image' })` (EXIF orientation applied by
   the browser); HEIC/HEIF via `libheif-js` WASM (2 MB, loaded on demand only when a HEIC is picked; libheif applies the
   container rotation — verified upright output). On iOS Safari, Photos also transparently hands over HEIC as JPEG
   when it can; both paths converge.
4. Downscale with `createImageBitmap(..., resizeQuality: 'high')` to 1600 px long edge and 480 px, encode JPEG
   q0.85 / q0.82 via canvas (metadata is dropped by re-encoding). ~0.4 s desktop, ~1.5 s on a throttled mobile CPU.
5. Upload both derivatives to `listing-media` (owner session), then call the Edge Function.

Server (Edge Function `register-image`, service role, in `supabase/functions/`):

1. Verifies the caller's JWT belongs to an admin.
2. Downloads both objects, checks size (≤ 2 MB), magic bytes (JPEG only), **decodes** them (`jpeg-js`, ~70 ms for a
   1600 px image), checks dimensions (long edge ≤ 1600, short edge ≥ 300) and that the thumb matches.
3. Calls `rpc register_listing_image(listing_id, image_id, paths, dims)` which takes a per-listing transactional lock,
   assigns the next free position or raises `LIMIT_REACHED`, and inserts the row.
4. On any failure it deletes the objects and returns a code the admin maps to a localized message. No orphan rows;
   orphan objects are impossible because the row insert and the cleanup are in the same function. A weekly
   `sweep-orphans` function (later) reconciles anything left by a crashed browser mid-upload.

Why not server-side HEIC: the spike decoded a 12 MP HEIC in ~0.35 s CPU but peaked at 248–349 MB RSS, above the
256 MB Edge Function limit; Storage image transformations accept HEIC but are Pro-only ($25/month). Client-side
conversion is fast, free, and keeps HEIC off the server entirely.

## 6. Public-site integration

- `/{lang}/puppies/` and the home "available puppies" section keep their static shell (copy, empty state, litters
  banner, CTA band). A vanilla-TypeScript island fetches `public_listings_json()` (8 s timeout, `no-store`) and
  renders cards by cloning an Astro-rendered `<template>` of the existing `PuppyCard` markup, so the design stays
  single-sourced. Images use `<img srcset="…-480 480w, …-1600 1600w" sizes width height>` from the DB.
- States: skeleton (3 placeholder cards) → listings / **empty** ("no puppies right now" + litters WhatsApp CTA, only
  after a successful fetch with zero rows) / **error** ("couldn't load the puppies right now" + WhatsApp CTA, never
  claiming there are none). Malformed rows are skipped, not fatal. Image load failures fall back to a neutral tile.
- Freshness: every page view fetches live data; nothing is cached longer than the request.
- Static content collection: the `puppies` collection is retired from production paths; the demo fixtures remain only
  for layout review of the card template (dev/`SB_INCLUDE_DEMO`), and the CI `demo-listings` project moves to a
  mocked API response (Playwright route interception), so pull requests need no Supabase credentials.

## 7. Puppy detail and routing on GitHub Pages

GitHub Pages cannot serve `/puppies/<uuid>/`. Chosen pattern: one static page per locale,
`/{lang}/puppies/view/?id=<uuid>`, whose island fetches `public_listing_json(id)` (published only) and renders the
existing detail layout (gallery + lightbox, facts, WhatsApp CTA with the name prefilled). Shareable, back-button
friendly, works on Pages; unknown or unpublished id → "listing not found" with a link to the catalogue.
SEO trade-off, documented: dynamic cards and details are not in the static HTML; Google generally renders them, but
WhatsApp/Facebook link previews show the generic site image, not the puppy. Listings are short-lived, so this is
accepted rather than adding a server. All existing static routes stay unchanged.

## 8. Admin UX (mobile-first, `/self-beauty/admin/`)

Design language: same tokens (ivory, burgundy actions, gold hairlines), Arial, 48 px targets, existing button/chip
classes; utility over decoration. Hebrew default; Russian/English admin strings come from the same dictionaries
(cheap, so included). Hash-routed single page: `#/` list, `#/new`, `#/edit/<id>`.

- **Login**: email, password (show/hide), one generic error, loading state, "forgot password" link.
- **גורים באתר (list)**: filter chips _all / published / drafts / archived_; each row = 480 px thumb, name, breed,
  status pill, published switch, "updated" date, **[עריכה]**. Tapping the status pill opens a bottom sheet with the
  four statuses (Available → Reserved takes two taps and shows _Saving… → Saved_). Sticky **הוספת גור חדש** button.
- **Form** (single page, sectioned, validates on blur, unsaved-changes guard): Basics (name, breed select, sex,
  birth date with native picker, status, show prospect) · Hebrew text (description, pedigree, parents) ·
  Russian / English (collapsed; "missing translation" indicator) · **Photos** (`0/3`, add up to the remaining count,
  per-photo progress, ✓/✗, remove, replace, ▲/▼ reorder, "main photo" marker = position 1) · Visibility
  (published switch disabled with a reason until the publish gate is met; featured) · Save. States shown exactly:
  _Saving… / Saved / Published / Failed to save (retry)_; nothing claims success before the database confirms.
- **Archive** is the default destructive action (confirmation sheet); permanent delete lives inside the archived view
  behind a typed confirmation. **Preview** opens the public detail page (published) or an in-admin preview (draft).
- Accessibility: labels, focus rings, `aria-live` status, dialogs with focus trap, reduced motion, keyboard reorder.

## 9. HEIC spike results (Phase C, real files from the vault)

| Path                                 | Input                                                              | Result                                                                            |
| ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Node/WASM (Edge Function proxy)      | 6.3 MB HEIC 4000×1848, EXIF 6                                      | upright 1848×4000 decoded in 344 ms, JPEG 1600 in +86 ms, **peak RSS 248–349 MB** |
| Chromium, `libheif-js` ESM bundle    | same file                                                          | upright, 739×1600 JPEG 204 KB + 480 px thumb 25 KB in 407 ms; JS heap 45 MB       |
| Chromium at 4× CPU throttle          | same                                                               | 1.46 s total — acceptable for a phone with a progress indicator                   |
| Validation (`file-type` + `jpeg-js`) | real JPG/PNG/HEIC, renamed `.exe`→`.jpg`, truncated JPG, SVG, HTML | real files accepted; `.exe`, truncated, SVG, HTML rejected; JPEG decode 72 ms     |

Conclusion: convert in the browser, validate on the server; never rely on Edge Functions for HEIC.

## 10. Free plan requirements (verified 2026-09-06 on supabase.com/pricing and docs)

Free: $0, 2 active projects, 500 MB database, 1 GB storage, 5 GB egress + 5 GB cached egress, 50k MAU,
500k Edge Function invocations, **paused after 1 week of inactivity**, no backups, 1-day logs, no image transformations.
Edge Functions: 256 MB memory, 2 s CPU, 150 s wall. Auth built-in email: 2 emails/hour. Pro is $25/month (no pausing,
daily backups, 100 GB storage, transformations). No credit card is required for the free plan; this will be confirmed
on the signup screen before proceeding.

Expected usage: < 5 MB database, < 100 MB storage for 50 listings, egress far below 5 GB. Pause mitigation: visitor
traffic to the puppies page counts as activity, plus a weekly GitHub Actions ping of the public RPC. If a pause ever
happens, the public page shows the graceful error state and the admin cannot log in until the project is restored
from the dashboard (documented runbook).

## 11. Deployment, CI, secrets, backups

- New repo folders: `supabase/` (`config.toml`, `migrations/*.sql`, `functions/register-image/`), `src/pages/admin/`,
  `src/admin/` (Preact app), `src/lib/public-listings.ts`, `tests/security/` (RLS negative tests).
- Public env (bundled, safe): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` — repository **variables**.
- Secrets (never bundled): `SUPABASE_ACCESS_TOKEN` (CLI: migrations + function deploy), `SUPABASE_DB_PASSWORD`,
  `SUPABASE_PROJECT_REF` — GitHub Actions secrets for a manual/`main`-only `supabase-deploy` job; locally in a
  git-ignored `.env.supabase`. The service-role key is used only inside the Edge Function runtime (set with
  `supabase secrets`) and never leaves Supabase.
- CI on pull requests: unchanged public checks + admin typecheck/unit tests + Playwright with **mocked** Supabase
  responses (route interception) — no credentials. RLS negative tests run against the Supabase CLI local stack
  (Docker) in a separate job, and against production once after each migration (manual workflow).
- Backups/portability: nightly `supabase db dump` (SQL) uploaded as a GitHub Actions artifact (90 days) and an image
  manifest + download of `listing-media` objects; restore = `psql < dump` + copy objects. The public adapter is one
  small module, so moving off Supabase means replacing one fetch function and the auth client.

## 12. Risks and trade-offs

- Free-tier pause after 7 idle days → graceful public error state + weekly ping; owner restores from dashboard if needed.
- Client-side processing depends on the owner's browser (iOS Safari): WASM HEIC decode is proven in Chromium; will be
  verified on the owner's iPhone in Phase H (Safari also hands over JPEG for HEIC in most picker flows).
- Unguessable-URL privacy for unpublished images (not enumerable, never linked) instead of signed URLs — accepted.
- No originals stored — re-upload needed for future higher-resolution derivatives.
- SEO for listings is client-rendered — accepted for short-lived content; business pages stay static.
- Single owner account; adding a second admin is a one-row insert, not a policy change.

## 13. External resources to be created (only after approval)

1. Supabase account (yours, free plan) and one project `self-beauty`, region `eu-central-1` (Frankfurt, closest to Israel).
2. Inside it: Auth settings (sign-ups off, Site URL `https://avivg7.github.io/self-beauty/admin/`), the owner user,
   database schema/RLS via migrations, bucket `listing-media`, Edge Function `register-image`, function secrets.
3. GitHub: two repository variables (URL, anon key) and three secrets (access token, DB password, project ref).
   Nothing paid, no card, no other third-party service.
