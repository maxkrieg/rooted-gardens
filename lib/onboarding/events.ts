/**
 * Tiny in-page event bus for onboarding. UI moments advance "do it" tour steps; real mutation
 * successes tick checklist tasks. Fire-and-forget: a listener can never affect the caller.
 */
export type TourEvent =
  // Safe UI moments — advance tour steps.
  | 'schedule.viewWeek'
  | 'schedule.visitOpened'
  | 'schedule.visitClosed'
  | 'schedule.menuOpened'
  | 'schedule.generateOpened'
  | 'schedule.generateClosed'
  | 'schedule.routeMenuOpened'
  | 'routes.groupMenuOpened'
  | 'accounts.accountOpened'
  // Real work done — complete checklist tasks.
  | 'schedule.weekGenerated'
  | 'schedule.crewAssigned'
  | 'routes.defaultsSaved'
  | 'routes.propertyRouted'
  | 'accounts.created'
  | 'accounts.propertyAdded'

type Listener = (event: TourEvent) => void

const listeners = new Set<Listener>()

export function emitTourEvent(event: TourEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (err) {
      console.error('[onboarding] listener failed for', event, err)
    }
  }
}

export function subscribeTourEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
