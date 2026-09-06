-- Self Beauty — Lean V1 schema, RLS, RPCs, storage buckets and policies.
-- Applied with `supabase db push` (production) or `supabase db reset` (local). Idempotency is not required:
-- this is the initial migration.

-- ---------- enums ----------
create type public.breed as enum ('yorkshire', 'poodle', 'bichon', 'pomeranian', 'shihtzu');
create type public.sex as enum ('male', 'female', 'unspecified');
create type public.listing_status as enum ('available', 'reserved', 'coming_soon', 'placed');

-- ---------- tables ----------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  breed public.breed not null,
  sex public.sex not null default 'unspecified',
  birth_date date,
  status public.listing_status not null default 'available',
  published boolean not null default false,
  featured boolean not null default false,
  archived_at timestamptz,
  sort_order int not null default 100,
  name_he text not null check (length(name_he) between 1 and 80),
  name_ru text check (name_ru is null or length(name_ru) <= 80),
  name_en text check (name_en is null or length(name_en) <= 80),
  description_he text not null default '' check (length(description_he) <= 1500),
  description_ru text check (description_ru is null or length(description_ru) <= 1500),
  description_en text check (description_en is null or length(description_en) <= 1500),
  pedigree_he text check (pedigree_he is null or length(pedigree_he) <= 600),
  pedigree_ru text check (pedigree_ru is null or length(pedigree_ru) <= 600),
  pedigree_en text check (pedigree_en is null or length(pedigree_en) <= 600),
  sire_name text check (sire_name is null or length(sire_name) <= 80),
  dam_name text check (dam_name is null or length(dam_name) <= 80),
  show_prospect boolean not null default false,
  internal_note text check (internal_note is null or length(internal_note) <= 2000),
  constraint archived_not_published check (archived_at is null or not published)
);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  width int not null check (width between 1 and 1600),
  height int not null check (height between 1 and 1600),
  created_at timestamptz not null default now(),
  -- The 3-image invariant: only positions 1..3 exist and each is unique per listing.
  constraint listing_images_position_unique unique (listing_id, position) deferrable initially immediate
);
create index listing_images_listing_idx on public.listing_images (listing_id);
create index listings_public_idx on public.listings (published, archived_at, sort_order);

-- ---------- helpers ----------
-- Finding 7: updated_at is maintained by the database, never by the client.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Publishing requires at least one image (the card design needs a photo).
create or replace function public.listings_publish_gate()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.published and not old.published then
    if not exists (select 1 from public.listing_images i where i.listing_id = new.id) then
      raise exception 'NO_IMAGE' using errcode = 'check_violation';
    end if;
    if length(btrim(new.name_he)) = 0 or length(btrim(new.description_he)) = 0 then
      raise exception 'MISSING_HEBREW_TEXT' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger listings_publish_gate before update of published on public.listings
  for each row execute function public.listings_publish_gate();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- row level security ----------
alter table public.admins enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;

-- Finding 1 (review 2026-09-06): RLS is enabled above, explicitly, in the same migration as the tables.
-- Remove Supabase's default table/sequence grants for anon (and authenticated), and make sure future
-- objects in `public` are never auto-granted to anon. anon reaches data ONLY through the two RPCs below.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert, delete on public.listing_images to authenticated; -- positions change only via reorder_images()

create policy admins_self_select on public.admins for select to authenticated using (user_id = auth.uid());

create policy listings_admin_select on public.listings for select to authenticated using (public.is_admin());
create policy listings_admin_insert on public.listings for insert to authenticated with check (public.is_admin());
create policy listings_admin_update on public.listings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy listings_admin_delete on public.listings for delete to authenticated using (public.is_admin());

create policy images_admin_select on public.listing_images for select to authenticated using (public.is_admin());
create policy images_admin_insert on public.listing_images for insert to authenticated with check (public.is_admin());
create policy images_admin_delete on public.listing_images for delete to authenticated using (public.is_admin());

-- ---------- reorder (Finding 2: security definer, admin check, exact id-set check, one UPDATE, max 3) ----------
create or replace function public.reorder_images(p_listing_id uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(array_agg(id order by position), '{}') into current_ids
    from public.listing_images where listing_id = p_listing_id;
  if p_ids is null or array_length(p_ids, 1) is null or array_length(p_ids, 1) > 3 then
    raise exception 'STALE_ORDER' using errcode = 'check_violation';
  end if;
  if array_length(p_ids, 1) is distinct from array_length(current_ids, 1)
     or (select count(distinct x) from unnest(p_ids) x) <> array_length(p_ids, 1)
     or not (p_ids <@ current_ids and current_ids <@ p_ids) then
    raise exception 'STALE_ORDER' using errcode = 'check_violation';
  end if;
  set constraints public.listing_images_position_unique deferred;
  update public.listing_images i
     set position = n.pos
    from unnest(p_ids) with ordinality as n(id, pos)
   where i.id = n.id and i.listing_id = p_listing_id;
end $$;
revoke all on function public.reorder_images(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_images(uuid, uuid[]) to authenticated;

-- ---------- public read-only RPCs (anon) ----------
-- Fixed public column set (explicit jsonb_build_object — never to_jsonb(l.*)). Never internal_note, never
-- admin ids, never private paths, never drafts/archived. tests/db/rls.test.ts asserts the exact key list.
create or replace function public.listing_public_json(l public.listings)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id,
    'breed', l.breed,
    'sex', l.sex,
    'birth_date', l.birth_date,
    'status', l.status,
    'featured', l.featured,
    'sort_order', l.sort_order,
    'updated_at', l.updated_at,
    'name', jsonb_build_object('he', l.name_he, 'ru', l.name_ru, 'en', l.name_en),
    'description', jsonb_build_object('he', l.description_he, 'ru', l.description_ru, 'en', l.description_en),
    'pedigree', jsonb_build_object('he', l.pedigree_he, 'ru', l.pedigree_ru, 'en', l.pedigree_en),
    'sire_name', l.sire_name,
    'dam_name', l.dam_name,
    'show_prospect', l.show_prospect,
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', i.position, 'width', i.width, 'height', i.height,
        'path_large', 'listings/' || l.id || '/' || i.id || '-1600.jpg',
        'path_card',  'listings/' || l.id || '/' || i.id || '-640.jpg'
      ) order by i.position)
      from public.listing_images i where i.listing_id = l.id), '[]'::jsonb)
  );
$$;
revoke all on function public.listing_public_json(public.listings) from public, anon, authenticated;

create or replace function public.public_listings_json()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.listing_public_json(l) order by l.featured desc, l.sort_order, l.created_at desc), '[]'::jsonb)
    from public.listings l
   where l.published and l.archived_at is null;
$$;
create or replace function public.public_listing_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.listing_public_json(l)
    from public.listings l
   where l.id = p_id and l.published and l.archived_at is null;
$$;
-- Finding 5: readable by anon and by the signed-in owner alike (the filter is inside the function).
revoke all on function public.public_listings_json() from public;
revoke all on function public.public_listing_json(uuid) from public;
grant execute on function public.public_listings_json() to anon, authenticated;
grant execute on function public.public_listing_json(uuid) to anon, authenticated;

-- Default privileges: make sure future functions in public are not auto-granted to anon.
alter default privileges in schema public revoke execute on functions from anon;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-media-private', 'listing-media-private', false, 2097152, array['image/jpeg']),
       ('listing-media-public',  'listing-media-public',  true,  2097152, array['image/jpeg']);

-- Finding 4: exact predicates — bucket id + is_admin() + the generated key shape. Never `owner = auth.uid()`
-- (recreating the owner's auth user must not orphan the files). No anon policy on either bucket: private
-- objects are unreachable, public objects are served by their URL only and are not listable.
create or replace function public.is_listing_media_key(p_name text)
returns boolean language sql immutable set search_path = '' as $$
  select p_name ~ '^listings/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(1600|640)\.jpg$';
$$;
revoke all on function public.is_listing_media_key(text) from public, anon;
grant execute on function public.is_listing_media_key(text) to authenticated;

create policy media_private_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'listing-media-private' and public.is_admin() and public.is_listing_media_key(name));
create policy media_private_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-media-private' and public.is_admin() and public.is_listing_media_key(name));
create policy media_private_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'listing-media-private' and public.is_admin() and public.is_listing_media_key(name))
  with check (bucket_id = 'listing-media-private' and public.is_admin() and public.is_listing_media_key(name));
create policy media_private_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-media-private' and public.is_admin() and public.is_listing_media_key(name));

create policy media_public_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'listing-media-public' and public.is_admin() and public.is_listing_media_key(name));
create policy media_public_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-media-public' and public.is_admin() and public.is_listing_media_key(name));
create policy media_public_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'listing-media-public' and public.is_admin() and public.is_listing_media_key(name))
  with check (bucket_id = 'listing-media-public' and public.is_admin() and public.is_listing_media_key(name));
create policy media_public_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-media-public' and public.is_admin() and public.is_listing_media_key(name));
