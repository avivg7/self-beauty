# Stage 2 — Admin interface and dynamic puppy listings — Lean V1 design

Date: 2026-09-06 · Status: **approved (lean V1)**. Earlier revisions (journaled state machine, leases,
reconcile workers, etag verification, scheduled backups) are superseded; they remain only as "future options" in §11.

## 1. Product goal

Owner opens her phone → logs in → adds a puppy → picks up to 3 photos (HEIC included) → enters details →
presses Publish → the puppy appears on the website. Later: changes Available → Reserved → Save → the website
reflects it. No GitHub, no deployment, no developer.

## 1b. Expected scale (design constraint)

At most 10–15 listings in the system, 3 images each, one admin, low traffic, infrequent updates. Nothing here is
designed for hundreds of listings, and nothing should be added for that reason.

## 2. Architecture (zero-cost)

```
GitHub Pages (free)                      Supabase free plan ($0, no card)
├─ public site (static Astro)  ──fetch──▶ rpc public_listings_json()  (anon key, published rows only)
│   /he/puppies/  /he/puppies/view/?id=   └─▶ images from bucket listing-media-public (URL, CDN)
└─ /admin/ (static page + Preact island) ─▶ Auth (email+password) · Postgres under RLS · Storage (2 buckets)
```

No Edge Functions, no servers, no cron, no monitoring. Content changes touch Supabase only; GitHub Actions
deploys application code only. The browser bundle holds the project URL and anon key (public by design);
security is RLS plus the grants in §5. No service-role key exists anywhere in the repository or the site.

## 3. Images (browser-side pipeline, derivatives only)

Accepted input: JPG, JPEG, PNG, HEIC, HEIF; ≤ 10 MB. The browser sniffs magic bytes, decodes (native
`createImageBitmap` with EXIF orientation; HEIC via `libheif-js` WASM fallback, proven in `spikes/`), rejects
images above 50 MP, renders into a canvas (orientation normalised, metadata dropped), and encodes two JPEG
derivatives: **large** ≤ 1600 px long edge and **card** ≤ 640 px. Quality chosen by visual testing (start q0.85 /
q0.82). Only these two files are uploaded; no original is ever stored; no HEIC reaches the server.
Server-side guardrails without a function: bucket `allowed_mime_types = ['image/jpeg']`, `file_size_limit = 2 MB`,
object keys generated from ids. Object keys: `listings/<listing_id>/<image_id>-1600.jpg` and `-640.jpg`.

## 4. Storage

| Bucket                  | Visibility                                                         | Contents                                       | Who may write (RLS)             |
| ----------------------- | ------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------- |
| `listing-media-private` | private (anonymous requests fail; owner reads through signed URLs) | derivatives of every listing, published or not | owner, under `listings/<uuid>/` |
| `listing-media-public`  | public by URL, not listable                                        | copies for currently published listings only   | owner, under `listings/<uuid>/` |

## 5. Database, RLS, RPC

```sql
create type breed as enum ('yorkshire','poodle','bichon','pomeranian','shihtzu');
create type sex as enum ('male','female','unspecified');
create type listing_status as enum ('available','reserved','coming_soon','placed');

create table admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz default now());
create table listings (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  breed breed not null, sex sex not null default 'unspecified', birth_date date, status listing_status not null default 'available',
  published boolean not null default false, featured boolean not null default false, archived_at timestamptz, sort_order int not null default 100,
  name_he text not null check (length(name_he) between 1 and 80), name_ru text, name_en text,
  description_he text not null default '' check (length(description_he) <= 1500), description_ru text, description_en text,
  pedigree_he text, pedigree_ru text, pedigree_en text, sire_name text, dam_name text, show_prospect boolean not null default false,
  internal_note text,
  constraint archived_not_published check (archived_at is null or not published));
create table listing_images (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references listings(id) on delete cascade,
  position smallint not null check (position between 1 and 3), width int not null, height int not null, created_at timestamptz not null default now(),
  constraint listing_images_position_unique unique (listing_id, position) deferrable initially immediate);
```

- **Max 3 images** is the database invariant (`position between 1 and 3` + unique). Position 1 = main photo.
- `is_admin()` = `exists (select 1 from admins where user_id = auth.uid())` (`security definer`, `set search_path = ''`).
- RLS is **explicit in the migration**: `enable row level security` on `admins`, `listings`, `listing_images` in the
  same file that creates them; `revoke all on all tables/sequences in schema public from public, anon, authenticated`;
  `alter default privileges … revoke … from anon` for tables, sequences and functions. Nothing depends on dashboard defaults.
- Policies: `anon` has no table grants at all. `authenticated` gets policies only where `is_admin()`:
  `listings` select/insert/update/delete; `listing_images` select/insert/delete (insert limited by the constraint;
  position updates only through the reorder RPC); `admins` select own row. Storage: owner insert/select/update/delete
  in both buckets under `listings/<uuid>/`; anon nothing (public bucket is readable by URL only).
- `reorder_images(listing_id, ids uuid[])`: `security definer`, `set search_path = ''`, executable by
  `authenticated` only (revoked from `public`/`anon`); raises unless `is_admin()`; rejects null/empty/duplicate ids,
  more than 3 ids, or an id set that differs from the listing's actual images (`STALE_ORDER`); then
  `set constraints public.listing_images_position_unique deferred` and one `update … from unnest(ids) with ordinality`.
  No locks: there is one owner and the admin disables its controls while saving.
- `public_listings_json()` and `public_listing_json(id)`: `security definer`, `stable`, `set search_path = ''`,
  fixed public columns via `jsonb_build_object` (never `internal_note`, admin ids, or anything private), filter
  `published and archived_at is null`, images with derived **public** paths only. `revoke all … from public;
grant execute … to anon, authenticated` (the filter lives inside the function, so the owner's session gets the same
  view). Sign-ups disabled, minimum password 12, no OAuth, no anonymous auth.
  Automated negative tests (local stack, `npm run test:db`): anon cannot read tables, write anything, read private
  objects, list either bucket, or see drafts; a non-admin user gets nothing; the RPC response has exactly the
  documented keys (`internal_note` and admin ids can never creep in through a `to_jsonb(listings.*)` refactor).
- Storage policies are written out per bucket and per operation with exact predicates: `bucket_id = '<bucket>'
and is_admin() and is_listing_media_key(name)` (the generated key shape `listings/<uuid>/<uuid>-(1600|640).jpg`).
  The `owner` column is never used, so recreating the owner's auth user cannot orphan files. No anon policy on
  either bucket.
- `updated_at` is set by a `before update` trigger; clients never set it.

## 6. Publish / unpublish / archive / delete (plain, retryable)

- **Publish** (admin): validate the form → require ≥ 1 image → copy both derivatives of every image to the public
  bucket with **upsert** (a destination that already exists from an earlier partial publish is the same generated
  file, so Retry succeeds) → only then `update … set published = true` → "פורסם". If any copy fails: `published`
  stays false, clear error, Retry button. No intermediate states.
- **Unpublish**: `published = false` (the RPC stops returning it immediately) → delete public copies. If a delete
  fails: error message with Retry; nothing links to those objects any more, acceptable for V1.
- **Save** (content/status change): plain update; if the listing is published its data is live on the next page view.
- **Archive**: `published = false`, `archived_at = now()`, public copies deleted (best effort), private kept,
  hidden from the normal list and from the site. Restore = clear `archived_at`.
- **Permanent delete** (from the archive view, typed confirmation): delete public copies → delete private
  derivatives → delete the row. A partial failure shows an understandable error and can be retried.
- **Images** on a published listing — order matters because the public site derives paths from rows:
  **add** = private upload → public upload → row insert; **remove** = row delete → storage cleanup (both buckets,
  best effort); **replace** = remove + add under a **new image id** (never overwrite a cached public key);
  reorder is data only.

## 7. Public site

Static shells unchanged. An island fetches the RPC with plain `fetch` and the anon key (`no-store`, 8 s
timeout) and clones the existing card template. States: skeleton → listings / empty (successful zero-row fetch)
/ error ("לא הצלחנו לטעון את הגורים כרגע" + WhatsApp CTA — never "no puppies" on failure). Cards use the 640
derivative, detail/lightbox the 1600. Detail route: `/{lang}/puppies/view/?id=<uuid>` (static page + island);
unknown or unpublished → not found. Freshness: every page view fetches live data; images are immutable per id
(public cache 1 day). Missing Russian/English text: Hebrew is shown with a short "available in Hebrew" note; nothing
is machine-translated. SEO trade-off accepted: listings are client-rendered; business pages stay static.

## 8. Admin (`/self-beauty/admin/`, Hebrew default, iPhone first)

Login (email, password, generic error, "לא ניתן להתחבר כרגע. נסי שוב מאוחר יותר." when Supabase is unreachable).
**גורים באתר**: rows with thumb, name, breed, status pill, published state, updated date; actions הוספת גור,
עריכה, שינוי סטטוס (bottom sheet, two taps), פרסום / הסרה מפרסום, ארכיון; archive view with restore and delete.
Form: basics, Hebrew text, collapsed Russian/English, **תמונות — 0/3** (add disabled at 3/3; add, replace,
remove, reorder ▲▼, main photo = position 1), visibility, Save. Controls disable while saving. States announced:
שומרת… / נשמר / מפרסמת… / פורסם / הוסר מהאתר / השמירה נכשלה — נסי שוב. Shares the site's tokens, Arial and
button language; `noindex`; excluded from sitemap; distinct session storage key.

## 9. Environment, CI, migrations, backup

- Build-time public values: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (GitHub repository variables; both
  are public by nature). No secrets in GitHub. Missing values → the public island shows the error state and the
  admin shows the connect error; the static site is unaffected.
- CI: existing checks + admin typecheck/unit + Playwright with mocked RPC responses. No Supabase credentials in CI.
- Migrations live in `supabase/migrations/` and are applied with the Supabase CLI by the developer during setup
  (`supabase db push`); no automatic migration deployment.
- Backup: manual, documented in `docs/RUNBOOK.md` — `supabase db dump` + a small script that downloads the private
  bucket; run before a destructive migration. No scheduled jobs.

## 10. Free plan (verified 2026-09-06 on supabase.com/pricing): $0, no card, 500 MB DB, 1 GB storage,

5 GB egress + 5 GB cached, 50k MAU, pause after 1 idle week, no backups, no image transformations. Expected usage:
tens of listings × 2 derivatives × ~250 KB ≈ well under 100 MB; API calls negligible. If a limit is approached:
identify it, propose free optimisations (smaller derivatives, remove unused public copies), and stop before any
paid change. Pause → public graceful error + admin retry message; the developer restores from the dashboard.
A paused free project is restorable for a limited period only (Supabase's current docs say ~90 days, then
removal); `docs/RUNBOOK.md` records this and the rule "run the manual export before any long quiet period".
No health checks, keepalive, synthetic traffic, scheduled pings or monitoring are built.

## 11. Future options (not requirements)

Server-side byte validation in an Edge Function; publication journal/reconcile if multi-device edits ever cause
inconsistencies; scheduled backups; custom SMTP for self-service password reset; a 960 px card derivative if
visual QA shows softness on 3× phones.

## 12. Review outcome (2026-09-06, concise security review)

Eight findings, all accepted and applied: (1) explicit RLS + anon privilege removal + safe default privileges;
(2) `reorder_images` as a small `security definer` function with admin, id-set and max-3 checks; (3) publish
retry-safe via upsert copies; (4) exact per-bucket storage predicates, no `owner` column, no anon policy;
(5) public RPCs granted to `anon, authenticated` with a fixed key list and a test on the exact keys;
(6) add/remove/replace ordering for published listings; (7) `updated_at` trigger; (8) pause note in the runbook
(documentation only). No anonymous-reachable hole was found in the design. No further architecture cycle.
