'use client'

import { ArrowDownWideNarrow, Route } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScheduleSortMode } from '@/lib/utils/schedule-sort'

const MODE_META: Record<ScheduleSortMode, { label: string; Icon: typeof Route }> = {
  route: { label: 'Drive order', Icon: Route },
  priority: { label: 'Priority', Icon: ArrowDownWideNarrow },
}

/**
 * The sort switch, shared by the schedule header and every route band so both read the same.
 * Both states are labelled, since each band has its own value.
 */
export function ScheduleSortToggle({
  mode,
  onChange,
  scope,
  size = 'default',
  className,
}: {
  mode: ScheduleSortMode
  onChange: (next: ScheduleSortMode) => void
  /** Named in the accessible label so the two levels are distinguishable. */
  scope: string
  size?: 'default' | 'compact'
  className?: string
}) {
  const next: ScheduleSortMode = mode === 'priority' ? 'route' : 'priority'
  const { label, Icon } = MODE_META[mode]
  const isPriority = mode === 'priority'
  const compact = size === 'compact'

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`${scope} sorted by ${label.toLowerCase()}. Switch to ${MODE_META[next].label.toLowerCase()}.`}
      title={
        isPriority
          ? `${scope}: longest-waiting stops first. Tap for the order the route is driven.`
          : `${scope}: the order the route is driven. Tap for longest-waiting first.`
      }
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // Deliberately under the 44px floor: a full-size chip would add ~20px per route band.
        compact ? 'h-8 px-2.5 text-[11px]' : 'h-9 px-3 text-xs',
        // Primary, not clay: clay is the on-site pulse, and the band it sits on
        // can be showing one. Green here reads as "this control is engaged".
        isPriority
          ? 'bg-primary/12 text-primary hover:bg-primary/20'
          : 'text-muted-foreground hover:bg-secondary-foreground/10 hover:text-foreground',
        !compact && !isPriority && 'border border-border',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}
