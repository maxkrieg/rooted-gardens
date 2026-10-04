'use client'

import { useState } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { VisitStatusIcon } from '@/components/management/badges'
import { crewReportSummary, type FieldActivityItem } from '@/lib/utils/schedule'
import { displayCrewFor } from '@/lib/utils/visits'
import { firstName } from '@/lib/utils/team'

const COLLAPSED_COUNT = 5

interface FieldActivityListProps {
  /** Newest first, from fieldActivity(). */
  items: FieldActivityItem[]
  onOpen: (item: FieldActivityItem) => void
}

/** What crews sent back this week, newest first. Hidden until something has been settled. */
export function FieldActivityList({ items, onOpen }: FieldActivityListProps) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

  const shown = expanded ? items : items.slice(0, COLLAPSED_COUNT)

  return (
    <section aria-labelledby="field-activity-heading">
      <h2
        id="field-activity-heading"
        className="px-4 pb-1.5 text-xs font-semibold uppercase tracking-widest text-foreground"
      >
        From the field
      </h2>
      {/* Full-bleed on a phone; a rounded card on the desktop board, like the rest of Today. */}
      <ul className="border-y border-border bg-card lg:overflow-hidden lg:rounded-2xl lg:border lg:shadow-warm">
        {shown.map((item, index) => (
          <li key={item.visit.id} className={cn(index > 0 && 'border-t border-border/60')}>
            <FieldActivityRow item={item} onOpen={() => onOpen(item)} />
          </li>
        ))}
        {items.length > COLLAPSED_COUNT && (
          <li className="border-t border-border/60">
            <button
              type="button"
              onClick={() => setExpanded((on) => !on)}
              className="min-h-11 w-full px-4 text-left text-[13px] font-semibold text-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {expanded ? 'Show fewer' : `Show all ${items.length}`}
            </button>
          </li>
        )}
      </ul>
    </section>
  )
}

function FieldActivityRow({ item, onOpen }: { item: FieldActivityItem; onOpen: () => void }) {
  const { visit, row, at } = item
  const when = parseISO(at)
  const crew = displayCrewFor(visit).map((emp) => firstName(emp.name))
  const who = crew.length > 0 ? crew.join(', ') : 'Crew'
  const verb = visit.status === 'skipped' ? 'skipped' : 'finished'
  const detail =
    visit.status === 'skipped'
      ? visit.skip_reason
        ? `“${visit.skip_reason}”`
        : 'No reason given'
      : crewReportSummary(visit)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex min-h-11 w-full items-start gap-3 px-4 py-2.5 text-left',
        'transition-colors hover:bg-accent/50 active:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      <span className="w-14 shrink-0 pt-px text-[12px] tabular-nums text-muted-foreground">
        {isToday(when) ? format(when, 'h:mm') : format(when, 'EEE')}
        <span className="block text-[10px] uppercase">
          {isToday(when) ? format(when, 'a') : format(when, 'h:mm a')}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] leading-snug text-foreground">
          {who} {verb} <span className="font-semibold">{row.account.name}</span>
        </span>
        {detail && (
          <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{detail}</span>
        )}
      </span>
      <span className="mt-0.5 flex shrink-0">
        <VisitStatusIcon status={visit.status} />
      </span>
    </button>
  )
}
