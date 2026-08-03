import { cn } from '@/lib/utils'

/**
 * Marks for the app's absence/failure states, keyed to meaning rather than page:
 * seed = nothing set up yet, pruned = filters hid it, sprig = done, broken =
 * failed. 1.25px so the weight matches the card borders they sit inside.
 */

export type StateMarkVariant = 'seed' | 'pruned' | 'sprig' | 'broken'

const TONE: Record<StateMarkVariant, string> = {
  // Sand reads as an unfilled form, not a problem; sage means finished work;
  // clay is the app's established "needs attention" hue.
  seed: 'text-[var(--border)]',
  pruned: 'text-[var(--border)]',
  sprig: 'text-primary/40',
  broken: 'text-[var(--clay)]/70',
}

function MarkPaths({ variant }: { variant: StateMarkVariant }) {
  switch (variant) {
    // A seed on the soil line, not yet planted.
    case 'seed':
      return (
        <>
          <path d="M24 21c3.6 0 6.4 2.5 6.4 5.7S27.6 32.6 24 32.6s-6.4-2.7-6.4-5.9S20.4 21 24 21Z" />
          <path d="M24 21c.2-1.9 1.4-3.2 2.9-3.9" />
          <path d="M10 39h28" strokeDasharray="1.5 3.5" />
        </>
      )

    // A stem cut back, its top lying detached beside it.
    case 'pruned':
      return (
        <>
          <path d="M24 39V23" />
          <path d="M20.8 21.6 27.6 18" />
          <path d="M24 31c-3.2-.6-5.2-2.6-5.6-5.4 3 .2 5 1.9 5.6 4.6" />
          <path d="M9.5 36.5c2.4-2.9 5.6-3.4 7.6-1.6-1.9 2.9-5.2 3.4-7.6 1.6Z" />
          <path d="M38.5 36.5c-2.4-2.9-5.6-3.4-7.6-1.6 1.9 2.9 5.2 3.4 7.6 1.6Z" />
        </>
      )

    // Three stems gathered and tied — the work is bundled up.
    case 'sprig':
      return (
        <>
          <path d="M24 39V13" />
          <path d="M24 29c-3.8-3.6-5.8-7.6-5.8-12.4" />
          <path d="M24 29c3.8-3.6 5.8-7.6 5.8-12.4" />
          <path d="M18.6 31.5h10.8" />
          <path d="M18.6 34.8h10.8" />
        </>
      )

    // A stem snapped part-way up.
    case 'broken':
      return (
        <>
          <path d="M24 39V26.5" />
          <path d="M25.2 25.2 32 16.4" />
          <path d="M24 34.5c-3.2-.7-5.2-2.7-5.6-5.5 3 .2 5 1.9 5.6 4.7" />
          <path d="m21 24.4 2.4 1.3" />
          <path d="m26.6 22.6 2.2-1.4" />
        </>
      )
  }
}

export function StateMark({
  variant,
  className,
}: {
  variant: StateMarkVariant
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted/60',
        className,
      )}
    >
      <svg
        viewBox="0 0 48 48"
        className={cn('h-12 w-12', TONE[variant])}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <MarkPaths variant={variant} />
      </svg>
    </span>
  )
}
