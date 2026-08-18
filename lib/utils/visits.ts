import { differenceInMinutes, parseISO } from 'date-fns'
import type { Visit } from '@/types/app'

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

/**
 * A live patch for one visit, delivered by Realtime (the full `payload.new` row)
 * or pushed in by the management drawer after it writes. Always carries the
 * row's `updated_at` so a merge can tell which copy is newer.
 */
export type VisitOverlay = Partial<Visit> & { id: string; updated_at: string }

/**
 * Millisecond version of a visit row, or null when it can't be trusted.
 *
 * `updated_at` is declared non-null, but a row can still reach the client
 * without one — most importantly from a React Query entry persisted to
 * IndexedDB before the column was added to the select. Returning null (rather
 * than letting NaN propagate) is what keeps comparisons decidable: every NaN
 * comparison is false, so a NaN version silently defeats both "is newer" and
 * "is not newer" and lets an overlay write on every render.
 */
export function visitVersion(v: { updated_at?: string | null }): number | null {
  if (!v.updated_at) return null
  const ms = Date.parse(v.updated_at)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Layer a live overlay over a server-rendered visit.
 *
 * Guarded by `updated_at` rather than applied unconditionally: a dropped
 * Realtime message would otherwise pin a stale status on a cell forever, beating
 * fresher server data on every subsequent render. `updated_at` is
 * trigger-maintained, so it is a reliable version marker — compared with
 * `Date.parse` because PostgREST and Realtime don't format timestamps
 * identically ('…Z' vs '…+00:00'), which breaks string ordering.
 *
 * The overlay is a bare `visits` row, so spreading it can only replace scalar
 * columns — joined fields the caller holds (`visit_crew`, `invoice`,
 * `photo_count`) are absent from it and survive untouched.
 */
export function mergeVisitOverlay<T extends { id: string; updated_at: string }>(
  base: T,
  overlays: Map<string, VisitOverlay>,
): T {
  const overlay = overlays.get(base.id)
  if (!overlay) return base
  const overlayVersion = visitVersion(overlay)
  const baseVersion = visitVersion(base)
  // Undecidable either way — keep the server row rather than guess.
  if (overlayVersion === null || baseVersion === null) return base
  if (overlayVersion <= baseVersion) return base
  return { ...base, ...overlay }
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
