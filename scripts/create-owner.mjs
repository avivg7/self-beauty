#!/usr/bin/env node
/**
 * One-off, developer-machine only: create the single owner account and add it to the `admins` allowlist.
 * Secrets never pass through chat or Git — they come from a private env file (mode 600):
 *
 *   node --env-file=$HOME/.config/self-beauty/prod.env scripts/create-owner.mjs
 *
 * prod.env contains:
 *   SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SECRET_KEY=...        (dashboard → Project Settings → API keys → Secret keys; delete the file afterwards)
 *   OWNER_EMAIL=owner@example.com
 *   OWNER_PASSWORD=...                   (12+ characters; the owner can change it later via a reset link)
 */
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('missing SUPABASE_URL / SUPABASE_SECRET_KEY / OWNER_EMAIL / OWNER_PASSWORD (see header)');
  process.exit(2);
}
if (OWNER_PASSWORD.length < 12) {
  console.error('OWNER_PASSWORD must be at least 12 characters (project policy).');
  process.exit(2);
}
const svc = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: list, error: listErr } = await svc.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
let user = list.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
if (user) {
  const upd = await svc.auth.admin.updateUserById(user.id, { password: OWNER_PASSWORD, email_confirm: true });
  if (upd.error) throw upd.error;
  console.log(`user exists (${user.id}); password updated`);
} else {
  const res = await svc.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    email_confirm: true,
  });
  if (res.error) throw res.error;
  user = res.data.user;
  console.log(`user created (${user.id})`);
}
const ins = await svc.from('admins').upsert({ user_id: user.id });
if (ins.error) throw ins.error;
console.log('admins allowlist: ok');
const { count } = await svc.from('admins').select('*', { count: 'exact', head: true });
console.log(`admins rows: ${count}`);
