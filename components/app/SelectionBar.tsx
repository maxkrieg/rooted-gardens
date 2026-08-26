'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SelectionAction {
  label: string
  onClick: () => void
  disabled?: boolean
}

interface SelectionBarProps {
  count: number
  actions: SelectionAction[]
  onSelectAll?: () => void
  onClear: () => void
  /** Shown instead of the actions while a bulk apply is in flight. */
  busyLabel?: string | null
}

/**
 * The bar that appears once you've selected something. Generalized from
 * UnroutedPanel, which is the only bulk-select precedent in the repo and the
 * one the owners already use.
 *
 * Sticks to the bottom above the nav bar rather than floating over the middle
 * of the list, so the thumb reaches it without covering what's selected. No
 * long-press and no swipe to enter select mode: the repo has no gesture
 * infrastructure, and this would be the first dependency added for it.
 */
export function SelectionBar({
  count,
  actions,
  onSelectAll,
  onClear,
  busyLabel,
}: SelectionBarProps) {
  return (
    <div
      className={cn(
        'sticky z-30 mt-3',
        // Clears the bottom nav (3.5rem) plus its safe-area inset.
        'bottom-[calc(3.5rem+0.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-4',
      )}
      role="region"
      aria-label="Selection actions"
    >
      <div className="rounded-2xl border border-border bg-card p-3 shadow-warm">
        <div className="mb-2 flex items-center gap-3">
          <span className="font-display text-sm font-semibold tabular-nums text-foreground">
            {count} selected
          </span>
          {onSelectAll && (
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              Select all
            </button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-8 w-8 shrink-0"
            onClick={onClear}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {busyLabel ? (
          <p className="px-1 pb-1 text-sm text-muted-foreground">{busyLabel}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant="outline"
                className="h-10 flex-1 min-w-[calc(50%-0.25rem)]"
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
