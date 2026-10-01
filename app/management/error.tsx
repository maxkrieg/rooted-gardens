'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

/** Nested under the management layout so the nav survives. */
export default function ManagementError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[management/error]', error)
    // A digest means it was thrown on the server, where onRequestError already reported it.
    if (!error.digest) Sentry.captureException(error, { tags: { context: '[management/error]' } })
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorState
        title="This page didn't load."
        hint="Check your connection, then try again. Nothing was lost."
        onRetry={reset}
      />
    </div>
  )
}
