import { differenceInMinutes, parseISO } from 'date-fns'

/** The on-site timing fields now live directly on the visit row. */
export type VisitTiming = {
  started_at: string | null
  ended_at: string | null
}

/**
 * A visit is "in progress" when work has started but not yet ended. This is a
 * derived state — never a value of visits.status.
 */
export function isVisitInProgress(v: VisitTiming): boolean {
  return !!v.started_at && !v.ended_at
}

export function formatElapsed(startedAt: string): string {
  const mins = differenceInMinutes(new Date(), parseISO(startedAt))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function formatDuration(startedAt: string, endedAt: string): string {
  const mins = differenceInMinutes(parseISO(endedAt), parseISO(startedAt))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
