import { z } from 'zod'
import { PHOTO_TYPES } from '@/types/app'

/** Metadata for a property-level photo. The image bytes never pass through this
 *  schema — they go browser → Supabase Storage directly (see photo-actions.ts). */
export const createPhotoSchema = z.object({
  property_id: z.string().min(1, 'Property is required'),
  storage_path: z.string().trim().min(1).max(512),
  type: z.enum(PHOTO_TYPES),
  caption: z.string().trim().max(280, 'Caption is too long').optional(),
})

export type CreatePhotoValues = z.infer<typeof createPhotoSchema>

export const updatePhotoSchema = z.object({
  caption: z.string().trim().max(280, 'Caption is too long').nullable().optional(),
  type: z.enum(PHOTO_TYPES).optional(),
})

export type UpdatePhotoValues = z.infer<typeof updatePhotoSchema>
