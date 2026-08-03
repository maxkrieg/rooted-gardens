'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

/**
 * Management route error boundary. Nested inside `app/management/layout.tsx`, so
 * the sidebar survives and the owner can navigate elsewhere instead of being
 * stranded on a dead screen — which matters more here than anywhere, since owners
 * hit these routes from a phone in the field.
 */
export default function ManagementError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[management/error]', error)
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
