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

| Page | Form factor | Perf | A11y | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|---|
| /he/ | mobile | 100 | 100 | 100 | 100 | 1.6 s | 0 |
| /he/ | desktop | 100 | 100 | 100 | 100 | 0.4 s | 0 |
| /he/puppies/ | mobile | 100 | 100 | 100 | 100 | 1.5 s | 0 |
| /he/puppies/ | desktop | 100 | 100 | 100 | 100 | 0.4 s | 0 |
| /he/puppies/bichon-frise-2026/ | mobile | 100 | 100 | 100 | 100 | 1.6 s | 0 |
| /he/shows/ | mobile | 98 | 100 | 100 | 100 | 2.5 s | 0 |
| /he/shows/ | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 |
| /he/gallery/ | mobile | 100 | 100 | 100 | 100 | 1.6 s | 0 |
| /ru/grooming/ | mobile | 100 | 100 | 100 | 100 | 1.7 s | 0 |
| /en/contact/ | mobile | 100 | 100 | 100 | 100 | 1.3 s | 0 |

Mobile numbers use Lighthouse's simulated slow-4G throttling. Removing web fonts cut ~150–230 KB per page and
brought mobile LCP from 2.6–3.7 s down to 1.3–2.5 s. Nothing was tuned for the test.

## Manual review (screenshots in `artifacts/shots/` via `SHOTS=1 npm run test:e2e` and `artifacts/review/` via `node scripts/review-shots.mjs`)

- Hebrew RTL, Russian and English reviewed at 390 px and 1440 px on home, puppies, puppy detail, shows,
  gallery, grooming, about, stories, contact, litters, accessibility.
- Keyboard: skip link → main; header controls; menu sheet focus trap + Escape; lightbox arrows (mirrored in RTL), Home/End, Escape returns focus.
- Hardening pass (2026-09-05): status chip rebuilt as a content-sized corner pill and verified in he/ru/en for available / reserved / coming soon / planned litter / placed; listing layouts reviewed with 1, 2, 3 and 6 demo listings at 320–1440 px; English card labels no longer clip; accessibility dialog centred.
- Fixed during the first review: oversized inline icons (scoped-style/child-component mismatch), phone numbers wrapping at
  hyphens, ragged gallery masonry, single puppy card in a 3-column grid, lone 40 px header CTA, 1024 px icon-button shrink,
  full-row gallery crops cutting faces, heading order on the puppies list.

## Known limitations

- Mobile LCP is bounded by the hero photograph and font fetch on slow 4G; a higher-resolution hero (TODO-008) would not change this.
- The Shih Tzu ring video is 478×850 source quality.
- Grooming portfolio shows an honest "in preparation" state (TODO-003).
