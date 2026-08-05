import { z } from 'zod'
import { SITE_COLLECTIONS, SITE_CONTENT_KINDS, SITE_PAGES } from '@/types/app'

/**
 * Zod schemas for the owner-editable public site content
 * (`site_content` / `site_collection_items`, task 9.2). The DB stores
 * `site_collection_items.data` as an untyped jsonb blob — these schemas are
 * the only place its shape is enforced, on both the read layer
 * (lib/content/site.ts) and the 9.2.5 editor's Server Actions.
 */

// ─── site_content slots ────────────────────────────────────────────────────────

export const sitePageSchema = z.enum(SITE_PAGES)
export const siteContentKindSchema = z.enum(SITE_CONTENT_KINDS)

/** A single slot value as edited/saved. `text`/`image` accept any non-empty
 *  string; `email`/`phone`/`url` get a light format check so a bad edit fails
 *  fast in the editor rather than silently breaking a mailto:/tel:/href. */
export const siteSlotValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), value: z.string().trim().max(5000) }),
  z.object({ kind: z.literal('richtext'), value: z.string().trim().max(20000) }),
  z.object({ kind: z.literal('image'), value: z.string().trim().max(512) }),
  z.object({ kind: z.literal('email'), value: z.string().trim().email().max(320) }),
  z.object({ kind: z.literal('phone'), value: z.string().trim().min(7).max(40) }),
  z.object({ kind: z.literal('url'), value: z.string().trim().url().max(1000) }),
])

export const updateSiteSlotSchema = z.object({
  page: sitePageSchema,
  key: z.string().trim().min(1).max(100),
  kind: siteContentKindSchema,
  value: z.string().trim().max(20000),
})

export type UpdateSiteSlotValues = z.infer<typeof updateSiteSlotSchema>

// ─── site_collection_items ──────────────────────────────────────────────────────

export const siteCollectionSchema = z.enum(SITE_COLLECTIONS)

export const faqItemDataSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(300),
  answer: z.string().trim().min(1, 'Answer is required').max(3000),
})

export const jobItemDataSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  location: z.string().trim().max(150),
  blurb: z.string().trim().max(1000),
})

export const teamItemDataSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  role: z.string().trim().max(150),
  bio: z.string().trim().max(2000),
  image_path: z.string().trim().max(512).nullable(),
})

/** Picks the right item schema for a collection — the single point every
 *  reader/writer of `site_collection_items.data` should go through. */
export function collectionItemDataSchema(collection: z.infer<typeof siteCollectionSchema>) {
  switch (collection) {
    case 'faq':
      return faqItemDataSchema
    case 'job':
      return jobItemDataSchema
    case 'team':
      return teamItemDataSchema
  }
}

export const upsertCollectionItemSchema = z.object({
  id: z.string().uuid().optional(),
  collection: siteCollectionSchema,
  sortOrder: z.number().int().min(0),
  published: z.boolean(),
  data: z.record(z.string(), z.unknown()),
})

export type UpsertCollectionItemValues = z.infer<typeof upsertCollectionItemSchema>
