'use client'

import { AlertTriangle, CheckCircle2, ChevronRight, Clock, MessageSquareText, Sparkles, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScheduleException } from '@/lib/utils/schedule'

const KIND_ICON: Record<ScheduleException['kind'], { Icon: typeof Clock; className: string }> = {
  skipped: { Icon: AlertTriangle, className: 'icon-skipped' },
  longOnSite: { Icon: Clock, className: 'text-[var(--clay)]' },
  crewReport: { Icon: MessageSquareText, className: 'text-primary' },
  noCrew: { Icon: UserX, className: 'text-[var(--clay)]' },
  dueUnscheduled: { Icon: Sparkles, className: 'text-primary' },
}

interface NeedsYouListProps {
  /** Already stripped of seen items. */
  items: ScheduleException[]
  onOpen: (item: ScheduleException) => void
}

/** What needs a decision this week. Collapses to a one-line all-clear when empty. */
export function NeedsYouList({ items, onOpen }: NeedsYouListProps) {
  if (items.length === 0) {
    return (
      <div
        data-tour="schedule.needsYou"
        className="flex min-h-11 items-center gap-2 px-4 text-[13px] text-muted-foreground"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 icon-completed" aria-hidden />
        <span>
          <span className="font-semibold uppercase tracking-widest text-xs">Needs you · 0</span>
          <span className="ml-2">Nothing waiting on you</span>
        </span>
      </div>
    )
  }

  return (
    <section data-tour="schedule.needsYou" aria-labelledby="needs-you-heading">
      <h2
        id="needs-you-heading"
        className="px-4 pb-1.5 text-xs font-semibold uppercase tracking-widest text-foreground"
      >
        Needs you · {items.length}
      </h2>
      {/* Full-bleed on a phone; a rounded card on the desktop board, like the rest of Today. */}
      <ul className="border-y border-border bg-card lg:overflow-hidden lg:rounded-2xl lg:border lg:shadow-warm">
        {items.map((item, index) => {
          const { Icon, className } = KIND_ICON[item.kind]
          const title = 'row' in item ? item.row.account.name : null
          return (
            <li key={item.key} className={cn(index > 0 && 'border-t border-border/60')}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className={cn(
                  'flex min-h-11 w-full items-start gap-3 px-4 py-2.5 text-left',
                  'transition-colors hover:bg-accent/50 active:bg-accent',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                )}
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  {title && (
                    <span className="truncate text-[14px] font-semibold leading-snug text-foreground">
                      {title}
                    </span>
                  )}
                  <span
                    className={cn(
                      'line-clamp-2 text-[13px] leading-snug',
                      title ? 'text-muted-foreground' : 'font-medium text-foreground',
                    )}
                  >
                    {item.description}
                  </span>
                </span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
