'use client'

import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'

/**
 * Shown when the crew member's own employee record can't be loaded.
 *
 * This used to fail completely silently, and it degrades five things at once:
 * realtime sync never subscribes, the "My stops" filter stays disabled, History
 * is permanently `enabled: false`, and Profile shows an ellipsis forever. A crew
 * member would just see an app that had quietly stopped working.
 *
 * Only shown when there is no cached employee — with a cached record everything
 * keeps working offline, which is the point of the cache.
 */
export function SessionNotice() {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-[var(--clay)]/25 bg-[var(--clay)]/[0.08] px-4 py-2 text-sm text-foreground"
    >
      <TriangleAlert className="h-4 w-4 shrink-0 text-[var(--clay)]" aria-hidden />
      <span>We couldn&rsquo;t confirm who you are.</span>
      <Link href="/login" className="font-medium underline underline-offset-4">
        Sign in again
      </Link>
    </div>
  )
}
