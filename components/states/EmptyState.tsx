import { cn } from '@/lib/utils'
import { StateMark, type StateMarkVariant } from '@/components/states/StateMark'

/**
 * The one empty state for the whole app. Replaces ~18 one-off gray paragraphs
 * and three overlapping local `EmptyState` functions (FleetView, PropertyPhotoGallery,
 * ScheduleEmptyState).
 *
 * Copy rules, applied at every call site:
 *   - `title` names what isn't there, in Fraunces. Not "Nothing here".
 *   - `hint` says what to do about it, in one plain sentence.
 *   - `action` is a real control whenever the user can act. An empty screen is an
 *     invitation, and "No accounts yet" with no way to add one is a dead end.
 *   - `variant` carries the *kind* of emptiness (see StateMark). Getting this right
 *     matters more than the wording: 'sprig' tells an accountant an empty billing
 *     queue is good news, where 'seed' would imply something is missing.
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
  /** Denser padding + no mark, for empty states nested inside a card or table cell. */
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
