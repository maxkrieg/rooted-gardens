import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  PHOTO_TYPE_LABELS,
  type PhotoGroup,
  type PhotoGroupKey,
  type PhotoType,
  type PhotoWithUrl,
  type Property,
  type PropertyPhotos,
} from '@/types/app'

/** Photo validation for every upload to the `photos` bucket. Isomorphic: no server-only imports. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/** Mirrors the bucket's allowed_mime_types; the site-media bucket reuses these limits. */
export function extensionForMimeType(mime: string): 'jpg' | 'png' | 'webp' {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * Storage path for a property-level photo (no visit). UUID filename so a multi-file drop can't
 * collide — there's no UPDATE policy, so a collision is a 403.
 */
export function propertyPhotoPath(propertyId: string, mimeType: string): string {
  return `photos/${propertyId}/property/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`
}

/** Returns a human-readable reason the file can't be uploaded, or null if it's fine. */
export function validatePhotoFile(file: File): string | null {
  if (file.size > MAX_PHOTO_BYTES) return 'too large (max 20 MB)'
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return 'unsupported format (use JPEG, PNG, or WebP)'
  return null
}

/** Batch-sign paths in one round trip. Failed paths are absent from the Map. */
export async function signPhotoUrls(
  storage: SupabaseClient<Database>['storage'],
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths)]
  if (unique.length === 0) return new Map()

  const { data, error } = await storage.from('photos').createSignedUrls(unique, expiresIn)
  if (error) {
    console.error('[signPhotoUrls]', error)
    return new Map()
  }

  const urlByPath = new Map<string, string>()
  for (const entry of data ?? []) {
    // `path` is typed nullable and individual entries carry their own error.
    if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl)
  }
  return urlByPath
}

/** Gallery groups. before/after sit with visit photos; owner-authored `plan` gets its own. */
const GROUP_LABELS: Record<PhotoGroupKey, string> = {
  how_to: 'How-To Guide',
  customer_request: 'Customer Requests',
  visit: 'Visit Photos',
  reference: 'Visit Plan Reference',
  other: 'Other',
}

const GROUP_ORDER: PhotoGroupKey[] = [
  'how_to',
  'customer_request',
  'visit',
  'reference',
  'other',
]

/** Maps a raw `photos.type` to its UI group. The default branch is why an
 *  unrecognized type still shows up in the gallery. */
function photoGroupForType(type: string): PhotoGroupKey {
  switch (type) {
    case 'how_to':
      return 'how_to'
    case 'customer_request':
      return 'customer_request'
    case 'visit':
    case 'before':
    case 'after':
      return 'visit'
    case 'plan':
      return 'reference'
    default:
      return 'other'
  }
}

/** True for types that need a sub-badge on the thumbnail because their group
 *  label doesn't already say what they are. */
export function photoNeedsTypeBadge(type: string): boolean {
  return type === 'before' || type === 'after'
}

export function photoTypeLabel(type: string): string {
  return PHOTO_TYPE_LABELS[type as PhotoType] ?? 'Other'
}

/** Partition pre-sorted photos by property, then group. Properties with no photos are omitted. */
export function groupPhotosByProperty(
  properties: Pick<Property, 'id' | 'address'>[],
  photos: PhotoWithUrl[],
): PropertyPhotos[] {
  const byProperty = new Map<string, PhotoWithUrl[]>()
  for (const photo of photos) {
    const bucket = byProperty.get(photo.property_id)
    if (bucket) bucket.push(photo)
    else byProperty.set(photo.property_id, [photo])
  }

  const result: PropertyPhotos[] = []

  for (const property of properties) {
    const propertyPhotos = byProperty.get(property.id)
    if (!propertyPhotos || propertyPhotos.length === 0) continue

    const byGroup = new Map<PhotoGroupKey, PhotoWithUrl[]>()
    for (const photo of propertyPhotos) {
      const key = photoGroupForType(photo.type)
      const bucket = byGroup.get(key)
      if (bucket) bucket.push(photo)
      else byGroup.set(key, [photo])
    }

    const groups: PhotoGroup[] = []
    for (const key of GROUP_ORDER) {
      const groupPhotos = byGroup.get(key)
      if (groupPhotos && groupPhotos.length > 0) {
        groups.push({ key, label: GROUP_LABELS[key], photos: groupPhotos })
      }
    }

    result.push({
      propertyId: property.id,
      address: property.address,
      groups,
      total: propertyPhotos.length,
    })
  }

  return result
}
