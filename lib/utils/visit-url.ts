/**
 * Mirror the open visit into `?visit=` via history.replaceState: shareable without a router
 * navigation, and no extra history entry.
 */
export function syncVisitUrlParam(visitId: string | null, windowStart?: string) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const nextVisit = visitId ?? null
  const currentVisit = url.searchParams.get('visit')

  // `windowStart` is the first rendered week, not the visit's own, so a shared URL reproduces
  // the same window.
  const nextWeek = windowStart ?? url.searchParams.get('week')
  const currentWeek = url.searchParams.get('week')

  if (currentVisit === nextVisit && currentWeek === nextWeek) return

  if (nextVisit) url.searchParams.set('visit', nextVisit)
  else url.searchParams.delete('visit')

  if (nextWeek) url.searchParams.set('week', nextWeek)

  window.history.replaceState(null, '', url)
}
