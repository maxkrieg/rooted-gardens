'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { addDays, format, parseISO } from 'date-fns'
import { ArrowLeft, CalendarDays, Play, Flag, SkipForward, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VisitDetailContent } from '@/components/VisitDetailContent'
import { useStopDetail } from '@/hooks/crew/useStopDetail'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { VisitLogger } from '@/components/crew/VisitLogger'
import { SkipSheet } from '@/components/crew/SkipSheet'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import type { EmployeeRole } from '@/types/app'

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
  const queryClient = useQueryClient()
  const { data: stop, isLoading, isError, refetch } = useStopDetail(visitId)
  const { data: employee } = useCurrentEmployee()
  const [completionOpen, setCompletionOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)

  // A stop is routinely a cold entry point — the PWA launching straight into it,
  // a shared link, or a jump from the management visit sheet — and in those
  // cases there's no history to go back to, so the button would dead-end.
  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back()
    else router.replace('/crew/schedule')
  }, [router])

  // Optimistic start so the Start cell flips to a running timer immediately, before
  // the queued visit update syncs. Real data (visit.started_at) takes over once present.
  const [optimisticStartedAt, setOptimisticStartedAt] = useState<string | null>(null)

  // Re-render every 30s so the running duration on the Start cell stays current.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // On-site timing now lives on the visit row. Prefer real data; fall back to the
  // optimistic start until the queued update syncs back.
  const visitStartedAt = stop?.visit.started_at ?? optimisticStartedAt ?? null
  const visitEndedAt = stop?.visit.ended_at ?? null
  const inProgress = isVisitInProgress({ started_at: visitStartedAt, ended_at: visitEndedAt })

  if (isLoading && !stop) return <LoadingSkeleton />

  // A load failure and a genuinely missing stop both used to render "Stop not
  // found." — which sends a crew member driving to the wrong conclusion about a
  // job that is actually still on their list. Separate them.
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
          <Button variant="outline" onClick={() => router.replace('/crew/schedule')}>
            Back to schedule
          </Button>
        }
      />
    )
  }

  const { visit, account } = stop
  const isActive = visit.status !== 'completed' && visit.status !== 'skipped'
  const canManage = employee?.role === 'owner' || employee?.role === 'lead'

  // Which week this visit belongs to — a visit is a (property × week) record, and
  // crew arrive here from /crew/schedule, which may be parked on any week.
  // Weekday-anchored (matching the management VisitDetailSheet) because this is a
  // statement of which week you're in, not a nav control: "Mon … Sun" leaves no
  // doubt about the boundaries when the visit isn't the current week.
  const weekStartDate = parseISO(visit.week_start)
  const weekRange = `${format(weekStartDate, 'EEE MMM d')} – ${format(addDays(weekStartDate, 6), 'EEE MMM d')}`

  async function handleStart() {
    if (!employee?.id || inProgress) return
    const startedAt = new Date().toISOString()
    setOptimisticStartedAt(startedAt)
    await enqueueMutation('job_start', { visitId, startedAt }, stop?.property.address)
    await flushMutationQueue()
    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
    queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })
  }

  return (
    <>
      {/* Sticky header — the two facts the body doesn't already shout: whose
          property this is, and which week. The address is the hero just below,
          so repeating it here would only cost scarce vertical space. */}
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
            href={`/management/accounts/${account.id}`}
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
          role={employee?.role as EmployeeRole | undefined}
          onOpenCompletion={() => setCompletionOpen(true)}
          onOpenSkip={() => setSkipOpen(true)}
        />
      </div>

      {/* Fixed action bar — three inline icon+label actions above the bottom nav */}
      <div
        className="fixed inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-[--border] px-4 pt-2 pb-2"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-stretch gap-2">
          {/* Start — flips to a non-clickable running timer once started */}
          {inProgress && visitStartedAt ? (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg border min-h-[60px] py-2"
              style={{ borderColor: 'var(--clay)', color: 'var(--clay)' }}
              aria-label="Visit in progress"
            >
              <span className="font-display text-lg font-semibold leading-none tabular-nums">
                {formatElapsed(visitStartedAt)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">On site</span>
            </div>
          ) : (
            <button
              type="button"
              className="flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border border-[--border] bg-card min-h-[60px] py-2 active:bg-accent/40 disabled:opacity-40 transition-colors"
              onClick={handleStart}
              disabled={!isActive}
            >
              <Play className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <span className="text-xs font-medium text-foreground">Start</span>
            </button>
          )}

          {/* Finish — opens the completion form, which also closes the session */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border border-[--border] bg-card min-h-[60px] py-2 active:bg-accent/40 disabled:opacity-40 transition-colors"
            onClick={() => setCompletionOpen(true)}
            disabled={visit.status === 'completed'}
          >
            {visit.status === 'completed' ? (
              <>
                <Check className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <span className="text-xs font-medium text-foreground">Done</span>
              </>
            ) : (
              <>
                <Flag className="h-5 w-5 text-foreground" />
                <span className="text-xs font-medium text-foreground">Finish</span>
              </>
            )}
          </button>

          {/* Skip */}
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border border-[--border] bg-card min-h-[60px] py-2 active:bg-accent/40 disabled:opacity-40 transition-colors"
            onClick={() => setSkipOpen(true)}
            disabled={visit.status === 'skipped'}
          >
            <SkipForward className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              {visit.status === 'skipped' ? 'Skipped' : 'Skip'}
            </span>
          </button>
        </div>
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
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        onSuccess={() => router.replace('/crew/schedule')}
      />

      <SkipSheet
        visitId={visitId}
        employeeId={employee?.id ?? ''}
        label={stop.property.address}
        inProgress={inProgress}
        initialSkipReason={visit.skip_reason ?? undefined}
        open={skipOpen}
        onOpenChange={setSkipOpen}
        onSuccess={() => router.replace('/crew/schedule')}
      />
    </>
  )
}
