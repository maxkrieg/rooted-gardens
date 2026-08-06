import { extensionForMimeType } from './photos'

/**
 * Storage path for an owner-uploaded public-site image (task 9.2.5) — a
 * hero/section image slot, or a `team` collection item's photo. Mirrors
 * `propertyPhotoPath` in lib/utils/photos.ts: a UUID filename (not a
 * timestamp) so a multi-file scenario can't collide, and the size/type
 * validation (`validatePhotoFile`, `MAX_PHOTO_BYTES`, `ALLOWED_PHOTO_TYPES`
 * from that same file) is reused as-is — the `site-media` bucket was
 * deliberately given the same 20 MB / jpeg-png-webp limits as `photos`.
 *
 * `scope` groups uploads for easy auditing in the bucket browser, e.g.
 * `"home-hero_image"` for a slot or `"team"` for a collection item — it is
 * NOT a stable identifier callers should parse back out of the path.
 */
export function siteMediaPath(scope: string, mimeType: string): string {
  return `site-media/${scope}/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`
}

/**
 * Public URL for a `site-media` object. The `site-media` bucket is public
 * (unlike `photos`), so this is a deterministic string build — no signed
 * URL, no Supabase client/network round-trip needed — safe to call from
 * either a Server Component (e.g. rendering a team photo) or a Client
 * Component (EditableImage's preview), which is the point: one URL-shape
 * source of truth instead of two call sites agreeing by convention.
 */
export function siteMediaPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-media/${path}`
}
