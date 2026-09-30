'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

/** Catch-all for segments with no closer error.tsx. Logged, never rendered. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app/error]', error)
    // A digest means it was thrown on the server, where onRequestError already reported it.
    if (!error.digest) Sentry.captureException(error, { tags: { context: '[app/error]' } })
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
