import { defineCollection } from 'astro:content';
import { z } from 'astro:schema';
import { glob } from 'astro/loaders';

const localized = z.object({ he: z.string(), ru: z.string(), en: z.string() });
const localizedOptional = z
  .object({ he: z.string().optional(), ru: z.string().optional(), en: z.string().optional() })
  .optional();

export const BREEDS = ['yorkshire', 'poodle', 'bichon', 'pomeranian', 'shihtzu'] as const;
export const STATUSES = ['available', 'reserved', 'planned', 'placed', 'coming-soon'] as const;

const parent = z
  .object({
    name: z.string(),
    /** Only titles verified from source material. Displayed with the rosette mark. */
    titles: z.array(z.string()).default([]),
    verified: z.boolean().default(false),
    note: z.string().optional(),
  })
  .optional();

const image = z.object({
  /** Media id from scripts/media/manifest.json (e.g. "years/bichon-puppy-bows") */
  media: z.string(),
  alt: localized,
});

const puppies = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/puppies' }),
  schema: z.object({
    name: localized,
    breed: z.enum(BREEDS),
    sex: z.enum(['male', 'female', 'mixed']),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    status: z.enum(STATUSES),
    description: localized,
    pedigreeSummary: localizedOptional,
    parents: z.object({ sire: parent, dam: parent }).optional(),
    showProspect: z.boolean().default(false),
    breedingProspect: z.boolean().default(false),
    images: z.array(image).min(1).max(3),
    video: z.string().optional(),
    order: z.number().int().default(100),
    featured: z.boolean().default(false),
    published: z.boolean().default(false),
    /** DEMO records are excluded from production builds. Never mark real data as demo. */
    demo: z.boolean().default(false),
    internalNote: z.string().optional(),
    updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

const litters = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/litters' }),
  schema: z.object({
    breed: z.enum(BREEDS),
    expected: z.string().optional(),
    expectedLabel: localizedOptional,
    parents: z.object({ sire: parent, dam: parent }).optional(),
    note: localizedOptional,
    published: z.boolean().default(false),
    demo: z.boolean().default(false),
    order: z.number().int().default(100),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/testimonials' }),
  schema: z.object({
    /** Language the testimonial was written in */
    sourceLang: z.enum(['he', 'ru', 'en']),
    /** Full text, paragraphs, per language. Translations are marked as such in the UI. */
    text: z.object({ he: z.array(z.string()), ru: z.array(z.string()), en: z.array(z.string()) }),
    /** Neutral attribution; never an invented identity */
    attribution: localizedOptional,
    breed: z.enum(BREEDS).optional(),
    headline: localizedOptional,
    featured: z.boolean().default(false),
    published: z.boolean().default(false),
    demo: z.boolean().default(false),
    date: z.string().optional(),
  }),
});

export const collections = { puppies, litters, testimonials };
