// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import preact from '@astrojs/preact';

/**
 * Deployment target configuration.
 *  - GitHub project page:  SITE=https://<user>.github.io  BASE=/<repo>
 *  - Custom domain later:  SITE=https://example.co.il      BASE=/   (+ public/CNAME)
 * Both are read from the environment so no code change is needed to move.
 */
const SITE = process.env.SITE ?? 'https://avivg7.github.io';
const BASE = process.env.BASE ?? '/self-beauty';

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  trailingSlash: 'always',
  // HTML-aware whitespace handling keeps spaces between inline elements in mixed RTL/LTR copy.
  compressHTML: true,
  i18n: {
    locales: ['he', 'ru', 'en'],
    defaultLocale: 'he',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false, // the root page is a hand-written language gateway
    },
  },
  integrations: [
    // Preact is used by the /admin/ island only; public pages stay framework-free.
    preact(),
    sitemap({
      i18n: {
        defaultLocale: 'he',
        locales: { he: 'he-IL', ru: 'ru', en: 'en' },
      },
      filter: (page) => !page.includes('/admin/') && !page.includes('/puppies/view/'),
    }),
  ],
  image: {
    // Responsive images with automatic srcset/sizes; the layout attribute is set per usage.
    responsiveStyles: true,
  },
  build: {
    // GitHub Pages caches assets for only 10 minutes, so an external stylesheet buys little; inlining
    // removes a render-blocking round trip on every page.
    inlineStylesheets: 'always',
  },
  vite: {
    build: { assetsInlineLimit: 2048 },
  },
});
