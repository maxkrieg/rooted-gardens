'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/states/ErrorState'

/**
 * Catches anything thrown by a segment with no closer `error.tsx` — login, the
 * auth callback, the root redirect. The error is logged, never rendered.
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
