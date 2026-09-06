/**
 * RLS / RPC / storage negative and positive tests against the LOCAL Supabase stack.
 * Values come from `supabase status -o env` (see tests/db/setup.ts). Never points at production.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { localStack } from './setup';

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
  'base64',
);
const ADMIN_EMAIL = 'owner-test@example.com';
const OTHER_EMAIL = 'stranger-test@example.com';
const PASSWORD = 'correct-horse-battery-12';

let env: Awaited<ReturnType<typeof localStack>>;
let service: SupabaseClient;
let anon: SupabaseClient;
let admin: SupabaseClient;
let other: SupabaseClient;
let adminId = '';

async function userClient(email: string): Promise<SupabaseClient> {
  const c = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return c;
}

beforeAll(async () => {
  env = await localStack();
  service = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  anon = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
  // fresh users each run
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users.users)
    if ([ADMIN_EMAIL, OTHER_EMAIL].includes(u.email ?? '')) await service.auth.admin.deleteUser(u.id);
  const a = await service.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (a.error) throw a.error;
  adminId = a.data.user.id;
  const o = await service.auth.admin.createUser({
    email: OTHER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (o.error) throw o.error;
  const ins = await service.from('admins').insert({ user_id: adminId });
  if (ins.error) throw ins.error;
  await service.from('listings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  admin = await userClient(ADMIN_EMAIL);
  other = await userClient(OTHER_EMAIL);
});
afterAll(async () => {
  await service?.from('listings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
});

const draft = { breed: 'bichon', name_he: 'טיוטה', description_he: 'תיאור', internal_note: 'SECRET-NOTE' };

describe('anon (public website) has no table access', () => {
  it('cannot select from listings / listing_images / admins', async () => {
    for (const t of ['listings', 'listing_images', 'admins']) {
      const { data, error } = await anon.from(t).select('*');
      expect(error, t).not.toBeNull();
      expect(data).toBeNull();
    }
  });
  it('cannot insert, update or delete listings', async () => {
    expect((await anon.from('listings').insert(draft)).error).not.toBeNull();
    expect(
      (await anon.from('listings').update({ published: true }).eq('breed', 'bichon')).error,
    ).not.toBeNull();
    expect((await anon.from('listings').delete().eq('breed', 'bichon')).error).not.toBeNull();
  });
  it('cannot call is_admin or reorder_images', async () => {
    expect((await anon.rpc('is_admin')).error).not.toBeNull();
    expect(
      (await anon.rpc('reorder_images', { p_listing_id: crypto.randomUUID(), p_ids: [] })).error,
    ).not.toBeNull();
  });
  it('cannot list either bucket', async () => {
    for (const b of ['listing-media-private', 'listing-media-public']) {
      const { data } = await anon.storage.from(b).list('listings');
      expect(data ?? []).toEqual([]);
    }
  });
});

describe('a signed-in non-admin user is equivalent to anon for data', () => {
  it('sees no rows and cannot write', async () => {
    const sel = await other.from('listings').select('*');
    expect(sel.error).toBeNull();
    expect(sel.data).toEqual([]);
    expect((await other.from('listings').insert(draft)).error).not.toBeNull();
    expect((await other.from('admins').select('*')).data).toEqual([]);
    const { data: isAdmin } = await other.rpc('is_admin');
    expect(isAdmin).toBe(false);
    const up = await other.storage
      .from('listing-media-private')
      .upload(`listings/${crypto.randomUUID()}/${crypto.randomUUID()}-640.jpg`, JPEG, {
        contentType: 'image/jpeg',
      });
    expect(up.error).not.toBeNull();
  });
});

describe('the owner (admins row) manages listings under RLS', () => {
  let listingId = '';
  const imageIds: string[] = [];

  it('creates a draft and is_admin() is true', async () => {
    expect((await admin.rpc('is_admin')).data).toBe(true);
    const { data, error } = await admin.from('listings').insert(draft).select('*').single();
    expect(error).toBeNull();
    listingId = data!.id;
    expect(data!.published).toBe(false);
  });
  it('cannot publish without an image (NO_IMAGE) and drafts stay invisible to anon', async () => {
    const { error } = await admin.from('listings').update({ published: true }).eq('id', listingId);
    expect(error?.message).toMatch(/NO_IMAGE/);
    const { data } = await anon.rpc('public_listings_json');
    expect(data).toEqual([]);
    expect((await anon.rpc('public_listing_json', { p_id: listingId })).data).toBeNull();
  });
  it('uploads derivatives only under the generated key shape', async () => {
    const bad = await admin.storage
      .from('listing-media-private')
      .upload(`listings/${listingId}/evil.jpg`, JPEG, { contentType: 'image/jpeg' });
    expect(bad.error).not.toBeNull();
    const badMime = await admin.storage
      .from('listing-media-private')
      .upload(`listings/${listingId}/${crypto.randomUUID()}-640.jpg`, Buffer.from('<svg/>'), {
        contentType: 'image/svg+xml',
      });
    expect(badMime.error).not.toBeNull();
    for (let i = 0; i < 3; i++) {
      const id = crypto.randomUUID();
      imageIds.push(id);
      for (const size of [1600, 640]) {
        const { error } = await admin.storage
          .from('listing-media-private')
          .upload(`listings/${listingId}/${id}-${size}.jpg`, JPEG, { contentType: 'image/jpeg' });
        expect(error).toBeNull();
      }
      const row = await admin
        .from('listing_images')
        .insert({ id, listing_id: listingId, position: i + 1, width: 640, height: 800 });
      expect(row.error).toBeNull();
    }
  });
  it('enforces the 3-image invariant in the database', async () => {
    const fourth = await admin
      .from('listing_images')
      .insert({ listing_id: listingId, position: 4, width: 1, height: 1 });
    expect(fourth.error).not.toBeNull();
    const dup = await admin
      .from('listing_images')
      .insert({ listing_id: listingId, position: 1, width: 1, height: 1 });
    expect(dup.error).not.toBeNull();
    const direct = await admin.from('listing_images').update({ position: 2 }).eq('id', imageIds[0]!);
    expect(direct.error).not.toBeNull(); // positions change only via reorder_images()
  });
  it('reorders in one call and rejects stale / partial / oversized id sets', async () => {
    const reversed = [imageIds[2]!, imageIds[1]!, imageIds[0]!];
    expect(
      (await admin.rpc('reorder_images', { p_listing_id: listingId, p_ids: reversed })).error,
    ).toBeNull();
    const { data } = await admin
      .from('listing_images')
      .select('id, position')
      .eq('listing_id', listingId)
      .order('position');
    expect(data!.map((r) => r.id)).toEqual(reversed);
    for (const ids of [
      [imageIds[0]!],
      [imageIds[0]!, imageIds[0]!, imageIds[1]!],
      [...reversed, crypto.randomUUID()],
      [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
    ]) {
      const { error } = await admin.rpc('reorder_images', { p_listing_id: listingId, p_ids: ids });
      expect(error?.message, JSON.stringify(ids)).toMatch(/STALE_ORDER/);
    }
    expect(
      (await other.rpc('reorder_images', { p_listing_id: listingId, p_ids: reversed })).error,
    ).not.toBeNull();
  });
  it('anon cannot read private objects even with the exact key', async () => {
    const key = `listings/${listingId}/${imageIds[0]}-640.jpg`;
    const { data, error } = await anon.storage.from('listing-media-private').download(key);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
    const res = await fetch(`${env.url}/storage/v1/object/public/listing-media-private/${key}`);
    expect(res.ok).toBe(false);
  });
  it('publishes (public copies then flag), updated_at moves, and the RPC exposes exactly the public keys', async () => {
    const before = (await admin.from('listings').select('updated_at').eq('id', listingId).single()).data!
      .updated_at;
    await new Promise((r) => setTimeout(r, 20));
    for (const id of imageIds)
      for (const size of [1600, 640]) {
        const { error } = await admin.storage
          .from('listing-media-public')
          .upload(`listings/${listingId}/${id}-${size}.jpg`, JPEG, {
            contentType: 'image/jpeg',
            upsert: true,
          });
        expect(error).toBeNull();
      }
    // retry-safety: uploading the same generated key again with upsert succeeds
    const again = await admin.storage
      .from('listing-media-public')
      .upload(`listings/${listingId}/${imageIds[0]}-640.jpg`, JPEG, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    expect(again.error).toBeNull();
    const { error } = await admin.from('listings').update({ published: true }).eq('id', listingId);
    expect(error).toBeNull();
    const after = (await admin.from('listings').select('updated_at').eq('id', listingId).single()).data!
      .updated_at;
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());

    const { data } = await anon.rpc('public_listings_json');
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    const row = data[0];
    expect(Object.keys(row).sort()).toEqual(
      [
        'birth_date',
        'breed',
        'dam_name',
        'description',
        'featured',
        'id',
        'images',
        'name',
        'pedigree',
        'sex',
        'show_prospect',
        'sire_name',
        'sort_order',
        'status',
        'updated_at',
      ].sort(),
    );
    expect(JSON.stringify(row)).not.toContain('SECRET-NOTE');
    expect(JSON.stringify(row)).not.toContain(adminId);
    expect(row.images).toHaveLength(3);
    expect(Object.keys(row.images[0]).sort()).toEqual([
      'height',
      'path_card',
      'path_large',
      'position',
      'width',
    ]);
    expect(row.images[0].path_card).toMatch(/^listings\/[0-9a-f-]{36}\/[0-9a-f-]{36}-640\.jpg$/);
    // the signed-in owner gets the same public view
    expect((await admin.rpc('public_listings_json')).data).toHaveLength(1);
    // and the public URL serves the copy without any policy
    const res = await fetch(
      `${env.url}/storage/v1/object/public/listing-media-public/${row.images[0].path_card}`,
    );
    expect(res.ok).toBe(true);
    // but the bucket is not listable anonymously
    expect(
      (await anon.storage.from('listing-media-public').list(`listings/${listingId}`)).data ?? [],
    ).toEqual([]);
  });
  it('archive requires unpublish (archived_not_published) and hides the listing', async () => {
    expect(
      (await admin.from('listings').update({ archived_at: new Date().toISOString() }).eq('id', listingId))
        .error,
    ).not.toBeNull();
    expect(
      (
        await admin
          .from('listings')
          .update({ published: false, archived_at: new Date().toISOString() })
          .eq('id', listingId)
      ).error,
    ).toBeNull();
    expect((await anon.rpc('public_listings_json')).data).toEqual([]);
    expect((await admin.from('listings').update({ archived_at: null }).eq('id', listingId)).error).toBeNull();
  });
  it('deleting the listing cascades its image rows', async () => {
    expect((await admin.from('listings').delete().eq('id', listingId)).error).toBeNull();
    expect((await admin.from('listing_images').select('id').eq('listing_id', listingId)).data).toEqual([]);
  });
});
