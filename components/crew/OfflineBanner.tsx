'use client'

import { useState } from 'react'
import { useOfflineStatus } from '@/hooks/crew/useOfflineStatus'
import { StuckChangesSheet } from '@/components/crew/StuckChangesSheet'

/**
 * The crew shell's connectivity strip. Three states, in escalating order:
 *
 *   clay  — something didn't save and has stopped retrying. Tappable; this is
 *           the only one that demands attention, and it wins over the others
 *           because a lost completion is a lost invoice (task 8.5).
 *   ochre — offline. Expected in the field, so it informs rather than alarms.
 *   sage  — online with work still syncing.
 *
 * Before 8.5 there was no clay state: a permanently failing mutation kept the
 * queue non-empty, so this sat on "Syncing 1 change…" forever and the crew
 * member had no way to know their work never landed.
 */
export function OfflineBanner() {
  const { isOnline, pendingCount, failedCount, refreshCount } = useOfflineStatus()
  const [reviewOpen, setReviewOpen] = useState(false)

  if (isOnline && pendingCount === 0 && failedCount === 0) return null

  if (failedCount > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="sticky top-0 z-40 flex w-full min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-sans font-medium"
          style={{
            backgroundColor: 'oklch(from var(--clay) l c h / 0.14)',
            color: 'var(--bark)',
            borderBottom: '1px solid oklch(from var(--clay) l c h / 0.3)',
          }}
        >
          <span
            className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: 'var(--clay)' }}
            aria-hidden
          />
          {failedCount} {failedCount === 1 ? 'change' : 'changes'} didn&rsquo;t save
          <span className="underline underline-offset-4">Review</span>
        </button>
        <StuckChangesSheet
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onChanged={refreshCount}
        />
      </>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 text-sm font-sans font-medium"
      style={{
        backgroundColor: isOnline ? 'var(--accent)' : 'oklch(from var(--ochre) l c h / 0.15)',
        color: isOnline ? 'var(--accent-foreground)' : 'var(--bark)',
        borderBottom: '1px solid oklch(from var(--ochre) l c h / 0.25)',
      }}
    >
      {!isOnline ? (
        <>
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--ochre)' }}
            aria-hidden
          />
          You&rsquo;re offline &middot; changes will sync when connected
        </>
      ) : (
        <>
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0 animate-pulse motion-reduce:animate-none"
            style={{ backgroundColor: 'var(--primary)' }}
            aria-hidden
          />
          Syncing {pendingCount} {pendingCount === 1 ? 'change' : 'changes'}&hellip;
        </>
      )}
    </div>
  )
}
