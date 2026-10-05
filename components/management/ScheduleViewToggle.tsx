'use client'

import { cn } from '@/lib/utils'

export type ScheduleViewMode = 'today' | 'week'

/** `Today | Week` — the dashboard folded into the schedule. */
export function ScheduleViewToggle({
  value,
  onChange,
  size = 'default',
}: {
  value: ScheduleViewMode
  onChange: (value: ScheduleViewMode) => void
  /** 'compact' sits in the phone header row beside the week pager. */
  size?: 'default' | 'compact'
}) {
  const compact = size === 'compact'
  return (
    <div
      role="tablist"
      aria-label="Schedule view"
      data-tour="schedule.viewToggle"
      className={cn(
        'flex rounded-lg bg-secondary p-1',
        compact ? 'shrink-0 gap-0.5 p-[3px]' : 'gap-1',
      )}
    >
      {(['today', 'week'] as const).map((mode) => (
        <button
          key={mode}
          role="tab"
          type="button"
          aria-selected={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'rounded-md font-semibold capitalize transition-colors',
            compact ? 'min-h-9 px-2.5 text-[13px]' : 'min-h-9 flex-1 text-sm',
            value === mode
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}
