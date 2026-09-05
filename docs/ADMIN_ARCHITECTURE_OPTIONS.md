# Admin backend — architecture gate (Phase 4)

Status: superseded by the final design in `docs/superpowers/specs/2026-09-06-admin-supabase-design.md` (Stage 2). Nothing external has been created yet.

## The problem in one paragraph

GitHub Pages serves static files only. The owner admin needs: a real login, a database for listings, file storage
for photos, and a server that validates uploads (allowlist, MIME, magic bytes, 10 MB, ≤3 images per listing),
converts phone photos (HEIC/HEIF) to web formats, strips metadata, and produces derivatives — none of which a browser
can be trusted to do. So an external backend is required, and its credentials must never reach the browser.

## Requirements every option must satisfy

- Email + password (or equivalent) login for one owner; no self-signup.
- CRUD on listings with per-language fields; publish/unpublish; archive instead of delete.
- Uploads: JPG/JPEG/PNG/HEIC/HEIF (WebP optional), ≤10 MB, ≤3 per listing, enforced client **and** server side;
  magic-byte validation; EXIF orientation applied; metadata stripped; derivatives generated; generated object keys.
- The public site must keep working — including images — if the backend is paused, rate-limited, or down.
- No secrets in the repository or the browser. Least-privilege keys server-side only.
- Free tier without a credit card, or an explicitly approved small cost.

## Option A — Supabase (Postgres + Auth + Storage + Edge Functions) ← recommended

| Aspect                     | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                       | Supabase Auth, email + password, sign-ups disabled, one owner user created by us; password reset by email. Session JWT in the browser (normal; it is the owner's own session, not a secret).                                                                                                                                                                                                                                                                                                               |
| Database                   | Postgres table `listings` (+ `listing_images`). Row Level Security: anonymous role may `select` only `published = true`; owner role may insert/update; deletes are soft (`archived_at`).                                                                                                                                                                                                                                                                                                                   |
| Storage                    | Private bucket `incoming` (owner uploads originals via signed upload URL); public bucket `media` (derivatives only). Object keys are UUIDs; original filenames are stored as metadata, never as paths.                                                                                                                                                                                                                                                                                                     |
| Validation & processing    | Edge Function `process-upload`: checks owner JWT, listing image count (in a transaction), size, extension, MIME, magic bytes, decodes the image (rejects anything that does not decode), applies orientation, strips metadata, writes 1600 px display + 480 px thumb (JPEG/WebP) to `media`, deletes the original. HEIC/HEIF: converted **in the admin UI** (libheif WASM) before upload so the owner's iPhone photos "just work"; the function still only accepts what it can decode and validate itself. |
| GitHub Pages compatibility | Full. A Supabase Database Webhook (server-side secret) triggers `repository_dispatch`; the deploy workflow fetches published listings with the anon key, **downloads the derivatives into the repo/build**, and publishes. The public site therefore never depends on Supabase at runtime.                                                                                                                                                                                                                 |
| Security model             | RLS + server-side function; anon key exposes only published rows; storage policies deny public writes; all secrets live in Supabase and GitHub Actions secrets.                                                                                                                                                                                                                                                                                                                                            |
| Cost                       | Free tier: 500 MB DB, 1 GB storage, 5 GB egress, 500k function calls. No card required.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Free-tier implications     | Projects **pause after 7 days without activity**. Mitigation: a weekly scheduled GitHub Action pings the API (counts as activity) and the public site is self-contained anyway. Pro is $25/month if ever needed.                                                                                                                                                                                                                                                                                           |
| Complexity                 | Medium: schema + RLS + one Edge Function + admin UI + sync workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Owner usability            | High: familiar email/password login, phone-friendly admin, "Publish" reflects on the site within ~2 minutes.                                                                                                                                                                                                                                                                                                                                                                                               |
| Vendor dependency          | Medium-low: plain Postgres, exportable; storage is S3-compatible.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Backups                    | Free tier has no automatic backups → weekly GitHub Action runs `pg_dump` (via connection string secret) and stores it as an artifact; derivatives already live in the repo.                                                                                                                                                                                                                                                                                                                                |
| Limitations                | Edge Function CPU limits make server-side HEIC decoding unreliable → client-side conversion with strict server validation (documented above). Requires the owner (or you) to create a Supabase account (GitHub or email sign-in).                                                                                                                                                                                                                                                                          |

## Option B — Cloudflare (Workers + D1 + R2 + Access)

| Aspect                     | Detail                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                       | Cloudflare Access (Zero Trust, free ≤ 50 users): one-time PIN by email, no password to manage; the Worker verifies the Access JWT.                                    |
| Database / Storage         | D1 (SQLite, 5 GB free) and R2 (10 GB free, no egress fees).                                                                                                           |
| Processing                 | Worker + Photon WASM: decode JPEG/PNG/WebP, resize, strip metadata, magic-byte checks. No HEIC decoding in Workers → client-side conversion as in A.                  |
| GitHub Pages compatibility | Same pattern as A (webhook → rebuild, derivatives copied in).                                                                                                         |
| Cost                       | Free; no pausing.                                                                                                                                                     |
| Complexity                 | Medium-high: more hand-written auth/API surface (Access policy, JWT verification, D1 migrations); Access on a `workers.dev` hostname needs verification during setup. |
| Owner usability            | High (email code login), but a second vendor login (Cloudflare) for us to administer.                                                                                 |
| Backups                    | D1 time-travel (30 days) + scheduled export Worker.                                                                                                                   |
| Why not first              | More bespoke code to own for the same outcome; fewer batteries included than A. Good runner-up.                                                                       |

## Option C — Firebase (Auth + Firestore + Storage + Cloud Functions)

Excellent owner UX, but server-side validation/processing needs Cloud Functions, and new projects need the
**Blaze plan (credit card on file)** even to create the default Storage bucket. Usage would stay inside the free
quota, but it violates the "no credit card without approval" rule and adds Google-account administration.
Not recommended unless you prefer the Google ecosystem.

## Option D — Git-backed CMS (Decap/Sveltia CMS + GitHub OAuth proxy)

Content and images committed to the repo; the site rebuilds on each save. Cheapest, but: the owner needs a GitHub
account and sees Git concepts (commits, "published" ≈ merged), validation runs only in CI (a rejected commit is a
confusing failure mode for a non-technical owner), images bloat the repo, and there is no server-side upload
validation. Fails the usability and "backend-enforced limits" requirements. Not recommended.

## Publication architecture — how the public site updates without a developer

The owner's expectation is _publish puppy → website updates by itself_. Two ways to honour that:

### Option A — runtime fetch

The static pages load, then a small script fetches published listings from the backend and renders/updates cards.

|              |                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latency      | Instant.                                                                                                                                                                                          |
| Dependency   | The public site now depends on the backend being up at every visit. On the free tier a paused project means empty or stale cards; images served from backend storage count against egress limits. |
| SEO          | Listing content is not in the HTML (Google renders JS, but slower and less reliably); WhatsApp/Facebook link previews cannot see it.                                                              |
| Complexity   | Client code paths for loading, empty and error states in three languages; caching headers; CORS.                                                                                                  |
| Failure mode | Silent: the visitor sees a spinner or nothing.                                                                                                                                                    |

### Option B — publish triggers a rebuild (recommended)

Publishing in the admin securely triggers the existing GitHub Actions deploy, which fetches published listings and their derivatives at build time and ships plain HTML + images to GitHub Pages.

| Question                        | Answer                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What triggers GitHub Actions?   | A server-side function (Supabase Edge Function `publish`, or a Database Webhook on the `listings` table) calls `POST /repos/<owner>/self-beauty/dispatches` with event `content-published`. The deploy workflow adds `repository_dispatch: [content-published]` to its triggers.                 |
| Where is the GitHub credential? | A **fine-grained personal access token** (or GitHub App installation token) restricted to this one repository with a single permission, `Contents: read/write` (the minimum that allows `repository_dispatch`). It is stored as a Supabase secret and read only inside the server-side function. |
| Why not exposed to the browser? | The browser only calls the admin API with the owner's session JWT; the function verifies the JWT, then uses the GitHub token server-side. The token never leaves the server, is never in the bundle, and is not readable through any public endpoint.                                            |
| Least privilege                 | Token scoped to one repo, one permission, 1-year expiry with a calendar reminder; the workflow itself runs with `contents: read` + `pages: write` + `id-token: write` only. Supabase anon key exposes only `published = true` rows through RLS.                                                  |
| Build-time data access          | The workflow reads listings with the anon key (public rows only) and downloads derivatives from the public bucket. No secret is needed for reading.                                                                                                                                              |
| Deployment failure              | The workflow fails → GitHub emails the repo owner; the previously deployed site stays live untouched (Pages only swaps on success). The admin shows "Published — site update pending" until confirmed.                                                                                           |
| Confirmation                    | The build writes `public/build.json` `{ builtAt, contentVersion }`; the admin polls it on the live site and flips the status to "Live on the website" when `contentVersion` ≥ the version it published. No callback secret required.                                                             |
| Retry                           | Debounced: several edits within 2 minutes cause one build. Admin has a "Publish again" button (re-dispatch). A nightly scheduled build is a safety net so nothing stays pending overnight.                                                                                                       |
| Latency                         | Typically 2–4 minutes (install cached, images cached by content hash).                                                                                                                                                                                                                           |
| Rollback                        | Unpublish/edit in admin → new build. Or re-run any earlier successful workflow run from GitHub (redeploys that snapshot).                                                                                                                                                                        |
| Cost                            | GitHub Actions free minutes for a public repo; a build is ~2 minutes.                                                                                                                                                                                                                            |

**Hybrid (optional, later):** keep Option B for content and add a tiny runtime status check (a 1 KB public JSON of
`id → status`) so a puppy marked _reserved_ shows as reserved within seconds even before the next build. It degrades
gracefully: if the fetch fails, the build-time status remains.

**Recommendation: Option B**, with the hybrid status check as a follow-up if the owner wants sub-minute updates.

## Recommendation

**Option A (Supabase).** It meets every hard requirement with the least custom security code, costs nothing,
needs no card, keeps the public site independent of the backend, and gives the owner a normal login.

## What I need from you to proceed

1. Approval of Option A (or B).
2. A Supabase account: either you create the project (region: EU West is closest to Israel) and share the
   project URL + anon key + a service-role key **as GitHub Actions secrets / Supabase secrets only**, or you
   authorise me to create it under an account you own.
3. The owner's email address for the admin login.

Until then I can build the admin UI against an in-memory repository interface labelled "DEV ONLY — not secure"
so that the screens, validation messages and mobile upload flow can be reviewed.
