'use client'

import { useEffect, useRef, useState } from 'react'
import { getCachedPhoto, isCacheablePhoto, putCachedPhoto } from '@/lib/offline/photo-blobs'

type CacheablePhoto = { storage_path: string; type: string | null }

/**
 * Object URLs for photos whose bytes are cached on the device, plus a warm pass
 * that caches new ones while a signed URL is available.
 *
 * Signed URLs win when present — they cost nothing and avoid holding blobs in
 * memory. These are the fallback that makes a gate-code photo readable offline.
 */
export function useCachedPhotoUrls(
  photos: CacheablePhoto[],
  // Pass React Query's `data` straight through, undefined and all: its identity
  // is stable between renders, whereas a `?? {}` default at the call site would
  // be a fresh object every render and re-run the warm pass forever.
  signedUrls: Record<string, string> | undefined,
): Record<string, string> {
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({})
  // Source of truth for what we've created, so a re-run can't mint a second URL
  // for the same blob and leak the first.
  const createdRef = useRef(new Map<string, string>())
  const cacheablePaths = photos
    .filter((p) => isCacheablePhoto(p.type))
    .map((p) => p.storage_path)
    .sort()
    .join(',')
  useEffect(() => {
    let cancelled = false
    const paths = cacheablePaths ? cacheablePaths.split(',') : []

    async function run() {
      for (const path of paths) {
        if (cancelled) return
        if (createdRef.current.has(path)) continue

        let blob = await getCachedPhoto(path)

        // Not cached yet — pull the bytes while a signed URL exists.
        if (!blob) {
          const signed = signedUrls?.[path]
          if (!signed) continue
          try {
            const res = await fetch(signed)
            if (!res.ok) continue
            blob = await res.blob()
            await putCachedPhoto(path, blob)
          } catch {
            // Offline, or the URL expired. Nothing to cache and nothing to say.
            continue
          }
        }
        if (cancelled || createdRef.current.has(path)) continue

        const url = URL.createObjectURL(blob)
        createdRef.current.set(path, url)
        setObjectUrls((prev) => ({ ...prev, [path]: url }))
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [cacheablePaths, signedUrls])

  useEffect(() => {
    const created = createdRef.current
    return () => {
      for (const url of created.values()) URL.revokeObjectURL(url)
      created.clear()
    }
  }, [])

  return objectUrls
}
