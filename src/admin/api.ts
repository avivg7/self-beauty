/**
 * Admin data access (Lean V1). Every call runs under the owner's session and RLS. Publish/unpublish are the
 * plain flows from the design: copy public files first, flip `published` last; unpublish flips first, cleans up after.
 */
import { supabase, PRIVATE_BUCKET, PUBLIC_BUCKET, imagePath } from './client';
import { prepareDerivatives, type Derivatives } from './image-pipeline';

export type Breed = 'yorkshire' | 'poodle' | 'bichon' | 'pomeranian' | 'shihtzu';
export type Sex = 'male' | 'female' | 'unspecified';
export type Status = 'available' | 'reserved' | 'coming_soon' | 'placed';
export const BREEDS: Breed[] = ['yorkshire', 'poodle', 'bichon', 'pomeranian', 'shihtzu'];
export const STATUSES: Status[] = ['available', 'reserved', 'coming_soon', 'placed'];

export interface ListingImage {
  id: string;
  listing_id: string;
  position: number;
  width: number;
  height: number;
  created_at: string;
}
export interface Listing {
  id: string;
  created_at: string;
  updated_at: string;
  breed: Breed;
  sex: Sex;
  birth_date: string | null;
  status: Status;
  published: boolean;
  featured: boolean;
  archived_at: string | null;
  sort_order: number;
  name_he: string;
  name_ru: string | null;
  name_en: string | null;
  description_he: string;
  description_ru: string | null;
  description_en: string | null;
  pedigree_he: string | null;
  pedigree_ru: string | null;
  pedigree_en: string | null;
  sire_name: string | null;
  dam_name: string | null;
  show_prospect: boolean;
  internal_note: string | null;
  listing_images: ListingImage[];
}
export type ListingInput = Omit<
  Listing,
  'id' | 'created_at' | 'updated_at' | 'published' | 'archived_at' | 'listing_images'
>;
/** Fields the admin may change on an existing row (publish/archive flags included). */
export type ListingPatch = Partial<ListingInput & Pick<Listing, 'published' | 'archived_at'>>;

export class ApiError extends Error {
  constructor(
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}
const wrap = (e: unknown): never => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/NO_IMAGE/.test(msg)) throw new ApiError('NO_IMAGE');
  if (/MISSING_HEBREW_TEXT/.test(msg)) throw new ApiError('MISSING_HEBREW_TEXT');
  if (/STALE_ORDER/.test(msg)) throw new ApiError('STALE_ORDER');
  if (/duplicate key|unique/i.test(msg)) throw new ApiError('LIMIT_REACHED');
  if (/JWT|jwt expired|invalid claim|401|Unauthorized|not authenticated/i.test(msg))
    throw new ApiError('UNAUTHORIZED', msg);
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(msg)) throw new ApiError('NETWORK', msg);
  throw new ApiError('UNKNOWN', msg);
};

const SELECT = '*, listing_images(*)';
const sortImages = (l: Listing): Listing => ({
  ...l,
  listing_images: [...(l.listing_images ?? [])].sort((a, b) => a.position - b.position),
});

export async function listListings(archived: boolean): Promise<Listing[]> {
  let q = supabase
    .from('listings')
    .select(SELECT)
    .order('sort_order')
    .order('created_at', { ascending: false });
  q = archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
  const { data, error } = await q;
  if (error) wrap(error);
  return (data as Listing[]).map(sortImages);
}
export async function getListing(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from('listings').select(SELECT).eq('id', id).maybeSingle();
  if (error) wrap(error);
  return data ? sortImages(data as Listing) : null;
}
export async function createListing(input: ListingInput): Promise<Listing> {
  const { data, error } = await supabase.from('listings').insert(input).select(SELECT).single();
  if (error) wrap(error);
  return sortImages(data as Listing);
}
export async function updateListing(id: string, patch: ListingPatch): Promise<Listing> {
  const { data, error } = await supabase.from('listings').update(patch).eq('id', id).select(SELECT).single();
  if (error) wrap(error);
  return sortImages(data as Listing);
}

// ---------- images ----------
const privatePaths = (l: string, i: string) => [imagePath(l, i, 1600), imagePath(l, i, 640)];

/**
 * Copy both derivatives of one image to the public bucket. `upsert: true` makes a retry after a partial
 * publish succeed (Finding 3): an existing destination under the same generated key is the same file.
 */
async function copyToPublic(
  listingId: string,
  imageId: string,
  blobs?: { large: Blob; card: Blob },
): Promise<void> {
  const [pLarge, pCard] = privatePaths(listingId, imageId) as [string, string];
  const pairs: [string, Blob | null][] = [
    [pLarge, blobs?.large ?? null],
    [pCard, blobs?.card ?? null],
  ];
  for (const [path, known] of pairs) {
    let body = known;
    if (!body) {
      const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).download(path);
      if (error || !data) wrap(error ?? new Error('download failed'));
      body = data!;
    }
    const up = await supabase.storage
      .from(PUBLIC_BUCKET)
      .upload(path, body, { contentType: 'image/jpeg', upsert: true, cacheControl: '86400' });
    if (up.error) wrap(up.error);
  }
}
async function removeFromBucket(bucket: string, paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) wrap(error);
}

/**
 * Add one image (Finding 6 ordering): private upload → public upload (only when the listing is published)
 * → DB row insert. The public site derives image paths from rows, so a row never points at a missing
 * public file. Every image gets a fresh id; "replace" is remove + add, never an overwrite of a cached key.
 */
export interface AddedImage {
  image: ListingImage;
  preview: Blob;
}
export type UploadPhase = 'processing' | 'uploading';

export async function addImage(
  listing: Listing,
  file: File,
  onPhase?: (p: UploadPhase) => void,
): Promise<AddedImage> {
  if (listing.listing_images.length >= 3) throw new ApiError('LIMIT_REACHED');
  onPhase?.('processing');
  const d: Derivatives = await prepareDerivatives(file);
  onPhase?.('uploading');
  return uploadPrepared(listing, d, listing.listing_images.length + 1);
}

/**
 * Replace = remove + add under a NEW id at the same position (Finding 6). Derivatives are prepared first so a
 * bad file fails before anything is touched. If the upload fails after the removal, the listing simply has one
 * image fewer and the owner sees the error.
 */
export async function replaceImage(
  listing: Listing,
  oldId: string,
  file: File,
  onPhase?: (p: UploadPhase) => void,
): Promise<AddedImage> {
  const old = listing.listing_images.find((i) => i.id === oldId);
  if (!old) throw new ApiError('STALE_ORDER');
  onPhase?.('processing');
  const d: Derivatives = await prepareDerivatives(file);
  onPhase?.('uploading');
  await removeImage(listing, oldId);
  const remaining = listing.listing_images.filter((i) => i.id !== oldId);
  const added = await uploadPrepared({ ...listing, listing_images: remaining }, d, remaining.length + 1);
  if (old.position <= remaining.length) {
    const ids = remaining.map((i) => i.id);
    ids.splice(old.position - 1, 0, added.image.id);
    await reorderImages(listing.id, ids);
  }
  return added;
}

async function uploadPrepared(listing: Listing, d: Derivatives, position: number): Promise<AddedImage> {
  const imageId = crypto.randomUUID();
  const [pLarge, pCard] = privatePaths(listing.id, imageId) as [string, string];
  const cleanup = () =>
    Promise.all([
      removeFromBucket(PRIVATE_BUCKET, [pLarge, pCard]).catch(() => {}),
      listing.published
        ? removeFromBucket(PUBLIC_BUCKET, [pLarge, pCard]).catch(() => {})
        : Promise.resolve(),
    ]);
  const u1 = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(pLarge, d.large, { contentType: 'image/jpeg', upsert: false, cacheControl: '86400' });
  if (u1.error) wrap(u1.error);
  const u2 = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(pCard, d.card, { contentType: 'image/jpeg', upsert: false, cacheControl: '86400' });
  if (u2.error) {
    await cleanup();
    wrap(u2.error);
  }
  if (listing.published) {
    try {
      await copyToPublic(listing.id, imageId, { large: d.large, card: d.card });
    } catch (e) {
      await cleanup();
      throw e;
    }
  }
  const { data, error } = await supabase
    .from('listing_images')
    .insert({ id: imageId, listing_id: listing.id, position, width: d.width, height: d.height })
    .select('*')
    .single();
  if (error) {
    await cleanup();
    wrap(error);
  }
  return { image: data as ListingImage, preview: d.card };
}

/** Remove one image: DB row first, then storage cleanup (Finding 6). Missing objects are not an error. */
export async function removeImage(listing: Listing, imageId: string): Promise<void> {
  const { error } = await supabase.from('listing_images').delete().eq('id', imageId);
  if (error) wrap(error);
  const remaining = listing.listing_images.filter((i) => i.id !== imageId).map((i) => i.id);
  if (remaining.length) await reorderImages(listing.id, remaining); // re-pack positions 1..n
  await removeFromBucket(PRIVATE_BUCKET, privatePaths(listing.id, imageId)).catch(() => {});
  await removeFromBucket(PUBLIC_BUCKET, privatePaths(listing.id, imageId)).catch(() => {});
}

export async function reorderImages(listingId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_images', { p_listing_id: listingId, p_ids: ids });
  if (error) wrap(error);
}

// ---------- publish / unpublish / archive / delete ----------
export async function publishListing(listing: Listing): Promise<Listing> {
  if (!listing.listing_images.length) throw new ApiError('NO_IMAGE');
  if (!listing.name_he.trim() || !listing.description_he.trim()) throw new ApiError('MISSING_HEBREW_TEXT');
  for (const im of listing.listing_images) await copyToPublic(listing.id, im.id); // public copies first
  return updateListing(listing.id, { published: true }); // then flip
}
export interface UnpublishResult {
  listing: Listing;
  cleanupFailed: boolean;
}
export async function unpublishListing(listing: Listing): Promise<UnpublishResult> {
  const updated = await updateListing(listing.id, { published: false }); // hide first
  let cleanupFailed = false;
  try {
    await removeFromBucket(
      PUBLIC_BUCKET,
      listing.listing_images.flatMap((i) => privatePaths(listing.id, i.id)),
    );
  } catch {
    cleanupFailed = true;
  }
  return { listing: updated, cleanupFailed };
}
export async function archiveListing(listing: Listing): Promise<UnpublishResult> {
  const r = listing.published ? await unpublishListing(listing) : { listing, cleanupFailed: false };
  const updated = await updateListing(listing.id, {
    archived_at: new Date().toISOString(),
  });
  return { listing: updated, cleanupFailed: r.cleanupFailed };
}
export async function restoreListing(listing: Listing): Promise<Listing> {
  return updateListing(listing.id, { archived_at: null });
}
export async function deleteListing(listing: Listing): Promise<void> {
  const paths = listing.listing_images.flatMap((i) => privatePaths(listing.id, i.id));
  await removeFromBucket(PUBLIC_BUCKET, paths);
  await removeFromBucket(PRIVATE_BUCKET, paths);
  const { error } = await supabase.from('listings').delete().eq('id', listing.id);
  if (error) wrap(error);
}

/** Signed URL for admin previews of private derivatives (1 hour). */
export async function previewUrl(listingId: string, imageId: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(imagePath(listingId, imageId, 640), 3600);
  return data?.signedUrl ?? null;
}
