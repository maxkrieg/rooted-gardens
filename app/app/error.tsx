'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

/**
 * Nested inside `app/crew/layout.tsx` so the bottom nav and offline banner stay
 * put. Only catches render-phase throws — query failures are handled inline per
 * screen, since replacing cached stops with an error page is wrong in the field.
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
