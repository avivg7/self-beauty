# Stage 2 — Admin interface and dynamic puppy listings (Supabase) — design, revision 3

Date: 2026-09-06 · Status: **revised after independent security review; awaiting approval before any external resource is created**
Production baseline: `main` @ `116c328`, https://avivg7.github.io/self-beauty/

Revision history

- r1: initial proposal (public-by-URL bucket, unguessable paths) — rejected by the client.
- r2: two-bucket private/public model, journaled publication, hardened RPC, deferrable reorder, header-first
  validation, no keep-alive, archive keeps media, backup procedure.
- r3 (this): after an independent security/architecture review — explicit state machine with compare-and-swap
  transitions and a lease, archive routed through the function, two-sided consistency constraint, per-image
  public verification instead of a `dirty` state, privilege revokes on every internal RPC and a catch-all grant
  test, Edge Function caller authorization spelled out, JPEG segment sanitisation, shared-origin hardening,
  quota hygiene, a card-size derivative, password-reset decision, and the spikes committed to the repository.

## 0. Discovery (unchanged)

Astro 7 static site on GitHub Pages under `/self-beauty/`, three locales, no framework on public pages, no
secrets. Puppies pages render from a content collection (production has no published listing; honest empty
state). Breed keys, status labels, WhatsApp intents and `admin.upload` messages exist in all dictionaries.
Docker is installed locally (Supabase CLI local stack for tests); the Supabase CLI is not yet installed.
The public site and the admin share one origin, `https://avivg7.github.io` (see §9 for the consequences).

## 1. Architecture

```
Owner (iPhone) ─▶ GitHub Pages /self-beauty/admin/ (static page + Preact island; anon key + owner session)
                     │ supabase-js: DB reads/writes under RLS; uploads to the PRIVATE bucket, incoming/ prefix only
                     │ Edge Function `listing-ops` (service role): register, remove, publish, unpublish, archive,
                     ▼ delete, reconcile — every operation that must be trusted or spans storage + database
            Supabase (free plan)
            ├─ Auth: email + password, sign-ups off, one admin (admins table), min password 12, no OAuth/anon
            ├─ Postgres: admins, listings, listing_images + RLS, RPCs, triggers, publication state machine
            ├─ Storage: listing-media-private (PRIVATE) · listing-media-public (public by URL, not listable)
            └─ Edge Function: listing-ops

Visitor ─▶ GitHub Pages /he/puppies/ (static shell) ─▶ plain fetch of rpc public_listings_json() as ANON
                                                   ─▶ images from listing-media-public via the CDN
```

Content changes never touch Git, GitHub Actions or Pages. The service-role key lives only in the Edge Function
runtime (`supabase secrets`) and a git-ignored local file; the browser bundle contains the project URL and anon key
only, whose safety rests on RLS and the grants in §5.

## 2. Storage architecture

| Bucket                  | Visibility                                                        | Contents                                                                                                                                                                                                               | Writes                                                 | Reads                                                 |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| `listing-media-private` | **private**: anonymous requests fail even with the exact path     | validated derivatives of every listing (draft, published, unpublished, archived) under `img/<listing_id>/<image_id>-{1600,960,480}.jpg`; transient uploads under `incoming/<listing_id>/<image_id>-{1600,960,480}.jpg` | owner session: `incoming/…` only; function: everything | owner: signed URLs (1 h) for admin previews; function |
| `listing-media-public`  | public by URL, **not listable** (no `select` policy for any role) | copies of the derivatives of listings that are published right now, under `pub/<listing_id>/<image_id>-{1600,960,480}.jpg`                                                                                             | function only (service role)                           | anyone by URL                                         |

- Three derivatives per image, all JPEG: **1600** (detail/lightbox, ≤ 2 MB), **960** (cards at 2× on phones,
  ≤ 800 KB), **480** (admin thumbnails, ≤ 300 KB). Paths are derived from ids and never stored.
- Bucket-level enforcement in addition to the function: private bucket `file_size_limit = 2 MB`,
  `allowed_mime_types = ['image/jpeg']`; the owner's `insert` policy matches only
  `incoming/<uuid>/<uuid>-(1600|960|480).jpg` for an existing listing; `select` under `incoming/` and `img/`
  (signed URLs); `delete` under `incoming/` only. No owner policy on the public bucket at all.
- Public objects are uploaded with `cache-control: public, max-age=300`. Image ids are immutable, so a 5-minute
  TTL costs nothing in correctness and bounds the residual visibility after unpublishing to five minutes plus
  the reconcile retry (no Smart CDN invalidation on the free plan).
- Copy to public is done by download + upload with `upsert: true` and explicit `cacheControl` (does not depend on
  `copy` overwrite semantics of the deployed storage-api); after upload the function verifies `size` and `etag`
  of the public object against the private one.
- Originals are not stored (client converts/downscales); re-processing at higher resolution needs a re-upload.

## 3. Database schema

```sql
create type breed             as enum ('yorkshire','poodle','bichon','pomeranian','shihtzu');
create type sex               as enum ('male','female','unspecified');
create type listing_status    as enum ('available','reserved','coming_soon','placed');
create type publication_state as enum ('private','publishing','published','unpublishing','deleting');

create table admins (user_id uuid primary key references auth.users(id) on delete cascade,
                     created_at timestamptz not null default now());

create table listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,      -- nullable for portability/restore
  breed breed not null, sex sex not null default 'unspecified', birth_date date,
  status listing_status not null default 'available',
  published boolean not null default false, published_at timestamptz,
  publication_state publication_state not null default 'private',
  state_changed_at timestamptz not null default now(),               -- lease for reconcile
  featured boolean not null default false, archived_at timestamptz, sort_order int not null default 100,
  name_he text not null check (length(name_he) between 1 and 80), name_ru text, name_en text,
  description_he text not null default '' check (length(description_he) <= 1500), description_ru text, description_en text,
  pedigree_he text, pedigree_ru text, pedigree_en text, sire_name text, dam_name text,
  show_prospect boolean not null default false,
  internal_note text,
  constraint published_iff_state check (published = (publication_state = 'published')),
  constraint archived_not_published check (archived_at is null or not published)
);

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  position smallint not null check (position between 1 and 3),        -- 1 = primary photo
  width int not null, height int not null, bytes int not null,         -- server-measured (1600 derivative)
  public_verified_at timestamptz,                                      -- set when pub/ copies verified
  created_at timestamptz not null default now(),
  constraint listing_images_position_unique unique (listing_id, position) deferrable initially immediate
);
```

Invariants and rules:

- **≤ 3 images**: `position ∈ {1,2,3}` + unique `(listing_id, position)`; the register RPC also counts under a
  per-listing advisory lock. A 4th image has no legal position.
- **`published` ⇔ `publication_state = 'published'`** (two-sided). No row can be hidden-but-published or
  published-while-transitioning. Archived rows are never published.
- **Publish gate** (checked in `finalize_publish`, not a bare trigger): not archived, ≥ 1 image with
  `public_verified_at`, non-empty `name_he` and `description_he`.
- Column privileges for the admin role exclude `published`, `published_at`, `publication_state`,
  `state_changed_at`, `created_by`, `created_at`, `updated_at`, `archived_at` on **both insert and update**;
  those columns change only through RPCs/functions. `updated_at` by trigger; `created_by` set by trigger from `auth.uid()`.
- "planned" stays a litter concept (static litters page); dog statuses are the four above.
- Missing Russian/English: Hebrew required; Russian/English pages show localized breed/status/CTA, the name as
  entered, and the Hebrew text with an "available in Hebrew — ask us on WhatsApp" note; the admin flags it.

## 4. Publication state machine

Every cross-system operation is journaled in the database first, executed against storage, confirmed in the
database with a compare-and-swap on the state it expects, and reconcilable if it stops half way.

| Current state  | register / remove         | reorder | publish        | unpublish        | archive                        | delete (archived only)        |
| -------------- | ------------------------- | ------- | -------------- | ---------------- | ------------------------------ | ----------------------------- |
| `private`      | ok                        | ok      | → `publishing` | INVALID_STATE    | ok (no media work)             | → `deleting`                  |
| `published`    | ok, with late public copy | ok      | INVALID_STATE  | → `unpublishing` | → `unpublishing` then archived | INVALID_STATE (archive first) |
| `publishing`   | BUSY                      | ok      | BUSY           | BUSY             | BUSY                           | BUSY                          |
| `unpublishing` | BUSY                      | ok      | BUSY           | BUSY             | BUSY                           | BUSY                          |
| `deleting`     | INVALID                   | INVALID | INVALID        | INVALID          | INVALID                        | idempotent retry              |

Rules that apply to every transition:

- Transitions are `update listings set publication_state = X, state_changed_at = now() where id = $1 and
publication_state = Y` with a rowcount check; a second tab/device that loses the race gets BUSY and a
  friendly "this listing is being updated, try again in a moment".
- `finalize_publish`, `finalize_unpublish`, `register_listing_image`, `remove_listing_image`, `reorder_images`
  all take `pg_advisory_xact_lock(4242, hashtext(listing_id::text))` so image-set checks and flips are atomic
  against each other. Storage work happens outside the lock, always guarded by the state.
- Storage cleanup works on **prefixes** (`list` then delete everything not in the current set), never on an
  expected-id list, so interleavings cannot leave orphans behind.
- Reconcile treats an in-progress state younger than **5 minutes** (`state_changed_at`) as live and skips it;
  older ones are stale and are completed or rolled back. The public RPC filters on `published and archived_at is
null` and returns only images with `public_verified_at is not null`.

Operations:

**register** (owner uploads `incoming/…` three derivatives, then calls the function): function authorizes the
caller (§5), validates and sanitises each derivative (§6), then: (1) DB under the lock: state ∉ {publishing,
unpublishing, deleting} else BUSY/INVALID; count < 3 else LIMIT_REACHED; insert row at position count+1;
(2) move objects `incoming/ → img/`; (3) if the listing is `published`, upload copies to `pub/`, verify size and
etag, set `public_verified_at`. Failure at (2) deletes the row and both prefixes for the image id; failure at (3)
keeps the row (private data is valid) with `public_verified_at = null`, so the public page shows the listing
without that photo and the admin shows "the website copy of this photo is pending — retry" (retry = reconcile).
Abandoned uploads: the health check lists `incoming/` objects older than 24 h and offers to remove them.

**remove**: DB under the lock: delete the row and re-pack positions 1..n; then delete `pub/` and `img/` objects for
that image id (prefix-based). Storage failure is reported and left to reconcile (the row is already gone; a
public copy of a published listing without a row is deleted by the next reconcile's prefix sweep).

**publish**: (1) CAS `private → publishing`; (2) for each image upload the three copies to `pub/`, verify size +
etag, set `public_verified_at`; (3) `finalize_publish` under the lock: CAS `publishing → published`, gate check
(≥ 1 verified image, Hebrew text, not archived), `published = true`, `published_at`. Only after (3) commits does
the function answer "published". Failures: at (2) → delete the `pub/<id>/` prefix, CAS `publishing → private`,
return PUBLISH_MEDIA_FAILED (`published` never became true); at (3) → same rollback; a crash leaves `publishing`,
which reconcile rolls back to `private` after the lease expires (prefix cleared).

**unpublish**: (1) CAS `published → unpublishing`, `published = false` in the same transaction (the listing
disappears from the RPC immediately); (2) delete the `pub/<id>/` prefix, null `public_verified_at`; (3) CAS
`unpublishing → private`. Failure at (2) leaves `unpublishing` (recorded; the admin sees "removed from the site;
photo cleanup pending"); reconcile retries the prefix delete. Residual: unlinked public copies until the retry,
CDN copies ≤ 5 minutes. Private copies are never touched.

**republish**: publish again; copies are recreated from `img/`.

**archive** (function action, never a bare DB update when published): if published, run **unpublish** to
completion, then set `archived_at`. Listing data and private images are preserved indefinitely; there is no
scheduled cleanup of any kind. Unarchive: clear `archived_at` (state stays `private`; publish is a separate action).

**delete** (permanent; archived listings only; typed confirmation): (1) CAS `private → deleting`; (2) delete
`pub/`, `img/`, `incoming/` prefixes; (3) delete the row (cascade). A crash leaves `deleting`; reconcile finishes
it (idempotent prefix deletes, then row delete). `deleting` never maps back to `private`.

**reconcile** (function action; runs on admin login for listings whose `(published, state)` is not
`(false, private)` / `(true, published)` **and** whose lease has expired, and from the "בדיקת תקינות" button for
every listing): for `published` rows, verify every image's three public copies exist with the right size/etag and
that the `pub/` prefix holds nothing else; for unpublished rows, ensure the `pub/` prefix is empty; finish
`deleting`; report `incoming/` leftovers and `img/` objects without a row (removal behind a confirm).

## 5. Authentication, RLS, RPC privileges

Auth: email + password, sign-ups disabled, anonymous sign-ins and all OAuth providers disabled, minimum password
length 12, Site URL `https://avivg7.github.io/self-beauty/admin/`. One owner user created by us; `admins` row
inserted once. Failed login shows one generic message.
**Password reset**: the built-in email provider delivers only to organisation members, 2/hour. Decision for v1:
the owner is **not** added to the Supabase organisation; a reset is performed by the developer from the
dashboard on request (documented in the runbook). A free custom SMTP can be added later if self-service reset is wanted.

Edge Function caller authorization (every action, before any DB or storage work): read the `Authorization`
bearer, `auth.getUser(jwt)` with the service client, then require an `admins` row for that user id; the anon key
alone (a valid project JWT) is rejected; `listing_id`/`image_id` must match a strict UUID regex before any storage
key is composed. `Access-Control-Allow-Origin` is restricted to `https://avivg7.github.io`.

Grants and policies (RLS on every table; a role without a policy gets nothing):

| Object                                                                                                                 | anon                  | authenticated non-admin                | admin (`is_admin()`)                                       | service role |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------- | ---------------------------------------------------------- | ------------ |
| `listings` table                                                                                                       | no grants             | no grants                              | select all; insert/update on the content columns only (§3) | all          |
| `listing_images`                                                                                                       | none                  | none                                   | select only                                                | all          |
| `admins`                                                                                                               | none                  | none                                   | select own row                                             | all          |
| `public_listings_json()`, `public_listing_json(id)`                                                                    | execute               | none                                   | none (the admin previews through the anon path)            | —            |
| `reorder_images()`                                                                                                     | none                  | execute but raises unless `is_admin()` | execute                                                    | —            |
| `register_listing_image()`, `remove_listing_image()`, `finalize_publish()`, `finalize_unpublish()`, transition helpers | none                  | none                                   | none                                                       | execute      |
| `is_admin()`                                                                                                           | none                  | execute                                | execute                                                    | —            |
| private bucket                                                                                                         | none                  | none                                   | §2                                                         | all          |
| public bucket                                                                                                          | none (URL reads only) | none                                   | none                                                       | all          |

Every function is created with explicit `revoke all on function … from public, anon, authenticated;` followed by
the single intended grant, because Supabase's default privileges would otherwise grant `execute` to `anon` and
`authenticated` — the classic escalation through a `security definer` RPC. Public RPCs: `language sql`, `stable`,
`security definer`, `set search_path = ''`, schema-qualified, `jsonb_build_object` with a fixed public column set
(`id, breed, sex, birth_date, status, featured, name_*, description_*, pedigree_*, sire_name, dam_name,
show_prospect, updated_at, images[{position,width,height,path_1600,path_960,path_480}]` — `pub/` paths only),
filter `published and archived_at is null`, images only where `public_verified_at is not null`. Unknown and
unpublished ids return the same empty result (no oracle).

Automated security tests (`tests/security/`, run in CI against the Supabase CLI local stack, and the anon + admin
parts against production after each migration; the "authenticated non-admin" part runs only against the local
stack because sign-ups are off in production): as anon and as a non-admin user — select/insert/update/delete on
every table fail; every internal RPC fails with `42501`; every function action returns 401/403; private object
download by exact path fails; bucket listing fails; the public RPC never returns a draft, `internal_note`,
`created_by`, `publication_state`, or an `img/`/`incoming/` path. As admin — CRUD works, `published` cannot be
flipped directly, image insert is refused, reorder works. **Catch-all**: a test enumerates
`information_schema.role_table_grants`, `column_privileges` and `routine_privileges` and fails if `anon` holds
anything beyond the two public RPCs or `authenticated` holds anything beyond the narrow lists above, so a future
migration cannot regress silently.

## 6. Image validation and sanitisation (client convenience, server truth)

Client (admin): allowlist `jpg jpeg png heic heif webp`, ≤ 10 MB, magic-byte sniff, decode — **native first**
(`createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth })`, which iOS Safari can do for HEIC and
which avoids WASM memory for 48 MP photos), `libheif-js` WASM as the fallback when the browser cannot decode HEIC;
reject decoded images above 50 MP; render into an sRGB canvas; encode JPEG 1600 (q0.85), 960 (q0.85), 480 (q0.82).

Server (`listing-ops: register`), each derivative is untrusted input:

1. object metadata size check (`list`/`info`) before download: 1600 ≤ 2 MB, 960 ≤ 800 KB, 480 ≤ 300 KB;
2. magic bytes `FF D8 FF`;
3. **segment sanitisation**: walk the marker stream; keep SOI, DQT, SOF0/SOF1/SOF2, DHT, DRI, SOS + entropy data,
   EOI; drop every APPn (EXIF, GPS, ICC, XMP) and COM; truncate at EOI (kills JPEG/ZIP/HTML polyglots); reject any
   other SOF type (arithmetic, hierarchical, 12-bit) and files with more than one SOF. Dropping ICC is safe only
   because the client renders into an sRGB canvas (Display P3 photos are converted there); documented as a coupling;
4. **header-first bounds** on the sanitised buffer: long edge ≤ 1600/960/480 respectively, short edge ≥ 300/180/120,
   ≤ 2.6 MP, 1 or 3 components (grayscale and progressive are fine); a 30000×30000 header bomb dies here in 0 ms;
5. real decode with `jpeg-js` (`maxResolutionInMP: 3`, `maxMemoryUsageInMB: 64`); decoded dimensions must equal
   the header; any error rejects;
6. the **sanitised** bytes are what gets stored (`img/`) and later copied to `pub/`; `width/height/bytes` are the
   server-measured values of the 1600 derivative.

**HEIC is not production-ready until the real-device matrix passes on the owner's iPhone (Phase H)**: normal HEIC,
portrait HEIC, rotated/orientation case, 5–10 MB HEIC, three HEICs selected together, replacing one of three,
low-memory/reload recovery (form draft in `sessionStorage`; registered uploads are never lost) — each run with
both `accept` configurations (with and without `image/heic`), because iOS often hands over JPEG when HEIC is not
listed. JPEG/PNG upload keeps the owner unblocked meanwhile.

## 7. Race-safe reordering and the 3-image invariant

`reorder_images(listing_id, ordered_image_ids uuid[])` — `security definer`, `set search_path = ''`, first
statement `if not public.is_admin() then raise insufficient_privilege`; then `pg_advisory_xact_lock(4242,
hashtext($1::text))`; verify the array equals the listing's current image ids (else STALE_ORDER); `set constraints
public.listing_images_position_unique deferred;` update positions from the array; commit checks the constraint
once. PostgREST wraps the RPC in one transaction, so the deferred check runs at its commit and a violation surfaces
as the RPC error. Reorder is allowed in every non-deleting state because it never touches storage paths.
`register_listing_image` and `remove_listing_image` (service role) take the same lock; register counts and raises
LIMIT_REACHED at 3; remove re-packs 1..n. Concurrency tests: two concurrent reorders (both succeed or one
STALE_ORDER; final positions a permutation of 1..n); two concurrent registrations for the third slot (exactly one
succeeds); register racing reorder (serialised); publish racing unpublish from two tabs (one BUSY); reconcile
during a live publish (skipped by the lease); archive crash between unpublish and archive (state recorded, reconciled).

## 8. Public-site integration, detail routing, freshness, SEO

Static shells keep copy, empty state, litters banner and CTA band. The island is **plain `fetch`** to
`/rest/v1/rpc/public_listings_json` with the anon key in both `apikey` and `Authorization` headers — never
supabase-js and never the owner's session, so a logged-in owner browsing the site is still anon and the
`authenticated` revoke cannot bite. Strings are rendered with `textContent` only. `cache: 'no-store'`, 8 s
timeout. States: skeleton → listings / empty (successful zero-row fetch) / error ("couldn't load the puppies right
now" + WhatsApp CTA). Cards use the 960 derivative with `sizes`; detail/lightbox the 1600. Malformed rows skipped.
Detail: `/{lang}/puppies/view/?id=<uuid>` static page + island; unknown or unpublished → "not found". Status
changes appear on the next page view; images cache for 5 minutes. SEO trade-off accepted for short-lived listings;
business pages stay static.

## 9. Admin app security and UX

- The admin's supabase-js client uses a distinct `storageKey`; the page sets `<meta name="referrer"
content="no-referrer">`, is `noindex`, and is excluded from the sitemap. Operational rule, documented: while the
  admin lives on `avivg7.github.io`, **no other GitHub Pages site may be created on the `avivg7` account** (all
  project sites share one origin and therefore one `localStorage`); moving to the custom domain lifts this.
- Hebrew default, Russian/English from the dictionaries; hash-routed single page. List "גורים באתר" (filters,
  thumb, name, breed, status pill, published switch, updated, **[עריכה]**), two-tap status change, sticky
  "הוספת גור חדש". Form: sectioned, validate on blur, unsaved-changes guard, photos `0/3` with per-file progress.
  Honest states via `aria-live`: _Saving… / Saved / Publishing… / Published / Removed from site / Failed — retry /
  Being updated — try again_ (BUSY) plus the pending-cleanup notices. Archive is the default destructive action
  ("hidden from the site, kept for you"); permanent delete only in the archived view behind typing the dog's
  name. If Supabase is unreachable or paused: "השירות אינו זמין כרגע" with the runbook link.

## 10. Free plan behaviour (verified 2026-09-06)

$0, 2 projects, 500 MB DB, 1 GB storage, 5 GB egress + 5 GB cached, pause after 1 idle week, no backups, Edge
Functions 256 MB / 2 s CPU / 150 s, built-in email 2/hour to organisation members only. Expected usage < 5 % of
every limit. No keep-alive hack. Runbook: dashboard → project → "Restore project"; data is retained (retention
for long-paused projects to be re-checked on the pricing page before relying on it). A paid plan is a separate decision.

## 11. Backup and export (no paid service)

`scripts/backup/export.mjs` (developer, local, service role from git-ignored `.env.supabase`, session pooler
connection string): `supabase db dump` (note: excludes `auth` and `storage` schemas by design) → `listings.json` +
`listing_images.json` via PostgREST → download all `img/` (and optionally `pub/`) objects into
`backups/<date>/media/` → manifest with counts and sizes. `restore.mjs`: restore SQL, re-create the owner user and
the `admins` row, re-upload media through the Storage API (never by restoring `storage.objects`). Cadence: before
every migration and monthly; `backups/` is git-ignored and a copy is kept off the developer's machine. Owner-level
"ייצוא רשימה" button exports listings as JSON. Portability: plain Postgres + files; the public adapter is one module.

## 12. Risks and trade-offs

- Cross-system consistency now rests on the state machine, CAS transitions, lease and prefix-based reconcile;
  the worst residual is a public copy surviving ≤ 5 min of CDN TTL plus one reconcile retry after a failed
  unpublish — recorded and surfaced, never silent.
- Shared GitHub Pages origin: mitigated by distinct storage key, referrer policy, anon-only public fetch, no
  `innerHTML`, and the "no other Pages site" rule until the custom domain.
- More trusted code in the function; mitigated by typed actions, shared validators, security and concurrency suites.
- iPhone HEIC path unproven on hardware until Phase H; JPEG/PNG keeps the owner unblocked.
- Password reset is developer-assisted in v1.
- Free-tier pause handled gracefully, not prevented. Listing SEO client-rendered; accepted.

## 13. Readiness and external resources

Ready for Supabase project creation once approved. Resources (free plan, no card, nothing else):

1. Your Supabase account + project `self-beauty`, `eu-central-1`.
2. In it: auth settings (§5), the owner user + `admins` row, migrations (schema, policies, RPCs, revokes, triggers),
   buckets `listing-media-private` (2 MB, JPEG only) and `listing-media-public`, Edge Function `listing-ops` + secrets.
3. GitHub: variables `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`; secrets `SUPABASE_ACCESS_TOKEN`,
   `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` for the manual migration/deploy job.
   Spikes are committed under `spikes/` so the numbers in §6 are reproducible and Phase H has a page to run on the phone.
