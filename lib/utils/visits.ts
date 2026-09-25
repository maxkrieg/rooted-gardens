import { differenceInMinutes, parseISO } from 'date-fns'
import type { Employee, Visit, VisitWithCrew } from '@/types/app'

/** The on-site timing fields now live directly on the visit row. */
type VisitTiming = {
  started_at: string | null
  ended_at: string | null
}

/** In progress = started but not ended. Derived; never a visits.status value. */
export function isVisitInProgress(v: VisitTiming): boolean {
  return !!v.started_at && !v.ended_at
}

/** A live patch for one visit (a Realtime row or a drawer write). `updated_at` decides which copy wins. */
export type VisitOverlay = Partial<Visit> & { id: string; updated_at: string }

/**
 * Millisecond version of a visit row, or null if missing. Null, not NaN: NaN makes every
 * comparison false, which would let a stale overlay win on every render.
 */
export function visitVersion(v: { updated_at?: string | null }): number | null {
  if (!v.updated_at) return null
  const ms = Date.parse(v.updated_at)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Version for an optimistic write: 1ms past the row it replaces, not Date.now(). A fast device
 * clock would otherwise outrank the real server write.
 */
export function nextVisitVersion(current: string | null | undefined): string {
  const ms = visitVersion({ updated_at: current })
  return new Date((ms ?? Date.now()) + 1).toISOString()
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

/** Completed crew once done, else assigned crew. Never merge or dedupe the two. */
export function displayCrewFor(visit: VisitWithCrew): Employee[] {
  const pick = (relation: 'assigned' | 'completed') =>
    visit.visit_crew.filter((vc) => vc.relation === relation && vc.employee).map((vc) => vc.employee)
  const completed = pick('completed')
  return visit.status === 'completed' && completed.length > 0 ? completed : pick('assigned')
}
