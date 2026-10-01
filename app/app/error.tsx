'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

/**
 * Nested under the app layout so the nav and offline banner stay. Render throws only: query
 * failures are handled inline so cached data isn't replaced by an error page.
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
    // A digest means it was thrown on the server, where onRequestError already reported it.
    if (!error.digest) Sentry.captureException(error, { tags: { context: '[crew/error]' } })
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
