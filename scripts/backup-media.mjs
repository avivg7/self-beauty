#!/usr/bin/env node
/**
 * Manual export of the private listing derivatives (see docs/RUNBOOK.md). Run on the developer machine only:
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=... node scripts/backup-media.mjs backups/2026-09-06/media
 * The service-role key is read from the environment for this run and never stored anywhere.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = process.argv[2];
const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const key = process.env.SUPABASE_SECRET_KEY ?? '';
if (!out || !url || !key) {
  console.error('usage: SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/backup-media.mjs <out-dir>');
  process.exit(2);
}
const bucket = 'listing-media-private';
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

async function list(prefix) {
  const res = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!res.ok) throw new Error(`list ${prefix}: ${res.status}`);
  return res.json();
}

let count = 0;
for (const folder of await list('listings')) {
  if (!folder.name || folder.id) continue; // folders come back without an id
  for (const obj of await list(`listings/${folder.name}`)) {
    if (!obj.id) continue;
    const objectPath = `listings/${folder.name}/${obj.name}`;
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, { headers });
    if (!res.ok) throw new Error(`download ${objectPath}: ${res.status}`);
    const file = path.join(out, objectPath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    count++;
  }
}
console.log(`saved ${count} files to ${out}`);
