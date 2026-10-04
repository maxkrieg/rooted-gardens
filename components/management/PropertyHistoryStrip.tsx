'use client'

import { format, isThisYear, parseISO } from 'date-fns'
import { Camera, ChevronRight, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VisitStatusIcon, visitRowTint } from '@/components/management/badges'
import { usePropertyHistory } from '@/hooks/usePropertyHistory'
import { displayCrewFor } from '@/lib/utils/visits'
import { firstName } from '@/lib/utils/team'
import type { VisitWithCrew } from '@/types/app'

interface PropertyHistoryStripProps {
  propertyId: string
  /** The visit on screen, left out of its own history. */
  visitId: string
  /** Opens a past visit. Omitted = read-only rows (crew). */
  onOpenVisit?: (visit: VisitWithCrew) => void
}

/** "When were we last there, and what happened?" Silent until the property has settled visits. */
export function PropertyHistoryStrip({ propertyId, visitId, onOpenVisit }: PropertyHistoryStripProps) {
  const { data: visits = [] } = usePropertyHistory(propertyId, visitId)
  if (visits.length === 0) return null

  return (
    <section
      aria-labelledby="property-history-heading"
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-warm"
    >
      <h3
        id="property-history-heading"
        className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground"
      >
        <History className="h-4 w-4 text-muted-foreground" />
        Earlier visits here
      </h3>
      <ul className="border-t border-border">
        {visits.map((visit, index) => (
          <li key={visit.id} className={cn(index > 0 && 'border-t border-border/60')}>
            <HistoryRow visit={visit} onOpen={onOpenVisit && (() => onOpenVisit(visit))} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function HistoryRow({ visit, onOpen }: { visit: VisitWithCrew; onOpen?: () => void }) {
  // A skip may never have been started, so it falls back to its week.
  const when = parseISO(visit.ended_at ?? visit.week_start)
  const crew = displayCrewFor(visit).map((emp) => firstName(emp.name))
  const note = visit.status === 'skipped' ? visit.skip_reason : visit.completion_note
  const photos = visit.photo_count ?? 0

  const body = (
    <>
      <span className="w-12 shrink-0 pt-px text-[13px] font-medium tabular-nums text-foreground">
        {format(when, 'MMM d')}
        {!isThisYear(when) && (
          <span className="block text-[10px] text-muted-foreground">{format(when, 'yyyy')}</span>
        )}
      </span>
      <span className="mt-px flex shrink-0">
        <VisitStatusIcon status={visit.status} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-[13px] leading-snug text-foreground">
          <span className="truncate">
            {crew.length > 0 ? crew.join(', ') : visit.status === 'skipped' ? 'Skipped' : 'No crew logged'}
          </span>
          {photos > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[12px] text-muted-foreground tabular-nums">
              <Camera className="h-3 w-3" aria-hidden />
              {photos}
              <span className="sr-only"> photo{photos === 1 ? '' : 's'}</span>
            </span>
          )}
        </span>
        {note && (
          <span className="line-clamp-1 text-[12px] leading-snug text-muted-foreground">
            “{note}”
          </span>
        )}
      </span>
      {onOpen && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  )

  const className = cn(
    'flex min-h-11 w-full items-start gap-2.5 px-4 py-2.5 text-left',
    visitRowTint(visit.status),
  )

  if (!onOpen) return <div className={className}>{body}</div>

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        className,
        'transition-colors hover:bg-accent/50 active:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      {body}
    </button>
  )
}
