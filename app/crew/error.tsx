'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

/**
 * Crew route error boundary. Nested inside `app/crew/layout.tsx` so the bottom
 * nav and the offline banner stay put — a crew member who hits this still needs
 * to be able to reach their other stops.
 *
 * Note this only catches render-phase throws. Query failures are handled inline
 * by each screen (see the stale-cache rule in CLAUDE.md), because replacing
 * cached stops with an error page would be the wrong answer in the field.
 */
export default function CrewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[crew/error]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <ErrorState
        title="This screen didn't load."
        hint="Try again. Anything you already logged is saved on your phone."
        onRetry={reset}
      />
    </div>
  )
}
