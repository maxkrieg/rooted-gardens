import { createClient } from '@/lib/supabase/server'
import { AccountsTable } from '@/components/management/AccountsTable'
import type { Account, AccountListRow } from '@/types/app'

/**
 * Server Component — fetches accounts with property counts and last-visit dates,
 * then passes the merged list to the interactive AccountsTable client component.
 */
export default async function AccountsPage() {
  const supabase = await createClient()

  // ── 1. Accounts + embedded property count ────────────────────────────────
  // PostgREST returns properties as [{ count: N }] per row.
  const { data: accountsData, error: accountsError } = await supabase
    .from('accounts')
    .select('*, properties(count)')
    .order('name')

  if (accountsError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Could not load accounts — try refreshing.
      </div>
    )
  }

  // ── 2. Last visit per account (max actual_date of any completed visit) ───
  const { data: visitsData } = await supabase
    .from('visits')
    .select('account_id, actual_date')
    .not('actual_date', 'is', null)
    .order('actual_date', { ascending: false })

  // Reduce to a map of account_id → most recent actual_date.
  // Since rows are ordered DESC, the first occurrence per account is the max.
  const lastVisitMap = new Map<string, string>()
  for (const v of visitsData ?? []) {
    if (v.account_id && v.actual_date && !lastVisitMap.has(v.account_id)) {
      lastVisitMap.set(v.account_id, v.actual_date)
    }
  }

  // ── 3. Merge into AccountListRow[] ───────────────────────────────────────
  const rows: AccountListRow[] = (accountsData ?? []).map((row) => {
    // properties(count) returns [{ count: N }]; cast explicitly.
    const countArr = row.properties as unknown as { count: number }[]
    const propertyCount = countArr?.[0]?.count ?? 0

    // Destructure without the embedded relation so Account fields are clean.
    const { properties: _omit, ...account } = row

    return {
      ...(account as Account),
      propertyCount,
      lastVisitDate: lastVisitMap.get(account.id) ?? null,
    }
  })

  return <AccountsTable accounts={rows} />
}
