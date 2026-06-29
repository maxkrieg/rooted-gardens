'use client'

import { useRouter } from 'next/navigation'
import { MapPin, Camera } from 'lucide-react'
import { FrequencyBadge, VisitStatusBadge } from '@/components/management/badges'
import { formatElapsed } from '@/lib/utils/visits'
import type { TodayStop } from '@/hooks/crew/useTodayStops'

interface StopCardProps {
  stop: TodayStop
}

export function StopCard({ stop }: StopCardProps) {
  const router = useRouter()
  const { visit, zone, property, account, sessions } = stop
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`
  const inProgress = sessions.some((s) => s.ended_at === null)
  const activeSession = sessions.find((s) => s.ended_at === null)
  const showZoneName = account.billing_type === 'contract' || zone.name !== 'Full Property'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/crew/stop/${stop.visitId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') router.push(`/crew/stop/${stop.visitId}`)
      }}
      className={[
        'block rounded-2xl border border-[--border] bg-card overflow-hidden shadow-[0_1px_2px_rgba(43,42,36,.04),_0_6px_16px_-4px_rgba(43,42,36,.08)] cursor-pointer active:scale-[0.99] transition-transform select-none',
        visit.status === 'skipped' ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Crew instruction banner */}
      {visit.crew_instruction && (
        <div className="flex items-start gap-3 px-4 py-2.5 bg-[#FBF0D6] border-b border-[--border]">
          <span className="w-1 self-stretch rounded-full bg-[--ochre] shrink-0" />
          <p className="text-sm text-[--bark] leading-snug">{visit.crew_instruction}</p>
        </div>
      )}

      <div className="p-4 flex flex-col gap-2.5">
        {/* In-progress indicator */}
        {inProgress && activeSession && (
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
              On site · {formatElapsed(activeSession.started_at)}
            </span>
          </div>
        )}

        {/* Address — large Fraunces, tappable to Maps */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={[
              'font-display text-lg font-semibold leading-tight text-foreground hover:text-[--primary] transition-colors',
              visit.status === 'skipped' ? 'line-through' : '',
            ].join(' ')}
          >
            {property.address}
          </a>
        </div>

        {/* Account name */}
        <p className={['pl-6 text-sm text-muted-foreground', visit.status === 'skipped' ? 'line-through' : ''].join(' ')}>{account.name}</p>

        {/* Zone name + frequency badge */}
        <div className="pl-6 flex items-center gap-2 flex-wrap">
          {showZoneName && (
            <span className="text-sm font-medium text-foreground">{zone.name}</span>
          )}
          <FrequencyBadge frequency={zone.frequency} />
        </div>

        {/* Status chip + photo indicator — hide the row entirely for a plain scheduled stop.
            Only show a status badge for non-default states (completed / skipped / invoiced). */}
        {(visit.status !== 'scheduled' || stop.photoCount > 0) && (
          <div className="pl-6 flex items-center gap-2">
            {visit.status !== 'scheduled' && <VisitStatusBadge status={visit.status} />}
            {stop.photoCount > 0 && (
              <Camera className="h-3.5 w-3.5 text-muted-foreground" aria-label="Has photos" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
