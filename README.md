# Self Beauty — website

Premium pedigree dog kennel and professional grooming studio in Bat Yam, Israel. Trilingual (Hebrew default,
Russian, English), mobile-first, static, deployed to GitHub Pages. Two parts: the public website (this repo, built)
and the owner admin (architecture gated; see below).

## Stack

Astro 7 · TypeScript (strictest) · plain CSS with design tokens · system Arial typography (no web fonts) · Astro content collections · sharp image pipeline · Vitest · Playwright + axe · ESLint · Prettier ·
GitHub Actions → GitHub Pages.

Details and reasoning: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) ·
[docs/MEDIA.md](docs/MEDIA.md) · product spec [docs/superpowers/specs/2026-09-05-self-beauty-design.md](docs/superpowers/specs/2026-09-05-self-beauty-design.md).

## Folder structure

```
.github/workflows/   ci.yml (lint, typecheck, unit, build, links, e2e) · deploy.yml (GitHub Pages)
docs/                architecture, design system, media pipeline, spec
images/ videos/      SOURCE VAULT — originals, git-ignored, never modified
public/              favicons, OG image, manifest, media/video (committed MP4 tiers + posters)
scripts/             media/ingest.mjs, media/brand.mjs, media/manifest.json, check-links.mjs
src/
  assets/media/      committed web masters (jpg/png) → Astro generates AVIF/WebP srcsets
  assets/brand/      transparent logo
  components/        Astro components (Header, Footer, Picture, GalleryGrid, Lightbox, PuppyCard, …)
  content/           puppies/, litters/, testimonials/ (JSON, Zod-validated in content.config.ts)
  data/              site.ts (business facts), media.ts (catalogue), video.generated.json
  i18n/              he.ts (canonical), ru.ts, en.ts, locales.ts, index.ts
  layouts/Base.astro head, SEO, JSON-LD, chrome
  lib/               urls.ts, contact.ts (WhatsApp/tel), age.ts, listings.ts, paths.ts
  pages/             index.astro (language gateway), 404.astro, robots.txt.ts, [lang]/…
  scripts/           nav.ts, a11y.ts, lightbox.ts, filters.ts, reveal.ts (vanilla TS islands)
  styles/            tokens.css, global.css
tests/unit/          Vitest · tests/e2e/ Playwright
```

## Local setup

Requires Node ≥ 22.12 (`.nvmrc` says 24). On a machine without it: `brew install node@24` or `nvm use`.

```
npm ci
npm run dev            # http://localhost:4321/self-beauty/he/
npm run build          # dist/
npm run preview
```

Environment (all optional; see `.env.example`):

| Variable           | Default                    | Purpose                                                                                                |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `SITE`             | `https://avivg7.github.io` | Absolute origin for canonical/OG/sitemap                                                               |
| `BASE`             | `/self-beauty`             | Path prefix (GitHub project page). Use `/` for a custom domain.                                        |
| `SB_INCLUDE_DEMO`  | unset                      | `1` includes records marked `demo: true` (dev always includes them)                                    |
| `SB_LISTING_LIMIT` | unset                      | Dev only (needs demo mode): truncate the puppies list to n items to review the 1/2/3/6-listing layouts |

## Commands

| Command                           | What it does                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`                  | lint → `astro check` → unit tests → build → link check (what CI runs)                                                                                                                                                                                                                                  |
| `npm run test:e2e`                | Playwright on the production build (served by `scripts/serve-dist.mjs`, which mimics GitHub Pages: base path, trailing slashes, real 404, gzip) at 360/390/768/1440 + axe on every page/locale + 320–1440 overflow and tap-target checks. `SHOTS=1` saves full-page screenshots to `artifacts/shots/`. |
| `npm run serve`                   | Serve `dist/` locally exactly as GitHub Pages would (`node scripts/serve-dist.mjs [port]`)                                                                                                                                                                                                             |
| `npm run media:ingest`            | Convert new originals (HEIC/HEVC → web masters, MP4 tiers, posters). See docs/MEDIA.md.                                                                                                                                                                                                                |
| `node scripts/media/brand.mjs`    | Regenerate favicons, OG image, web manifest                                                                                                                                                                                                                                                            |
| `npm run lint` / `npm run format` | ESLint (astro + a11y rules) / Prettier                                                                                                                                                                                                                                                                 |

## Internationalisation

Every route exists as `/he/…`, `/ru/…`, `/en/…`. Hebrew is the default and is RTL. The root `/` is a gateway that
sends first-time visitors to Hebrew and returning visitors to the language they explicitly chose. Dictionaries are
typed against the Hebrew one, so a missing translation fails `astro check` and the unit tests. Add copy in
`src/i18n/he.ts` first, then mirror it in `ru.ts` and `en.ts`.

## Content

- **Puppies**: `src/content/puppies/*.json`. No price field exists. Max 3 images. `published: false` hides a
  listing; `demo: true` excludes it from production builds entirely. A listing is published only once the owner has
  verified it is current (status, names, photos); `scripts/check-links.mjs` fails the build if demo content leaks.
- **Planned litters**: `src/content/litters/*.json`.
- **Family stories**: `src/content/testimonials/*.json` — only real stories; translations are labelled as such.
- **Business facts**: `src/data/site.ts`. Empty strings are TODOs, never placeholders that render.

## Media pipeline

Originals stay in `images/` and `videos/` (git-ignored). `npm run media:ingest` writes committed web derivatives;
the build only ever sees JPEG/PNG/MP4. Rationale and per-file decisions in [docs/MEDIA.md](docs/MEDIA.md) and
`scripts/media/manifest.json`.

## Deployment (GitHub Pages)

`deploy.yml` runs on pushes to `main`: CI gates → build with the Pages base path → `actions/deploy-pages`.
Repository settings → Pages → Source: **GitHub Actions**. No secrets are needed.

Custom domain later: add `public/CNAME`, set repository variables `SITE=https://example.co.il` and `BASE=/`,
configure DNS. Nothing in the code changes.

## Admin (owner interface) — Lean V1

Built, awaiting the production Supabase project. Design: [docs/superpowers/specs/2026-09-06-admin-supabase-design.md](docs/superpowers/specs/2026-09-06-admin-supabase-design.md);
operations: [docs/RUNBOOK.md](docs/RUNBOOK.md); upload rules: [docs/ADMIN_UPLOAD_SPEC.md](docs/ADMIN_UPLOAD_SPEC.md).

- `/admin/` is a Preact island (`src/admin/`) on the same GitHub Pages site: Supabase Auth (email + password, one
  owner, sign-ups disabled, `admins` allowlist), Postgres with RLS, two storage buckets (private derivatives, public
  copies of published listings only). Hebrew RTL first, Russian/English switch, Arial, iPhone-sized layout.
- Owner flow: **גורים באתר → הוספת גור → up to 3 photos (HEIC converted in the browser) → פרסום**; status changes
  (זמין → שמור) are live on the next page view. Unpublish, archive/restore and permanent delete live in the status
  sheet. No commit, push, Action or rebuild is ever needed for content.
- Public site reads one read-only RPC (`public_listings_json`) with the publishable key: `src/lib/public-listings.ts`,
  `src/components/LivePuppies.astro`, detail at `/{lang}/puppies/view/?id=…`. Backend down → friendly error with the
  WhatsApp CTA (never "no puppies"); paused free project → same, see the runbook.
- Schema: `supabase/migrations/` (version-controlled, applied manually with the Supabase CLI — no DB credentials in
  GitHub). Tests: `npm run test:db` against the local stack (RLS negatives, 3-image invariant, reorder, exact RPC keys);
  `npm run test:e2e` covers the island and the admin against a mocked backend.
- Build-time values: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (repository variables; public by design).
  Until they exist, a build has no dynamic listings and the puppies section shows the honest empty state (same as
  today); the admin shows the connect error. Recurring cost: **$0** (Supabase free plan, no card).

## Security considerations

Static site, no forms, no cookies, no third-party scripts, no analytics, no web fonts. External links use
`rel="noopener"`. The only outbound integrations are `tel:` and `wa.me` deep links. Secrets never live in this repo.

## Testing

See "Commands". CI fails on lint, type, unit, build, broken links, serious/critical axe violations, or a failing
Playwright flow (navigation, language switch, RTL, CTAs, gallery keyboard flow, accessibility panel, overflow at
nine widths, tap-target sizes).

## Known TODOs

| ID       | Item                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TODO-001 | Resolved: Self Beauty was established in 2014 (owner confirmed; matches the logo). Owner's professional education year is 2016. Guarded by `tests/unit/facts.test.ts`. |
| TODO-002 | Verified kennel club / association URL (`site.kennelClubUrl`).                                                                                                         |
| TODO-003 | Real grooming before/after material for the grooming portfolio.                                                                                                        |
| TODO-004 | Confirm usage rights for the two watermarked show photos.                                                                                                              |
| TODO-005 | Owner display name (if she wants it shown).                                                                                                                            |
| TODO-006 | Current Bichon litter: confirm photos, add names/birth dates through the admin when it exists.                                                                         |
| TODO-007 | Admin live in production (Lean V1, 2026-09-06). Remaining: real-iPhone HEIC QA checklist in docs/VERIFICATION.md (not a gate).                                         |
| TODO-008 | Higher-resolution hero photo (current crop is 740×925).                                                                                                                |
