import { cn } from '@/lib/utils'
import { StateMark, type StateMarkVariant } from '@/components/states/StateMark'

/**
 * The one empty state for the whole app. Pick `variant` carefully (see
 * StateMark) — it's what tells an accountant an empty billing queue is good news
 * rather than a gap.
 */
export function EmptyState({
  variant = 'seed',
  title,
  hint,
  action,
  className,
  compact = false,
}: {
  variant?: StateMarkVariant
  title: string
  hint?: string
  action?: React.ReactNode
  className?: string
  /** Denser, no mark — for empty states nested inside a card or table cell. */
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-4 px-6 py-14',
        className,
      )}
    >
      {!compact && <StateMark variant={variant} />}
      <div className="max-w-xs">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
