# Runbook — Self Beauty admin backend (Supabase free plan, Lean V1)

One owner, at most ~15 listings × 3 images, low traffic, **$0/month**. There is no monitoring, keepalive or
scheduled job by design. Everything below is manual and takes minutes.

## Where things are

| Piece                 | Location                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Public site + admin   | GitHub Pages, `https://avivg7.github.io/self-beauty/` and `/self-beauty/admin/`                              |
| Database, auth, files | Supabase project `self-beauty` (free plan, EU), managed only through the dashboard/CLI                       |
| Schema                | `supabase/migrations/*.sql` in Git — applied **manually** with the CLI, never by GitHub Actions              |
| Build-time values     | GitHub repository variables `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (both public by nature) |

No database password, secret key or Supabase access token is stored in GitHub. GitHub Actions only builds
and deploys the static site.

## Private env file (developer machine only)

Everything secret lives in **one file outside the repository**, `~/.config/self-beauty/prod.env`, mode 600, created by
the developer and deleted when setup is done. Nothing in it is ever pasted into chat, committed, or put in GitHub.

```bash
mkdir -p ~/.config/self-beauty && touch ~/.config/self-beauty/prod.env && chmod 600 ~/.config/self-beauty/prod.env
```

| Key                             | Used for                                      | Where it comes from                                           |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `SUPABASE_DB_PASSWORD`          | `supabase link` / `db push` (non-interactive) | chosen when the project was created                           |
| `SUPABASE_SECRET_KEY`           | one-time RLS verification, owner creation     | Project Settings → API keys → `sb_secret_…` under Secret keys |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | owner account creation                        | typed by the developer, 12+ characters                        |
| `SUPABASE_ACCESS_TOKEN`         | only if `npx supabase login` cannot be used   | Account → Access tokens                                       |

Commands load it with `set -a; source ~/.config/self-beauty/prod.env; set +a` in the same shell, never globally.

## First-time setup (developer, once)

1. Create the free project in the Supabase dashboard (no card). Region: `eu-central-1`. Note the project ref.
2. `npx supabase login` (browser flow; the token stays on the developer machine) then `npx supabase link --project-ref <ref>`.
3. Apply the schema: `npx supabase db push`. Verify in the dashboard: 3 tables with RLS on, 2 buckets, 4 functions.
   Then run the same security suite that guards the local stack against the real project, **once, while the database
   is still empty** (it refuses to run otherwise and only deletes the rows and test users it creates):
   `SB_PROD_VERIFY=1 SUPABASE_URL=https://<ref>.supabase.co SUPABASE_PUBLISHABLE_KEY=<anon> npm run test:db`
   with `SUPABASE_SECRET_KEY` loaded from the private env file.
4. Dashboard → Authentication → Providers → Email: **disable "Allow new users to sign up"**; keep email
   confirmations off; minimum password length 12. Dashboard → Authentication → URL configuration: site URL
   `https://avivg7.github.io/self-beauty/admin/`, redirect URLs the same plus `http://localhost:4321/self-beauty/admin/`.
5. Create the owner and allowlist her — either route, never through chat or Git:
   - **Dashboard**: Authentication → Users → _Add user_ (email + a 12+ character password, auto-confirm), copy the
     UUID, then SQL editor: `insert into public.admins (user_id) values ('<uuid>');`
   - **Script**: put `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OWNER_EMAIL`, `OWNER_PASSWORD` in
     `~/.config/self-beauty/prod.env` (`chmod 600`), run
     `node --env-file=$HOME/.config/self-beauty/prod.env scripts/create-owner.mjs`, then delete the file.
6. Treat that password as temporary: the owner changes it after first login (developer sends a reset link from
   Authentication → Users). Anything ever typed into a chat or an e-mail counts as temporary.
7. Repository → Settings → Variables: `PUBLIC_SUPABASE_URL` (project URL) and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key).
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
node scripts/backup-media.mjs backups/$(date +%F)/media   # uses SUPABASE_SECRET_KEY from the shell for this run only
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
