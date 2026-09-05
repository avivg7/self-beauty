# Verification record — public website

Date: 2026-09-05 · Build: local `main` (pre-push) · Base path `/self-beauty/`

## Automated gates (all green)

| Gate | Result |
|---|---|
| ESLint (astro + jsx-a11y strict) | 0 errors |
| `astro check` (TypeScript strictest) | 0 errors |
| Vitest unit | 28 passed (i18n parity/placeholders, WhatsApp/tel builders, age, URLs, media manifest ↔ files ↔ catalogue, content honesty rules) |
| Production build | 35 pages, AVIF/WebP/JPEG srcsets generated |
| Link checker | 2,179 references, 0 broken |
| Playwright e2e | 222 passed, 1 skipped by design (mobile-menu test on desktop) across mobile-360, mobile-390, tablet-768, desktop-1440, `a11y`, `widths` |
| axe (WCAG 2.x A/AA + best-practice) | 0 serious/critical on 11 pages × 3 locales |
| Overflow / tap targets | 320, 360, 375, 390, 414, 430, 768, 1024, 1440 px: no horizontal overflow; header and sticky-bar targets ≥ 44 px |

## Lighthouse (production build served with gzip, Chrome headless)

| Page | Form factor | Perf | A11y | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|---|
| /he/ | mobile | 93 | 100 | 100 | 100 | 3.1 s | 0 |
| /he/ | desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 |
| /he/shows/ | mobile | 90 | 100 | 100 | 100 | 3.7 s | 0 |
| /he/shows/ | desktop | 100 | 100 | 100 | 100 | 0.7 s | 0 |
| /he/gallery/ | mobile | 91 | 100 | 100 | 100 | 3.2 s | 0 |
| /ru/grooming/ | mobile | 95 | 100 | 100 | 100 | 2.7 s | 0 |
| /en/puppies/bichon-frise-2026/ | mobile | 97 | 100 | 100 | 100 | 2.6 s | 0 |
| /he/contact/ | mobile | 95 | 100 | 100 | 100 | 2.6 s | 0.001 |

Mobile numbers use Lighthouse's simulated slow-4G throttling. Nothing was tuned for the test: no lazy hero, no
hidden content, no user-agent tricks.

## Manual review (screenshots in `artifacts/shots/` via `SHOTS=1 npm run test:e2e`)

- Hebrew RTL, Russian and English reviewed at 390 px and 1440 px on home, puppies, puppy detail, shows,
  gallery, grooming, about, stories, contact, litters, accessibility.
- Keyboard: skip link → main; header controls; menu sheet focus trap + Escape; lightbox arrows (mirrored in RTL), Home/End, Escape returns focus.
- Fixed during review: oversized inline icons (scoped-style/child-component mismatch), phone numbers wrapping at
  hyphens, ragged gallery masonry, single puppy card in a 3-column grid, lone 40 px header CTA, 1024 px icon-button shrink,
  full-row gallery crops cutting faces, heading order on the puppies list.

## Known limitations

- Mobile LCP is bounded by the hero photograph and font fetch on slow 4G; a higher-resolution hero (TODO-008) would not change this.
- The Shih Tzu ring video is 478×850 source quality.
- Grooming portfolio shows an honest "in preparation" state (TODO-003).
