/**
 * Mirror the open lead into the leads page's `?lead=` param — the same
 * native-history idiom as lib/utils/visit-url.ts's syncVisitUrlParam, and for
 * the same reason: `?lead=` lives on a Server Component page, so a
 * router.replace would re-run its leads + assignees queries on every sheet
 * open/close. `replaceState` (not `push`) means no extra history entry.
 */
export function syncLeadUrlParam(leadId: string | null) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  const current = url.searchParams.get('lead')
  const next = leadId ?? null
  if (current === next) return

  if (next) url.searchParams.set('lead', next)
  else url.searchParams.delete('lead')

  window.history.replaceState(null, '', url)
}
