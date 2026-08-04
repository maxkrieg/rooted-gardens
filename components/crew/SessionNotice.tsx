'use client'

import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'

/**
 * The crew member's own employee record couldn't load. This used to fail
 * silently while degrading realtime sync, "My stops", History, and Profile all at
 * once. Only shown with no cached employee — a cached one still works offline.
 */
export function SessionNotice() {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-[var(--clay)]/25 bg-[var(--clay)]/[0.08] px-4 py-2 text-sm text-foreground"
    >
      <TriangleAlert className="h-4 w-4 shrink-0 text-[var(--clay)]" aria-hidden />
      <span>We couldn&rsquo;t confirm who you are.</span>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
      >
        Sign in again
      </Link>
    </div>
  )
}
