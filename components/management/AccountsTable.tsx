'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Plus, Search, Building2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AccountForm } from '@/components/management/AccountForm'
import { AccountStatusBadge, BillingTypeBadge } from '@/components/management/badges'
import { EmptyState } from '@/components/states/EmptyState'
import { formatAccountPrice } from '@/lib/utils/accounts'
import type { AccountListRow, AccountStatus, BillingType } from '@/types/app'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { CachedNotice } from '@/components/states/CachedNotice'
import { ErrorState } from '@/components/states/ErrorState'
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/states/skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountsList } from '@/hooks/useAccounts'
import { useIsHydrated } from '@/hooks/use-hydrated'

// ─── Main component ───────────────────────────────────────────────────────────

interface AccountsTableProps {
  accounts: AccountListRow[]
}

function AccountsTable({ accounts }: AccountsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all')
  const [billingFilter, setBillingFilter] = useState<BillingType | 'all'>('all')
  const [sheetOpen, setSheetOpen] = useState(false)

  // Client-side filtering
  const filtered = accounts.filter((a) => {
    const matchesSearch =
      search === '' ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.contact_name ?? '').toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    const matchesBilling = billingFilter === 'all' || a.billing_type === billingFilter

    return matchesSearch && matchesStatus && matchesBilling
  })

  function handleRowClick(id: string) {
    router.push(`/app/accounts/${id}`)
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setBillingFilter('all')
  }

  // Shared by the desktop table and the mobile list. Two different problems: a
  // list never filled in needs "add", one hidden by filters needs them cleared.
  const emptyState =
    accounts.length === 0 ? (
      <EmptyState
        variant="seed"
        title="No accounts yet"
        hint="Accounts are who gets invoiced. Add one, then give it the properties you service."
        action={<Button onClick={() => setSheetOpen(true)}>Add your first account</Button>}
      />
    ) : (
      <EmptyState
        variant="pruned"
        title="No accounts match your filters"
        hint="Widen the search, or clear the filters to see all of them."
        action={
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    )

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">Accounts</h1>
        <Button
          onClick={() => setSheetOpen(true)}
          className="h-10 gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Account</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search accounts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AccountStatus | 'all')}
        >
          <SelectTrigger className="h-10 w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="prospective">Prospective</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={billingFilter}
          onValueChange={(v) => setBillingFilter(v as BillingType | 'all')}
        >
          <SelectTrigger className="h-10 w-full sm:w-44">
            <SelectValue placeholder="Billing type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All billing types</SelectItem>
            <SelectItem value="per_visit">Per Visit</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? 'account' : 'accounts'}
      </p>

      {/* Desktop table (md+) */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden bg-card shadow-warm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="font-semibold text-foreground pl-5">Name</TableHead>
              <TableHead className="font-semibold text-foreground">Billing Type</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground tabular-nums">Price / Rate</TableHead>
              <TableHead className="font-semibold text-foreground">Properties</TableHead>
              <TableHead className="font-semibold text-foreground tabular-nums pr-5">Last Visit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((account) => (
                <TableRow
                  key={account.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleRowClick(account.id)}
                >
                  <TableCell className="pl-5">
                    <div>
                      <p className="font-medium text-foreground">{account.name}</p>
                      {account.contact_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {account.contact_name}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <BillingTypeBadge billingType={account.billing_type} />
                  </TableCell>
                  <TableCell>
                    <AccountStatusBadge status={account.status} />
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {formatAccountPrice(account)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {account.propertyCount}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground pr-5">
                    {account.lastVisitDate
                      ? format(parseISO(account.lastVisitDate), 'EEE MMM d')
                      : <span className="italic">No visits yet</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list (< md) */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          emptyState
        ) : (
          filtered.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))
        )}
      </div>

      {/* New Account slide-over */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="font-display text-xl">New Account</SheetTitle>
            <SheetDescription>
              Fill in the details below to add a new billing account.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <AccountForm onSuccess={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function AccountCard({ account }: { account: AccountListRow }) {
  return (
    <Link href={`/app/accounts/${account.id}`} className="block">
      <Card className="rounded-2xl border border-border shadow-warm hover:shadow-warm-lg transition-shadow">
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-foreground truncate">
                {account.name}
              </p>
              {account.contact_name && (
                <p className="text-sm text-muted-foreground truncate">{account.contact_name}</p>
              )}
            </div>
            <AccountStatusBadge status={account.status} />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <BillingTypeBadge billingType={account.billing_type} />

            <span className="tabular-nums">{formatAccountPrice(account)}</span>

            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {account.propertyCount} {account.propertyCount === 1 ? 'property' : 'properties'}
            </span>

            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {account.lastVisitDate
                ? format(parseISO(account.lastVisitDate), 'EEE MMM d')
                : 'No visits yet'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

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

/** Mirrors app/app/(padded)/accounts/loading.tsx, which now only covers the shell. */
function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-10 w-full max-w-sm rounded-md" />
      <CardListSkeleton rows={8} height="h-16" />
    </div>
  )
}
