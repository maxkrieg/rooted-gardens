import { createClient } from '@/lib/supabase/client'
import type {
  Account,
  AccountListRow,
  AccountWithDetails,
  Photo,
  RecentVisit,
} from '@/types/app'

/**
 * The accounts list. Last-visit dates come from the account_last_visit view —
 * one row per account — rather than scanning every completed visit ever, which
 * both truncated at PostgREST's row cap and was far too large to cache.
 */
export async function fetchAccountsList(): Promise<AccountListRow[]> {
  const supabase = createClient()

  const [accountsResult, lastVisitResult] = await Promise.all([
    // PostgREST returns the embedded count as [{ count: N }] per row. The count
    // is filtered too, so an archived property can't inflate it.
    supabase
      .from('accounts')
      .select('*, properties(count)')
      .eq('is_archived', false)
      .eq('properties.is_archived', false)
      .order('name'),
    supabase.from('account_last_visit').select('account_id, last_visit_at'),
  ])

  if (accountsResult.error) throw accountsResult.error
  // Not fatal — the list is still useful without the "last visit" column.
  if (lastVisitResult.error) console.error('[fetchAccountsList] last visit', lastVisitResult.error)

  const lastVisitByAccount = new Map<string, string>()
  for (const row of lastVisitResult.data ?? []) {
    if (row.account_id && row.last_visit_at) lastVisitByAccount.set(row.account_id, row.last_visit_at)
  }

  return (accountsResult.data ?? []).map((row) => {
    const countArr = row.properties as unknown as { count: number }[]
    const { properties: _omit, ...account } = row
    return {
      ...(account as Account),
      propertyCount: countArr?.[0]?.count ?? 0,
      lastVisitDate: lastVisitByAccount.get(account.id) ?? null,
    }
  })
}

export type AccountDetail = {
  account: AccountWithDetails
  visits: RecentVisit[]
  /** property_id → route group. Decorative: a failure just omits the badge. */
  routeGroupByPropertyId: Record<string, { id: string; name: string }>
  visitsFailed: boolean
}

/** Null rather than a throw when the account is missing or archived — the caller
 *  renders a not-found state, and a throw would look like a network failure. */
export async function fetchAccountDetail(id: string): Promise<AccountDetail | null> {
  const supabase = createClient()

  const accountResult = await supabase
    .from('accounts')
    .select('*, properties(*)')
    .eq('id', id)
    .eq('is_archived', false)
    .eq('properties.is_archived', false)
    .maybeSingle()

  if (accountResult.error) throw accountResult.error
  if (!accountResult.data) return null

  const account = {
    ...accountResult.data,
    properties: [...accountResult.data.properties].sort((a, b) =>
      a.address.localeCompare(b.address),
    ),
  } as AccountWithDetails

  const propertyIds = account.properties.map((p) => p.id)

  const [visitsResult, routeGroupResult] = await Promise.all([
    // Full property + visit_crew(employee) join — needed to open VisitDetailSheet
    // directly from a row, same shape the schedule grid uses.
    supabase
      .from('visits')
      .select(
        '*, property:properties(*), visit_crew(*, employee:employees(*)), invoice:invoices(status, qbo_invoice_id)',
      )
      .eq('account_id', account.id)
      .eq('status', 'completed')
      .order('week_start', { ascending: false })
      .limit(10),
    propertyIds.length > 0
      ? supabase
          .from('property_route_groups')
          .select('property_id, route_groups(id, name)')
          .in('property_id', propertyIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (visitsResult.error) console.error('[fetchAccountDetail] visits', visitsResult.error)
  if (routeGroupResult.error) console.error('[fetchAccountDetail] route groups', routeGroupResult.error)

  const routeGroupByPropertyId: AccountDetail['routeGroupByPropertyId'] = {}
  for (const row of (routeGroupResult.data ?? []) as Array<{
    property_id: string
    route_groups: { id: string; name: string } | null
  }>) {
    if (row.route_groups) routeGroupByPropertyId[row.property_id] = row.route_groups
  }

  return {
    account,
    visits: (visitsResult.data ?? []) as unknown as RecentVisit[],
    routeGroupByPropertyId,
    visitsFailed: !!visitsResult.error,
  }
}

/** Photo *rows* only. Signed URLs are fetched separately and never persisted —
 *  they expire in an hour, so a restored one is always dead. */
export async function fetchAccountPhotos(propertyIds: string[]): Promise<Photo[]> {
  if (propertyIds.length === 0) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .in('property_id', propertyIds)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []) as Photo[]
}
