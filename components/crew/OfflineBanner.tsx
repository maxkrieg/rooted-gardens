'use client'

import { useOfflineStatus } from '@/hooks/crew/useOfflineStatus'

export function OfflineBanner() {
  const { isOnline, pendingCount } = useOfflineStatus()

  if (isOnline && pendingCount === 0) return null

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
            className="inline-block h-2 w-2 rounded-full flex-shrink-0 animate-pulse"
            style={{ backgroundColor: 'var(--primary)' }}
            aria-hidden
          />
          Syncing {pendingCount} {pendingCount === 1 ? 'change' : 'changes'}&hellip;
        </>
      )}
    </div>
  )
}
