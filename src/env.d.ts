/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Supabase project URL (public by design; security is RLS). Empty in builds without a backend. */
  readonly PUBLIC_SUPABASE_URL?: string;
  /** Supabase publishable key (`sb_publishable_…`, public by design). */
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy JWT anon key; only for old setups. */
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly SB_INCLUDE_DEMO?: string;
  readonly SB_LISTING_LIMIT?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
