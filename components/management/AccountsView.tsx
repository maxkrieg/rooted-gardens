'use client'

import { AccountsTable } from '@/components/management/AccountsTable'
import { CachedNotice } from '@/components/states/CachedNotice'
import { ErrorState } from '@/components/states/ErrorState'
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountsList } from '@/hooks/useAccounts'
import { useIsHydrated } from '@/hooks/use-hydrated'

/**
 * Client-first accounts list, so the "who is this customer, what's their number"
 * lookup works in the field. AccountsTable already owns its own filtering, so it
 * takes the same prop it always did.
 */
export function AccountsView() {
  const hydrated = useIsHydrated()
  const { accounts, isLoading, isError, isStale, hasData } = useAccountsList()

  // The server has no React Query cache, so anything but the skeleton here is a
  // guaranteed hydration mismatch.
  if (!hydrated || (isLoading && !hasData)) return <AccountsSkeleton />
  if (isError && !hasData) {
    return <ErrorState title="Accounts didn't load." hint="Check your connection, then try again." />
  }

  return (
    <>
      {isStale && <CachedNotice />}
      <AccountsTable accounts={accounts} />
    </>
  )
}

/** Mirrors app/management/accounts/loading.tsx, which now only covers the shell. */
function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-10 w-full max-w-sm rounded-md" />
      <CardListSkeleton rows={8} height="h-16" />
    </div>
  )
}
