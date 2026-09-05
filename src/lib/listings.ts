import { getCollection, type CollectionEntry } from 'astro:content';
import { includeDemo } from '@/data/site';

export type Puppy = CollectionEntry<'puppies'>;
export type Litter = CollectionEntry<'litters'>;
export type Testimonial = CollectionEntry<'testimonials'>;

const STATUS_ORDER = { available: 0, 'coming-soon': 1, reserved: 2, planned: 3, placed: 4 } as const;

/** Published listings, demo records only in dev or when SB_INCLUDE_DEMO=1. */
/**
 * Dev-only: SB_LISTING_LIMIT=n truncates the list so 1/2/3/6-listing layouts can be reviewed with
 * demo fixtures. Ignored in production builds (where demo records are excluded anyway).
 */
const LISTING_LIMIT = includeDemo ? Number(import.meta.env.SB_LISTING_LIMIT) || 0 : 0;

export async function getPuppies(): Promise<Puppy[]> {
  const all = await getCollection('puppies', ({ data }) => data.published && (includeDemo || !data.demo));
  const sorted = all.sort(
    (a, b) =>
      STATUS_ORDER[a.data.status] - STATUS_ORDER[b.data.status] ||
      a.data.order - b.data.order ||
      a.id.localeCompare(b.id),
  );
  return LISTING_LIMIT > 0 ? sorted.slice(0, LISTING_LIMIT) : sorted;
}
export async function getFeaturedPuppies(limit = 3): Promise<Puppy[]> {
  const all = await getPuppies();
  const featured = all.filter((p) => p.data.featured);
  return (featured.length ? featured : all).slice(0, limit);
}
export async function getLitters(): Promise<Litter[]> {
  const all = await getCollection('litters', ({ data }) => data.published && (includeDemo || !data.demo));
  return all.sort((a, b) => a.data.order - b.data.order);
}
export async function getTestimonials(): Promise<Testimonial[]> {
  return getCollection('testimonials', ({ data }) => data.published && (includeDemo || !data.demo));
}
