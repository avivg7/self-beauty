/**
 * Public read path for live puppy listings (Lean V1). Plain fetch with the anon key — never supabase-js,
 * never a user session — so the public site is always anonymous. Every row is validated before use;
 * malformed rows are skipped, never fatal.
 */
export type Locale = 'he' | 'ru' | 'en';
export type Breed = 'yorkshire' | 'poodle' | 'bichon' | 'pomeranian' | 'shihtzu';
export type ListingStatus = 'available' | 'reserved' | 'coming_soon' | 'placed';
export interface PublicImage {
  position: number;
  width: number;
  height: number;
  urlLarge: string;
  urlCard: string;
}
export interface PublicListing {
  id: string;
  breed: Breed;
  sex: 'male' | 'female' | 'unspecified';
  birthDate: string | null;
  status: ListingStatus;
  featured: boolean;
  updatedAt: string;
  name: Record<Locale, string | null>;
  description: Record<Locale, string | null>;
  pedigree: Record<Locale, string | null>;
  sireName: string | null;
  damName: string | null;
  showProspect: boolean;
  images: PublicImage[];
}

export const SUPABASE_URL = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
export const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
export const PUBLIC_BUCKET = 'listing-media-public';
export const isConfigured = () => SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

const BREEDS = new Set<Breed>(['yorkshire', 'poodle', 'bichon', 'pomeranian', 'shihtzu']);
const STATUSES = new Set<ListingStatus>(['available', 'reserved', 'coming_soon', 'placed']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = /^listings\/[0-9a-f-]{36}\/[0-9a-f-]{36}-(1600|640)\.jpg$/;

export function publicImageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length ? v : null;
}
function loc(v: unknown): Record<Locale, string | null> {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { he: str(o.he), ru: str(o.ru), en: str(o.en) };
}

/** Returns a validated listing or null when the row is unusable. */
export function normalizeListing(raw: unknown): PublicListing | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !UUID.test(r.id)) return null;
  if (!BREEDS.has(r.breed as Breed) || !STATUSES.has(r.status as ListingStatus)) return null;
  const name = loc(r.name);
  if (!name.he) return null;
  const images: PublicImage[] = [];
  for (const im of Array.isArray(r.images) ? r.images : []) {
    const i = im as Record<string, unknown>;
    if (
      typeof i.path_large !== 'string' ||
      typeof i.path_card !== 'string' ||
      !PATH.test(i.path_large) ||
      !PATH.test(i.path_card)
    )
      continue;
    const w = Number(i.width),
      h = Number(i.height),
      p = Number(i.position);
    if (!(w > 0 && h > 0 && p >= 1 && p <= 3)) continue;
    images.push({
      position: p,
      width: w,
      height: h,
      urlLarge: publicImageUrl(i.path_large),
      urlCard: publicImageUrl(i.path_card),
    });
  }
  images.sort((a, b) => a.position - b.position);
  if (!images.length) return null; // the card design requires a photo
  return {
    id: r.id,
    breed: r.breed as Breed,
    sex: r.sex === 'male' || r.sex === 'female' ? r.sex : 'unspecified',
    birthDate: typeof r.birth_date === 'string' ? r.birth_date : null,
    status: r.status as ListingStatus,
    featured: r.featured === true,
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : new Date().toISOString(),
    name,
    description: loc(r.description),
    pedigree: loc(r.pedigree),
    sireName: str(r.sire_name),
    damName: str(r.dam_name),
    showProspect: r.show_prospect === true,
    images,
  };
}

async function rpc(name: string, body: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`rpc ${name} ${res.status}`);
  return res.json();
}

export async function fetchPublicListings(timeoutMs = 8000): Promise<PublicListing[]> {
  if (!isConfigured()) throw new Error('not configured');
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const data = await rpc('public_listings_json', {}, ac.signal);
    return (Array.isArray(data) ? data : [])
      .map(normalizeListing)
      .filter((x): x is PublicListing => x !== null);
  } finally {
    clearTimeout(t);
  }
}

export async function fetchPublicListing(id: string, timeoutMs = 8000): Promise<PublicListing | null> {
  if (!isConfigured()) throw new Error('not configured');
  if (!UUID.test(id)) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const data = await rpc('public_listing_json', { p_id: id }, ac.signal);
    return data ? normalizeListing(data) : null;
  } finally {
    clearTimeout(t);
  }
}

/** Status keys in the DB use underscores; the dictionaries use hyphens. */
export const statusKey = (s: ListingStatus): 'available' | 'reserved' | 'coming-soon' | 'placed' =>
  s === 'coming_soon' ? 'coming-soon' : s;
