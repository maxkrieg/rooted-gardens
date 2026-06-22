'use client'

import { format } from 'date-fns'
import { Leaf } from 'lucide-react'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { useTodayStops } from '@/hooks/crew/useTodayStops'
import { StopCard } from '@/components/crew/StopCard'

function StopCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[--border] bg-card overflow-hidden animate-pulse">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <div className="h-4 w-4 rounded bg-muted mt-1 shrink-0" />
          <div className="h-6 w-52 rounded bg-muted" />
        </div>
        <div className="pl-6 h-4 w-32 rounded bg-muted" />
        <div className="pl-6 flex gap-2">
          <div className="h-5 w-20 rounded-full bg-muted" />
        </div>
        <div className="pl-6 h-5 w-16 rounded-full bg-muted" />
      </div>
    </div>
  )
}

export default function TodayPage() {
  const { data: employee } = useCurrentEmployee()
  const { data: stops, isLoading } = useTodayStops(employee?.id)

  const isInitialLoad = isLoading && !stops

  return (
    <div className="p-4 pb-6 space-y-4">
      <h1 className="font-display text-2xl font-semibold text-foreground">
        Today · {format(new Date(), 'EEE MMM d')}
      </h1>

      {isInitialLoad && (
        <div className="space-y-3">
          <StopCardSkeleton />
          <StopCardSkeleton />
          <StopCardSkeleton />
        </div>
      )}

      {!isInitialLoad && stops?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Leaf className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-display text-lg font-semibold text-foreground">All clear</p>
            <p className="mt-1 text-sm text-muted-foreground">No stops scheduled for today.</p>
          </div>
        </div>
      )}

      {stops && stops.length > 0 && (
        <div className="space-y-3">
          {stops.map((stop) => (
            <StopCard key={stop.visitId} stop={stop} />
          ))}
        </div>
      )}
    </div>
  )
}
