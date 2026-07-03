'use client'

import { format, parseISO, differenceInMinutes } from 'date-fns'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SERVICE_TYPE_LABELS } from '@/types/app'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

interface CompletionSummaryProps {
  visit: StopDetail['visit']
  completedBy: StopDetail['completedBy']
  assignedCrew: StopDetail['assignedCrew']
  canEdit?: boolean
  onEdit: () => void
  onEditSkip: () => void
}

function formatTime(iso: string) {
  return format(parseISO(iso), 'h:mm a')
}

function formatDate(iso: string) {
  return format(parseISO(iso), 'MMM d')
}

function formatDuration(startIso: string, endIso: string) {
  const mins = differenceInMinutes(parseISO(endIso), parseISO(startIso))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function CompletionSummary({
  visit,
  completedBy,
  assignedCrew,
  canEdit = true,
  onEdit,
  onEditSkip,
}: CompletionSummaryProps) {
  const isSkipped = visit.status === 'skipped'
  const isCompleted = visit.status === 'completed'

  // Show who was on site only if it differs from who was assigned
  const assignedIds = new Set(assignedCrew.map((c) => c.employee_id))
  const crewDiffers =
    completedBy.length > 0 &&
    (completedBy.length !== assignedCrew.length ||
      completedBy.some((c) => !assignedIds.has(c.employee_id)))

  const headerBg = isSkipped ? 'bg-[#FBF0D6]' : 'bg-[#E3F1E7]'
  const accentColor = isSkipped ? 'var(--ochre, #D9A441)' : 'var(--primary, #4A7C59)'
  const headerLabel = isSkipped ? 'Skipped' : 'Completion Log'
  const handleEdit = isSkipped ? onEditSkip : onEdit

  return (
    <div className="rounded-2xl border border-[--border] bg-card overflow-hidden shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)]">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${headerBg}`}>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold" style={{ color: accentColor }}>
            {headerLabel}
          </span>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-4">
        {isCompleted && (
          <>
            {/* Time row */}
            {(visit.started_at || visit.ended_at) && (
              <div className="flex items-start gap-6">
                <div className="space-y-0.5">
                  <p className="font-display text-base font-semibold text-foreground tabular-nums">
                    {formatDate(visit.ended_at ?? visit.week_start)}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Completed
                  </p>
                </div>
                {visit.started_at && (
                  <div className="space-y-0.5">
                    <p className="font-display text-base font-semibold text-foreground tabular-nums">
                      {formatTime(visit.started_at)}
                    </p>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Started
                    </p>
                  </div>
                )}
                {visit.ended_at && (
                  <div className="space-y-0.5">
                    <p className="font-display text-base font-semibold text-foreground tabular-nums">
                      {formatTime(visit.ended_at)}
                    </p>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Finished
                    </p>
                  </div>
                )}
                {visit.started_at && visit.ended_at && (
                  <div className="space-y-0.5">
                    <p className="font-display text-base font-semibold text-foreground tabular-nums">
                      {formatDuration(visit.started_at, visit.ended_at)}
                    </p>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Duration
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Service type chips */}
            {visit.service_types && visit.service_types.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {visit.service_types.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: '#E3F1E7', color: '#2F6E45' }}
                  >
                    {SERVICE_TYPE_LABELS[type] ?? type}
                  </span>
                ))}
              </div>
            )}

            {/* Completion note */}
            {visit.completion_note && (
              <div className="rounded-lg bg-muted px-3 py-2.5 flex gap-2.5">
                <span className="text-muted-foreground/50 font-display text-lg leading-none select-none mt-0.5">&ldquo;</span>
                <p className="text-sm text-foreground leading-relaxed">{visit.completion_note}</p>
              </div>
            )}

            {/* Completed by — only shown when it differs from assigned crew */}
            {crewDiffers && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  On site
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {completedBy.map((c) => (
                    <span
                      key={c.employee_id}
                      className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {isSkipped && (
          <>
            {visit.skip_reason ? (
              <div className="rounded-lg bg-muted px-3 py-2.5 flex gap-2.5">
                <span className="text-muted-foreground/50 font-display text-lg leading-none select-none mt-0.5">&ldquo;</span>
                <p className="text-sm text-foreground leading-relaxed">{visit.skip_reason}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No reason given.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
