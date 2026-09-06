# Runbook — Self Beauty admin backend (Supabase free plan, Lean V1)

One owner, at most ~15 listings × 3 images, low traffic, **$0/month**. There is no monitoring, keepalive or
scheduled job by design. Everything below is manual and takes minutes.

## Where things are

| Piece                 | Location                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Public site + admin   | GitHub Pages, `https://avivg7.github.io/self-beauty/` and `/self-beauty/admin/`                       |
| Database, auth, files | Supabase project `self-beauty` (free plan, EU), managed only through the dashboard/CLI                |
| Schema                | `supabase/migrations/*.sql` in Git — applied **manually** with the CLI, never by GitHub Actions       |
| Build-time values     | GitHub repository variables `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (both public by nature) |

No database password, service-role key or Supabase access token is stored in GitHub. GitHub Actions only builds
and deploys the static site.

## First-time setup (developer, once)

1. Create the free project in the Supabase dashboard (no card). Region: `eu-central-1`. Note the project ref.
2. `npx supabase login` (browser flow; the token stays on the developer machine) then `npx supabase link --project-ref <ref>`.
3. Apply the schema: `npx supabase db push`. Verify in the dashboard: 3 tables with RLS on, 2 buckets, 4 functions.
4. Dashboard → Authentication → Providers → Email: **disable "Allow new users to sign up"**; keep email
   confirmations off; minimum password length 12. Dashboard → Authentication → URL configuration: site URL
   `https://avivg7.github.io/self-beauty/admin/`, redirect URLs the same plus `http://localhost:4321/self-beauty/admin/`.
5. Create the owner: Authentication → Users → _Add user_ → email + a 12+ character password (send it to the owner
   privately; she can change it later). Copy the user's UUID.
6. SQL editor: `insert into public.admins (user_id) values ('<uuid>');`
7. Repository → Settings → Variables: `PUBLIC_SUPABASE_URL` (project URL) and `PUBLIC_SUPABASE_ANON_KEY` (anon key).
   Push anything to `main` (or re-run the deploy workflow) so the site is rebuilt with the values.
8. Log in at `/self-beauty/admin/` on a phone and run the checklist in `docs/VERIFICATION.md` (HEIC section).

## Owner's day-to-day (no developer, no deploy)

Login → "גורים באתר" → הוספת גור → fill Hebrew name/description → add up to 3 photos → פרסום. Changing a status
(Available → Reserved) and pressing Save is live on the next page view. Unpublish / archive / restore / delete
are in the status sheet. Nothing here touches GitHub.

## Password reset

Self-service reset e-mail is not configured (the free built-in mailer is limited and not reliable enough).
Developer: Authentication → Users → the owner → _Reset password_ / _Send magic link_, or set a new password
directly and hand it over privately.

## Free-plan pausing (important, documentation only)

A free Supabase project that receives **no requests for about one week** is paused automatically. While paused:

- public site: the puppies section shows the friendly error with the WhatsApp button (static pages unaffected);
- admin: "לא ניתן להתחבר כרגע. נסי שוב מאוחר יותר."

Restore: dashboard → the project → **Restore**. Takes a few minutes; data and files come back as they were.
Supabase keeps a paused free project restorable for a limited time only (their docs currently say about 90 days;
check the current policy), after which it may be removed. Rule: **run the manual export below before any long
quiet period** (e.g. summer with no litters) and after every content session that matters. There is no keepalive,
ping, monitor or scheduled job, on purpose.

## Manual export (backup) and restore

```bash
export PATH="$PWD/.tools/node/bin:$PATH"
mkdir -p backups/$(date +%F)
# 1) data (listings, images rows, admins) — prompts for the database password from the dashboard; never store it
npx supabase db dump --linked --data-only --schema public -f backups/$(date +%F)/data.sql
# 2) private derivatives (the public bucket is a subset; it is re-created by "Publish")
node scripts/backup-media.mjs backups/$(date +%F)/media   # uses SUPABASE_SERVICE_ROLE_KEY from the shell for this run only
```

`scripts/backup-media.mjs` downloads every object of `listing-media-private` into the folder. Keep `backups/`
out of Git (it is ignored). Restore = `psql`/SQL editor to load `data.sql`, upload the folder back into the
private bucket with the same keys, then open each listing in the admin and press פרסום again.

## Migrations

Edit or add files under `supabase/migrations/`, test locally (`npx supabase start`, `npx supabase db reset`,
`npm run test:db`), then `npx supabase db push` from the developer machine. Run the manual export first.

## Free-plan limits (checked 2026-09-06)

500 MB database, 1 GB storage, 5 GB egress/month, 50k MAU. Expected use: < 50 MB storage, negligible database.
If the dashboard ever shows a limit approaching: identify it, reduce (smaller derivatives, remove stale public
copies), estimate the minimum paid cost, and **stop and ask** before any paid change. Never add a card or enable
Pro/paid features without explicit approval.
