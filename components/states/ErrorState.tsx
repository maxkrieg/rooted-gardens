'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StateMark } from '@/components/states/StateMark'
import { cn } from '@/lib/utils'

/**
 * Full-surface failure — neither `title` nor `hint` ever carries an error
 * message. With no `onRetry` the button refreshes the route; client surfaces
 * holding their own cache pass `refetch` so retrying doesn't discard it.
 */
export function ErrorState({
  title = "That didn't load.",
  hint = 'Check your connection, then try again.',
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title?: string
  hint?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRetry() {
    if (onRetry) {
      onRetry()
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-14 text-center',
        className,
      )}
    >
      <StateMark variant="broken" />
      <div className="max-w-xs">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      <Button variant="outline" onClick={handleRetry} disabled={isPending}>
        <RotateCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
        {isPending ? 'Retrying…' : retryLabel}
      </Button>
    </div>
  )
}

/**
 * One section of an otherwise-healthy page failed. Blanking the dashboard because
 * the fleet query timed out would hide the schedule the owner came for, so
 * failures report at section granularity and the rest still renders.
 */
export function SectionError({
  title = "This didn't load.",
  hint = 'Refresh to try again.',
  onRetry,
  className,
}: {
  title?: string
  hint?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <Alert variant="warning" className={cn(className)}>
      <TriangleAlert className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{hint}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Try again
          </button>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Stale-data hairline for `/crew/*`. A refresh failure annotates the data crew
 * already have rather than replacing it (CLAUDE.md, "show stale data gracefully").
 */
export function StaleNotice({ className }: { className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-center justify-center gap-1.5 border-b border-[var(--ochre)]/25 bg-[var(--ochre)]/[0.08] px-4 py-1.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ochre)]"
      />
      Couldn&rsquo;t refresh &middot; showing what was last saved
    </p>
  )
}
