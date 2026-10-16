'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Play, Flag, SkipForward, Check, RotateCcw } from 'lucide-react'
import type { StopDetail } from '@/hooks/crew/useStopDetail'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { isVisitInProgress, formatElapsed } from '@/lib/utils/visits'
import { enqueueJoinVisit, enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'

interface StopActionsProps {
  visitId: string
  visit: Pick<StopDetail['visit'], 'started_at' | 'ended_at' | 'status'>
  label?: string
  /** Crew who aren't on this stop yet: add them first, or the database refuses the save. */
  joinFirst?: boolean
  onFinish: () => void
  onSkip: () => void
}

/** Start / Finish / Skip for one stop. Used on the stop page, the stop sheet and the board's pane. */
export function StopActions({ visitId, visit, label, joinFirst = false, onFinish, onSkip }: StopActionsProps) {
  const queryClient = useQueryClient()
  const { data: employee } = useCurrentEmployee()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // Shown until the queued start syncs back as visit.started_at.
  const [optimisticStartedAt, setOptimisticStartedAt] = useState<string | null>(null)

  // Re-render every 30s so the on-site duration stays current.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const startedAt = visit.started_at ?? optimisticStartedAt
  const inProgress = isVisitInProgress({ started_at: startedAt, ended_at: visit.ended_at })
  const isActive = visit.status !== 'completed' && visit.status !== 'skipped'

  function patchStartedAt(value: string | null) {
    queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
      old ? { ...old, visit: { ...old.visit, started_at: value, ended_at: value ? null : old.visit.ended_at } } : old
    )
  }

  function settle(failed: number, message: string) {
    if (failed > 0) toast.error(message)
    queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
    queryClient.invalidateQueries({ queryKey: ['schedule-visits'] })
  }

  async function handleStart() {
    if (!employee?.id || inProgress) return
    const now = new Date().toISOString()
    setOptimisticStartedAt(now)
    patchStartedAt(now)
    if (joinFirst) await enqueueJoinVisit(visitId, employee.id, label)
    await enqueueMutation('job_start', { visitId, startedAt: now }, label)
    const result = await flushMutationQueue()
    // A refused start must not keep ticking on screen.
    if (result.failed > 0) setOptimisticStartedAt(null)
    settle(result.failed, 'Could not start the timer. Try again.')
  }

  async function handleDiscard() {
    if (!employee?.id || !inProgress) return
    setConfirmDiscard(false)
    // Clear the optimistic start too, or the timer resurrects when started_at comes back null.
    setOptimisticStartedAt(null)
    patchStartedAt(null)
    await enqueueMutation('job_discard', { visitId }, label)
    const result = await flushMutationQueue()
    settle(result.failed, 'Could not discard the start time. Try again.')
  }

  const cell =
    'flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border min-h-[60px] py-2 transition-colors disabled:opacity-40'

  return (
    <div className="w-full">
      {inProgress && startedAt && (
        <div className="flex items-center gap-1.5 pb-2" style={{ color: 'var(--clay)' }}>
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: 'var(--clay)' }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--clay)' }} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">On site · {formatElapsed(startedAt)}</span>
        </div>
      )}

      <div className="flex items-stretch gap-2">
        {/* Start flips to Discard once started, with an inline confirm step. */}
        {inProgress ? (
          confirmDiscard ? (
            <div className="flex-1 flex flex-col gap-1 min-h-[60px]">
              <button
                type="button"
                className="flex-1 rounded-lg border text-xs font-semibold uppercase tracking-wide transition-colors active:bg-accent/10"
                style={{ borderColor: 'var(--clay)', color: 'var(--clay)' }}
                onClick={handleDiscard}
              >
                Confirm
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-[--border] bg-card text-xs font-medium text-muted-foreground active:bg-accent/40 transition-colors"
                onClick={() => setConfirmDiscard(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${cell} active:bg-accent/10`}
              style={{ borderColor: 'var(--clay)', color: 'var(--clay)' }}
              onClick={() => setConfirmDiscard(true)}
            >
              <RotateCcw className="h-5 w-5" />
              <span className="text-xs font-medium">Discard</span>
            </button>
          )
        ) : (
          <button
            type="button"
            className={`${cell} border-[--border] bg-card active:bg-accent/40`}
            onClick={handleStart}
            disabled={!isActive}
          >
            <Play className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-medium text-foreground">Start</span>
          </button>
        )}

        {/* Finish opens the completion form, which also closes the on-site clock. */}
        <button
          type="button"
          className={`${cell} border-[--border] bg-card active:bg-accent/40`}
          onClick={onFinish}
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

        <button
          type="button"
          className={`${cell} border-[--border] bg-card active:bg-accent/40`}
          onClick={onSkip}
          disabled={visit.status === 'skipped'}
        >
          <SkipForward className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {visit.status === 'skipped' ? 'Skipped' : 'Skip'}
          </span>
        </button>
      </div>
    </div>
  )
}
