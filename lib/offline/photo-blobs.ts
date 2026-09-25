import { getDB } from '@/lib/offline/idb'
import type { PhotoType } from '@/types/app'

/**
 * Photo bytes cached by storage_path for the field. Signed URLs rotate hourly, so a URL-keyed
 * cache can never hit.
 */
interface CachedPhoto {
  storagePath: string
  blob: Blob
  bytes: number
  lastUsedAt: number
}

/** ~100MB. Files can be 20MB each and property photos have no count cap, so
 *  without a ceiling one account could fill the device. */
const PHOTO_CACHE_MAX_BYTES = 100 * 1024 * 1024

/** Only the photos an owner needs at a property. */
const CACHEABLE_TYPES: ReadonlySet<string> = new Set<PhotoType>(['how_to', 'customer_request'])

export function isCacheablePhoto(type: string | null | undefined): boolean {
  return !!type && CACHEABLE_TYPES.has(type)
}

export async function getCachedPhoto(storagePath: string): Promise<Blob | null> {
  try {
    const db = await getDB()
    const row = (await db.get('photo-blobs', storagePath)) as CachedPhoto | undefined
    if (!row) return null
    // Touch for LRU. Fire-and-forget: a failed touch must not fail the read.
    void db.put('photo-blobs', { ...row, lastUsedAt: Date.now() }).catch(() => {})
    return row.blob
  } catch (err) {
    console.error('[photo-blobs] read', err)
    return null
  }
}

export async function putCachedPhoto(storagePath: string, blob: Blob): Promise<void> {
  try {
    const db = await getDB()
    await db.put('photo-blobs', {
      storagePath,
      blob,
      bytes: blob.size,
      lastUsedAt: Date.now(),
    } satisfies CachedPhoto)
    await evictToLimit()
  } catch (err) {
    // Storage pressure or private mode — the gallery still works online.
    console.error('[photo-blobs] write', err)
  }
}

/** Drops least-recently-used entries until the store is back under the cap. */
async function evictToLimit(): Promise<void> {
  const db = await getDB()
  const rows = (await db.getAll('photo-blobs')) as CachedPhoto[]
  let total = rows.reduce((sum, row) => sum + row.bytes, 0)
  if (total <= PHOTO_CACHE_MAX_BYTES) return

  const oldestFirst = [...rows].sort((a, b) => a.lastUsedAt - b.lastUsedAt)
  for (const row of oldestFirst) {
    if (total <= PHOTO_CACHE_MAX_BYTES) break
    await db.delete('photo-blobs', row.storagePath)
    total -= row.bytes
  }
}
