'use client'

import { useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { addDays, format, parseISO } from 'date-fns'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VisitDetailContent } from '@/components/VisitDetailContent'
import { useCan, useRole } from '@/components/app/RoleProvider'
import { useKeyboardOpen } from '@/hooks/use-keyboard-open'
import { useStopDetail } from '@/hooks/crew/useStopDetail'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { VisitLogger } from '@/components/crew/VisitLogger'
import { SkipSheet } from '@/components/crew/SkipSheet'
import { isVisitInProgress, mustJoinVisit } from '@/lib/utils/visits'
import { StopActions } from '@/components/crew/StopActions'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'

function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={className} />
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col">
      {/* Mirrors the loaded header's single row so it doesn't jump. */}
      <div className="sticky top-0 z-10 bg-background border-b border-[--border] px-4 py-2 flex items-center gap-2">
        <SkeletonBlock className="h-11 w-11 rounded-full" />
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="ml-auto h-6 w-36 rounded-full" />
      </div>
      <div className="p-4 space-y-4">
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
        <SkeletonBlock className="h-8 w-3/4" />
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-28 w-full rounded-2xl" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export default function StopDetailPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const router = useRouter()
  const { data: stop, isLoading, isError, refetch } = useStopDetail(visitId)
  const { data: employee } = useCurrentEmployee()
  const { editSchedule: canManage, seeDashboard } = useCan()
  const { role } = useRole()
  const [completionOpen, setCompletionOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const keyboardOpen = useKeyboardOpen()

  // A stop is often a cold entry point (PWA launch, shared link) with no history to go back to.
  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back()
    else router.replace('/app/schedule')
  }, [router])

  // StopActions patches stop-detail optimistically on Start/Discard, so this is current.
  const visitStartedAt = stop?.visit.started_at ?? null
  const inProgress = isVisitInProgress({ started_at: visitStartedAt, ended_at: stop?.visit.ended_at ?? null })

  if (isLoading && !stop) return <LoadingSkeleton />

  // A load failure isn't "not found": the stop may still be on their list.
  if (isError && !stop) {
    return (
      <ErrorState
        title="This stop didn't load."
        hint="You may be out of signal. Try again once you're back online."
        onRetry={() => refetch()}
      />
    )
  }

  if (!stop) {
    return (
      <EmptyState
        variant="pruned"
        title="This stop isn't here"
        hint="It may have been removed from the schedule."
        action={
          <Button variant="outline" onClick={() => router.replace('/app/schedule')}>
            Back to schedule
          </Button>
        }
      />
    )
  }

  const { visit, account } = stop
  const joinFirst = mustJoinVisit(role, employee?.id, [...(stop.assignedCrew ?? []), ...(stop.completedBy ?? [])])
  // The visit's week, weekday-anchored ("Mon … Sun") so the boundaries are unambiguous.
  const weekStartDate = parseISO(visit.week_start)
  const weekRange = `${format(weekStartDate, 'EEE MMM d')} – ${format(addDays(weekStartDate, 6), 'EEE MMM d')}`

  return (
    <>
      {/* Sticky header: account and week. The address is the hero just below. */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-[--border] px-4 py-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 -ml-2 shrink-0"
          onClick={goBack}
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* The account owns the property — an eyebrow, same as the management sheet. */}
        {canManage ? (
          <Link
            href={`/app/accounts/${account.id}`}
            className="inline-flex min-h-11 min-w-0 items-center truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-[--primary] transition-colors"
          >
            {account.name}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {account.name}
          </span>
        )}

        <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-[--accent-foreground] tabular-nums">
          <CalendarDays className="h-3 w-3 shrink-0" />
          {weekRange}
        </span>
      </div>

      {/* Scrollable body — bottom padding clears the sticky action bar + bottom nav */}
      <div className="p-4 pb-52">
        <VisitDetailContent
          data={stop}
          onOpenCompletion={() => setCompletionOpen(true)}
          onOpenSkip={() => setSkipOpen(true)}
          // Crew read the history but don't page into past stops from it.
          onOpenHistoryVisit={
            seeDashboard ? (past) => router.push(`/app/stop/${past.id}`) : undefined
          }
        />
      </div>

      {/* Fixed action bar above the bottom nav; offset drops to 0 when the nav hides for the
         keyboard. */}
      <div
        className="fixed inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-[--border] px-4 pt-2 pb-2"
        style={{ bottom: keyboardOpen ? '0px' : 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <StopActions
          visitId={visitId}
          visit={visit}
          label={stop.property.address}
          joinFirst={joinFirst}
          onFinish={() => setCompletionOpen(true)}
          onSkip={() => setSkipOpen(true)}
        />
      </div>

      <VisitLogger
        visitId={visitId}
        employeeId={employee?.id ?? ''}
        propertyId={stop.property.id}
        label={stop.property.address}
        assignedCrew={stop.assignedCrew ?? []}
        startedAt={visitStartedAt}
        weekStart={visit.week_start}
        initialServiceTypes={visit.service_types ?? undefined}
        initialCompletionNote={visit.completion_note ?? undefined}
        initialPhotos={stop.photos.filter((p) => p.type === 'visit')}
        initialPresentIds={
          (stop.completedBy?.length ?? 0) > 0
            ? stop.completedBy.map((c) => c.employee_id)
            : undefined
        }
        joinFirst={joinFirst}
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        onSuccess={() => router.replace('/app/schedule')}
      />

      <SkipSheet
        visitId={visitId}
        employeeId={employee?.id ?? ''}
        label={stop.property.address}
        inProgress={inProgress}
        initialSkipReason={visit.skip_reason ?? undefined}
        joinFirst={joinFirst}
        open={skipOpen}
        onOpenChange={setSkipOpen}
        onSuccess={() => router.replace('/app/schedule')}
      />
    </>
  )
}
