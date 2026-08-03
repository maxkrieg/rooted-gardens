'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

/**
 * App-wide route error boundary. Catches anything thrown while rendering a
 * segment that has no closer `error.tsx` — the login page, the auth callback,
 * and the root redirect.
 *
 * The `error` object is logged and never rendered: in production Next replaces
 * the message with a digest anyway, and in development it would be the raw
 * Postgres text that task 8.5 exists to keep off the screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/error]', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <ErrorState
        title="Something stopped this page from loading."
        hint="Trying again usually works. If it keeps happening, tell an owner."
        onRetry={reset}
      />
    </div>
  )
}
