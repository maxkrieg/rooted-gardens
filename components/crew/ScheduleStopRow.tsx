'use client'

import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import { FrequencyBadge, VisitStatusBadge } from '@/components/management/badges'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
import type { SchedulePropertyRow } from '@/types/app'

interface ScheduleStopRowProps {
  row: SchedulePropertyRow
}

function firstName(name: string): string {
  return name.split(' ')[0]
}

export function ScheduleStopRow({ row }: ScheduleStopRowProps) {
  const router = useRouter()
  const { property, account, visit } = row

  const assignedCrew = (visit?.visit_crew ?? [])
    .filter((vc) => vc.relation === 'assigned' && vc.employee)
    .map((vc) => vc.employee)

  const inProgress = visit ? isVisitInProgress(visit) : false

  // No visit yet → not tappable (nothing to view/edit), shown muted
  if (!visit) {
    return (
      <div className="px-4 py-3 flex flex-col gap-1 opacity-60">
        <p className="font-display text-base font-semibold leading-tight text-foreground">
          {property.address}
        </p>
        <p className="text-xs text-muted-foreground">{account.name}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <FrequencyBadge frequency={property.frequency} />
          <span className="text-[11px] text-muted-foreground">Not scheduled</span>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/crew/stop/${visit.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') router.push(`/crew/stop/${visit.id}`)
      }}
      className={[
        'px-4 py-3 flex flex-col gap-1.5 min-h-[44px] cursor-pointer active:bg-accent/40 transition-colors select-none',
        visit.status === 'skipped' ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* In-progress indicator — same treatment as the Today list (StopCard) */}
      {inProgress && visit.started_at && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--clay)' }}>
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: 'var(--clay)' }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: 'var(--clay)' }}
            />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">
            On site · {formatElapsed(visit.started_at)}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <p
          className={[
            'font-display text-base font-semibold leading-tight text-foreground',
            visit.status === 'skipped' ? 'line-through' : '',
          ].join(' ')}
        >
          {property.address}
        </p>
        {/* Only surface a status badge for non-default states; crew see invoiced as completed */}
        {visit.status !== 'scheduled' && (
          <VisitStatusBadge status={visit.status === 'invoiced' ? 'completed' : visit.status} />
        )}
      </div>

      <p className="text-xs text-muted-foreground">{account.name}</p>

      <div className="flex items-center gap-2 flex-wrap">
        <FrequencyBadge frequency={property.frequency} />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {assignedCrew.length > 0 ? (
          <span className="truncate">{assignedCrew.map((e) => firstName(e.name)).join(', ')}</span>
        ) : (
          <span className="italic">Unassigned</span>
        )}
      </div>
    </div>
  )
}
