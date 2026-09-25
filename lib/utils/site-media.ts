import { extensionForMimeType } from './photos'

/**
 * Storage path for a public-site image. UUID filename, same limits as `photos`. `scope` is for
 * browsing the bucket, not for parsing back out.
 */
export function siteMediaPath(scope: string, mimeType: string): string {
  return `site-media/${scope}/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`
}

/** Public URL for a `site-media` object: a plain string build, usable on server or client. */
export function siteMediaPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-media/${path}`
}
