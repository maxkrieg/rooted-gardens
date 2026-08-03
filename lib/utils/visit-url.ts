/**
 * Mirror the open visit into the schedule page's `?visit=` param.
 *
 * Uses the native history API rather than `router.replace` on purpose. `?visit=`
 * lives on a Server Component page, so going through the Next router would
 * re-run it — four `getScheduleForWeek` queries plus employees and vehicles —
 * on every sheet open AND close. Opening a visit is instant local state today,
 * and owners are often on weak rural signal; a shareable URL isn't worth making
 * every click wait on six queries.
 *
 * Next supports native `history.pushState`/`replaceState` for exactly this, and
 * keeps `useSearchParams` in sync. `replaceState` (not `push`) means no extra
 * history entry — Back still leaves the page rather than closing the sheet,
 * which would need a popstate listener to do properly.
 */
export function syncVisitUrlParam(visitId: string | null, windowStart?: string) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const nextVisit = visitId ?? null
  const currentVisit = url.searchParams.get('visit')

  // `windowStart` is the FIRST of the four rendered week columns — not the
  // clicked visit's own week. Pinning it makes a shared or reloaded URL reproduce
  // exactly the grid you're looking at, and because it matches what the server
  // already rendered, the router.refresh() on sheet close is a no-op rather than
  // sliding the grid to a different window.
  const nextWeek = windowStart ?? url.searchParams.get('week')
  const currentWeek = url.searchParams.get('week')

  if (currentVisit === nextVisit && currentWeek === nextWeek) return

  if (nextVisit) url.searchParams.set('visit', nextVisit)
  else url.searchParams.delete('visit')

  if (nextWeek) url.searchParams.set('week', nextWeek)

  window.history.replaceState(null, '', url)
}
