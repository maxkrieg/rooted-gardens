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

/** `updateSiteSlot` (app/(public)/actions.ts) only ever handles a plain-string
 *  value — richtext goes through `updateRichTextSlotSchema` below instead,
 *  since its value is `{ doc, html }`, not a string. */
export const simpleContentKindSchema = z.enum(['text', 'image', 'email', 'phone', 'url'])

/** Per-kind format check on top of the base length cap — a bad edit fails
 *  fast in the editor rather than silently breaking a mailto:/tel:/href on
 *  the live site. `superRefine` (not a discriminated union) so the action
 *  still gets back one flat, uniform `{page,key,kind,value}` shape. */
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

/**
 * `updateRichTextSlot` — `doc` is only shape-checked here (a real ProseMirror
 * document, not arbitrary JSON); full structural validity is enforced by
 * `getSchema`/`Node.fromJSON` throwing inside the action if the shape doesn't
 * actually match the extension set in lib/content/richtext-schema.ts.
 */
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

/** `sortOrder` and `published` are deliberately not client inputs here —
 *  mirrors `route_groups`' `createRouteGroup` (append at max+1) /
 *  `updateRouteGroup` (only touches the edited fields, never `sort_order`)
 *  split: `upsertCollectionItem` only ever writes `data`; reordering goes
 *  through the dedicated `moveCollectionItem` action below. */
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
