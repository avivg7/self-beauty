import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
/** Publishable key (`sb_publishable_…`, current key model); a legacy JWT anon key still works for old setups. */
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
export const configured = SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;

/** Admin client. Distinct storage key so the session never collides with anything else on the shared Pages origin. */
export const supabase = createClient(
  SUPABASE_URL || 'http://localhost',
  SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_unconfigured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sb-selfbeauty-admin',
    },
  },
);

export const PRIVATE_BUCKET = 'listing-media-private';
export const PUBLIC_BUCKET = 'listing-media-public';
export const imagePath = (listingId: string, imageId: string, size: 1600 | 640) =>
  `listings/${listingId}/${imageId}-${size}.jpg`;
export const publicImageUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
