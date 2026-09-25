import { z } from 'zod'
import { SITE_COLLECTIONS, SITE_PAGES } from '@/types/app'

/** The only place site_collection_items.data's shape is enforced, on read and on save. */

// ─── site_content slots ────────────────────────────────────────────────────────

const sitePageSchema = z.enum(SITE_PAGES)

/** Plain-string slots only; richtext uses updateRichTextSlotSchema. */
const simpleContentKindSchema = z.enum(['text', 'image', 'email', 'phone', 'url'])

/**
 * Per-kind format check so a bad edit can't break a mailto:/tel:/href. superRefine keeps one
 * flat shape.
 */
export const updateSiteSlotSchema = z
  .object({
    page: sitePageSchema,
    key: z.string().trim().min(1).max(100),
    kind: simpleContentKindSchema,
    value: z.string().trim().max(20000),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'email' && !z.email().safeParse(data.value).success) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a valid email address' })
    }
    if (data.kind === 'url' && !z.url().safeParse(data.value).success) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a valid URL' })
    }
    if (data.kind === 'phone' && data.value.length < 7) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a valid phone number' })
    }
  })

export type UpdateSiteSlotValues = z.infer<typeof updateSiteSlotSchema>

/** `doc` is only shape-checked here; the action's generateHTML does the real validation. */
export const richTextDocSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.unknown()),
})

export const updateRichTextSlotSchema = z.object({
  page: sitePageSchema,
  key: z.string().trim().min(1).max(100),
  doc: richTextDocSchema,
})

export type UpdateRichTextSlotValues = z.infer<typeof updateRichTextSlotSchema>

// ─── site_collection_items ──────────────────────────────────────────────────────

export const siteCollectionSchema = z.enum(SITE_COLLECTIONS)

const faqItemDataSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(300),
  answer: z.string().trim().min(1, 'Answer is required').max(3000),
})

export const jobItemDataSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  location: z.string().trim().max(150),
  blurb: z.string().trim().max(1000),
})

const teamItemDataSchema = z.object({
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

/** Clients never set sortOrder or published here; reorder via moveCollectionItem. */
export const upsertCollectionItemSchema = z.object({
  id: z.string().uuid().optional(),
  collection: siteCollectionSchema,
  data: z.record(z.string(), z.unknown()),
})

export type UpsertCollectionItemValues = z.infer<typeof upsertCollectionItemSchema>

export const deleteCollectionItemSchema = z.object({
  collection: siteCollectionSchema,
  id: z.string().uuid(),
})

export type DeleteCollectionItemValues = z.infer<typeof deleteCollectionItemSchema>

export const moveCollectionItemSchema = z.object({
  collection: siteCollectionSchema,
  id: z.string().uuid(),
  direction: z.enum(['up', 'down']),
})

export type MoveCollectionItemValues = z.infer<typeof moveCollectionItemSchema>
