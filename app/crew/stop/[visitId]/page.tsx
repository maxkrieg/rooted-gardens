'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, Flag, SkipForward, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VisitDetailContent } from '@/components/VisitDetailContent'
import { useStopDetail } from '@/hooks/crew/useStopDetail'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { VisitLogger } from '@/components/crew/VisitLogger'
import { SkipSheet } from '@/components/crew/SkipSheet'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
import { enqueueMutation, flushMutationQueue } from '@/lib/crew/mutation-queue'
import type { EmployeeRole } from '@/types/app'

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-muted animate-pulse ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-background border-b border-[--border] px-4 py-3 flex items-center gap-3">
        <SkeletonBlock className="h-9 w-9 rounded-full" />
        <SkeletonBlock className="h-5 w-24" />
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
  const { data: stop, isLoading } = useStopDetail(visitId)
  const { data: employee } = useCurrentEmployee()
  const [completionOpen, setCompletionOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)

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

  if (!stop) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Stop not found.
      </div>
    )
  }

  const { visit, account } = stop
  const isActive = visit.status !== 'completed' && visit.status !== 'skipped'
  const canManage = employee?.role === 'owner' || employee?.role === 'lead'

  async function handleStart() {
    if (!employee?.id || inProgress) return
    const startedAt = new Date().toISOString()
    setOptimisticStartedAt(startedAt)
    await enqueueMutation('job_start', { visitId, startedAt })
    await flushMutationQueue()
    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
    queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })
  }

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-[--border] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 -ml-2 shrink-0"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Stop Detail</span>
        </div>
        {canManage ? (
          <Link
            href={`/management/accounts/${account.id}`}
            className="text-sm font-semibold text-[--primary] truncate max-w-[160px] text-right hover:underline"
          >
            {account.name}
          </Link>
        ) : (
          <span className="text-sm font-semibold text-foreground truncate max-w-[160px] text-right">
            {account.name}
          </span>
        )}
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
        onSuccess={() => router.push('/crew/schedule')}
      />

      <SkipSheet
        visitId={visitId}
        employeeId={employee?.id ?? ''}
        inProgress={inProgress}
        initialSkipReason={visit.skip_reason ?? undefined}
        open={skipOpen}
        onOpenChange={setSkipOpen}
        onSuccess={() => router.push('/crew/schedule')}
      />
    </>
  )
}
