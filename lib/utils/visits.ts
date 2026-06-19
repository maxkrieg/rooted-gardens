import { differenceInMinutes, parseISO } from 'date-fns'
import type { VisitSession, VisitSessionWithEmployee } from '@/types/app'

export function isVisitInProgress(sessions: VisitSession[]): boolean {
  return sessions.some((s) => s.ended_at === null)
}

export function activeSessionsFor(
  visitId: string,
  sessions: VisitSessionWithEmployee[]
): VisitSessionWithEmployee[] {
  return sessions.filter((s) => s.visit_id === visitId && s.ended_at === null)
}

export function allSessionsFor(
  visitId: string,
  sessions: VisitSessionWithEmployee[]
): VisitSessionWithEmployee[] {
  return sessions
    .filter((s) => s.visit_id === visitId)
    .sort((a, b) => (a.started_at > b.started_at ? -1 : 1))
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
