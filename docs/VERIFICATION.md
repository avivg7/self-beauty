# Verification record — public website

Date: 2026-09-05 (hardening pass) · Build: local `main` (pre-push) · Base path `/self-beauty/`

## Automated gates (all green)

| Gate                                 | Result                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint (astro + jsx-a11y strict)     | 0 errors                                                                                                                                |
| `astro check` (TypeScript strictest) | 0 errors                                                                                                                                |
| Vitest unit                          | 28 passed (i18n parity/placeholders, WhatsApp/tel builders, age, URLs, media manifest ↔ files ↔ catalogue, content honesty rules)       |
| Production build                     | 35 pages, AVIF/WebP/JPEG srcsets generated                                                                                              |
| Link checker                         | 2,179 references, 0 broken                                                                                                              |
| Playwright e2e                       | 222 passed, 1 skipped by design (mobile-menu test on desktop) across mobile-360, mobile-390, tablet-768, desktop-1440, `a11y`, `widths` |
| axe (WCAG 2.x A/AA + best-practice)  | 0 serious/critical on 11 pages × 3 locales                                                                                              |
| Overflow / tap targets               | 320, 360, 375, 390, 414, 430, 768, 1024, 1440 px: no horizontal overflow; header and sticky-bar targets ≥ 44 px                         |

## Lighthouse (production build served with gzip, Chrome headless, after the Arial switch)

| Page                           | Form factor | Perf | A11y | Best practices | SEO | LCP   | CLS |
| ------------------------------ | ----------- | ---- | ---- | -------------- | --- | ----- | --- |
| /he/                           | mobile      | 100  | 100  | 100            | 100 | 1.6 s | 0   |
| /he/                           | desktop     | 100  | 100  | 100            | 100 | 0.4 s | 0   |
| /he/puppies/                   | mobile      | 100  | 100  | 100            | 100 | 1.5 s | 0   |
| /he/puppies/                   | desktop     | 100  | 100  | 100            | 100 | 0.4 s | 0   |
| /he/puppies/bichon-frise-2026/ | mobile      | 100  | 100  | 100            | 100 | 1.6 s | 0   |
| /he/shows/                     | mobile      | 98   | 100  | 100            | 100 | 2.5 s | 0   |
| /he/shows/                     | desktop     | 100  | 100  | 100            | 100 | 0.5 s | 0   |
| /he/gallery/                   | mobile      | 100  | 100  | 100            | 100 | 1.6 s | 0   |
| /ru/grooming/                  | mobile      | 100  | 100  | 100            | 100 | 1.7 s | 0   |
| /en/contact/                   | mobile      | 100  | 100  | 100            | 100 | 1.3 s | 0   |

Mobile numbers use Lighthouse's simulated slow-4G throttling. Removing web fonts cut ~150–230 KB per page and
brought mobile LCP from 2.6–3.7 s down to 1.3–2.5 s. Nothing was tuned for the test.

## Manual review (screenshots in `artifacts/shots/` via `SHOTS=1 npm run test:e2e` and `artifacts/review/` via `node scripts/review-shots.mjs`)

- Hebrew RTL, Russian and English reviewed at 390 px and 1440 px on home, puppies, puppy detail, shows,
  gallery, grooming, about, stories, contact, litters, accessibility.
- Keyboard: skip link → main; header controls; menu sheet focus trap + Escape; lightbox arrows (mirrored in RTL), Home/End, Escape returns focus.
- Independent reviewer pass (2026-09-05): five findings fixed — local lint ignores for demo builds, tests no longer assume a listing exists, demo-fixture guard made bidirectional, screen-reader status text on cards, filter-aware grid centring.
- Hardening pass (2026-09-05): status chip rebuilt as a content-sized corner pill and verified in he/ru/en for available / reserved / coming soon / planned litter / placed; listing layouts reviewed with 1, 2, 3 and 6 demo listings at 320–1440 px; English card labels no longer clip; accessibility dialog centred.
- Fixed during the first review: oversized inline icons (scoped-style/child-component mismatch), phone numbers wrapping at
  hyphens, ragged gallery masonry, single puppy card in a 3-column grid, lone 40 px header CTA, 1024 px icon-button shrink,
  full-row gallery crops cutting faces, heading order on the puppies list.

## Deployment (2026-09-05)

- Repository: https://github.com/avivg7/self-beauty (public, branch `main`, no force pushes, history intact)
- GitHub Pages: source "GitHub Actions" (enabled through the API, `build_type: workflow`), site https://avivg7.github.io/self-beauty/
- First deploy run: all four jobs succeeded — lint/typecheck/unit/build/links, Playwright with axe (including the demo-listings project), Build for Pages, Deploy.
- Live checks: every locale route and the 404 return the right status; root gateway refreshes to `/self-beauty/he/`; hreflang and canonical are absolute; every asset reference is under `/self-beauty/`; JS, AVIF/WebP/JPEG images, logo and MP4 (range requests) all 200/206; gzip on; JSON-LD `foundingDate` 2014; Arial token.
- Live Lighthouse (mobile / desktop): home 100/100, puppies 100, shows 100, Russian home 100, English grooming 100; all four categories 100.
- The production e2e suites (navigation, i18n, conversion, gallery, axe, widths) were run against the live URL with `E2E_BASE_URL`.

## Production content (final gate, 2026-09-05)

| Content                                                                                   | Production build                  | Why                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bichon Frise listing (`bichon-frise-2026`)                                                | **Excluded** (`published: false`) | Owner has not yet confirmed it is current or that the photos show this litter (TODO-006). The puppies page and home show the honest empty state with the planned-litter WhatsApp CTA. |
| 7 demo fixtures (`demo-*.json`)                                                           | **Excluded**                      | `demo: true`; guarded by unit test (filename ⇔ flag ⇔ label), e2e (no demo markup in production), and the dist guard in `check-links.mjs`.                                            |
| Watermarked show photos (`owner-yorkie-stage`, `owner-yorkie-portrait`)                   | **Excluded**                      | Usage rights unconfirmed (TODO-004); `needsReview` in the catalogue, dist guard fails the build if referenced. Source files untouched.                                                |
| Excluded source photos (ChatGPT-processed child photo, newborn litter, cluttered pen)     | **Excluded**                      | Documented in the manifest, never processed, never deleted.                                                                                                                           |
| Everything else: 21 photos, 3 videos, logo, owner portrait, the real Russian family story | **Included**                      |                                                                                                                                                                                       |

## Known limitations

- Mobile LCP is bounded by the hero photograph and font fetch on slow 4G; a higher-resolution hero (TODO-008) would not change this.
- The Shih Tzu ring video is 478×850 source quality.
- Grooming portfolio shows an honest "in preparation" state (TODO-003).

## Admin + live listings (Lean V1, 2026-09-06)

Automated:

- `npm run check` / `npm run lint` / `npm run test:unit` — green with the admin, island and public-listings modules.
- `npm run test:e2e` — **275/275 passed on 2026-09-06** (4 device projects + a11y + widths + demo). Builds against
  `https://supabase.mock.invalid`, then Playwright intercepts every request:
  live cards / detail / empty / error / Russian fallback / home featured (`tests/e2e/live.spec.ts`); admin login
  (bad credentials, backend down), owner workflow to "תמונות — 0/3", 3/3 disables adding, status sheet
  (`tests/e2e/admin.spec.ts`).
- `npm run test:db` — **14/14 passed on 2026-09-06** against the local Supabase stack (`npx supabase start`): anon has no table access
  and no writes, cannot call admin functions, cannot list buckets or read private objects; a non-admin user sees nothing;
  the owner's CRUD, `NO_IMAGE` publish gate, 3-image invariant, `reorder_images` (stale/duplicate/oversized sets
  rejected), `updated_at` trigger, retry-safe public upsert, exact RPC key list (no `internal_note`, no admin id),
  archive constraint, cascade delete.

Production end-to-end (2026-09-06, live site + live Supabase project `qqmtwixiyycgxawirfic`, as the real owner,
headless iPhone-sized Chromium; screenshots in `artifacts/prod-e2e/`):

| Step                             | Result                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Login                            | "גורים באתר"                                                                         |
| Create puppy                     | draft saved, redirected to its edit page                                             |
| Upload 3 JPGs                    | "תמונות — 3/3", add disabled                                                         |
| Publish                          | "מפורסם באתר"; public card with chip "זמין", photo served, RPC returns 1 row         |
| Available → Reserved, Save       | public chip "שמור", RPC status `reserved`; no GitHub deployment involved             |
| Unpublish                        | public empty state, RPC 0 rows; public bucket emptied, 6 private derivatives kept    |
| Archive / Restore                | "בארכיון" → "לא מפורסם", still hidden from the site                                  |
| Permanent delete (typed confirm) | row + 3 image rows gone, private and public objects gone; admins = 1, auth users = 1 |
| After deletion                   | all public pages 200, RPC `[]`, live empty state, admin login page 200               |

Also verified on the real project: `npm run test:db` with `SB_PROD_VERIFY=1` → 14/14 (RLS, admin permissions, public
RPC key list, 3-image invariant, per-bucket storage policies), using the publishable/secret key model.

**Only remaining manual QA item**: the physical iPhone HEIC checklist below (not a release gate).

Physical iPhone HEIC checklist (the owner's phone, Safari, real HEIC photos):

| #   | Check                                       | Expected                                                                    |
| --- | ------------------------------------------- | --------------------------------------------------------------------------- |
| H1  | Add a normal iPhone HEIC photo              | converts in ≤ 3 s, upright, appears as tile                                 |
| H2  | Portrait photo taken with the phone rotated | upright on the site (orientation applied)                                   |
| H3  | Large (12 MP+, ~4–8 MB) HEIC                | converts; derivative ≤ 2 MB                                                 |
| H4  | Three photos at once                        | all three tiles, add button disabled at 3/3                                 |
| H5  | Replace the main photo                      | new image id, main chip on the new tile, old public copy gone after publish |
| H6  | Publish → open site in Safari               | card and detail show within one reload; chip/status correct                 |
| H7  | זמין → שמור → Save                          | site reflects it on the next page view                                      |
| H8  | Airplane mode → any action                  | clear error, nothing half-saved, retry works after reconnecting             |
