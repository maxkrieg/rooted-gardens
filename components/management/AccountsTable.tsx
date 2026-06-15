'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Plus, Search } from 'lucide-react'
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
import { AccountCard } from '@/components/management/AccountCard'
import { AccountStatusBadge, BillingTypeBadge } from '@/components/management/badges'
import type { AccountListRow, AccountStatus, BillingType } from '@/types/app'

// ─── Price display ────────────────────────────────────────────────────────────

function formatPrice(row: AccountListRow): string {
  if (row.billing_type === 'per_visit' && row.price_per_visit != null) {
    return `$${row.price_per_visit.toFixed(2)} / visit`
  }
  if (row.billing_type === 'contract' && row.contract_rate != null) {
    const period = row.contract_period ?? 'period'
    return `$${row.contract_rate.toFixed(2)} / ${period}`
  }
  return '—'
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AccountsTableProps {
  accounts: AccountListRow[]
}

export function AccountsTable({ accounts }: AccountsTableProps) {
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
    router.push(`/management/accounts/${id}`)
  }

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
            <SelectItem value="as_needed">As Needed</SelectItem>
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
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-40 text-center text-muted-foreground"
                >
                  {accounts.length === 0
                    ? 'No accounts yet. Add your first one.'
                    : 'No accounts match the current filters.'}
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
                    {formatPrice(account)}
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
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
            <p className="text-sm">
              {accounts.length === 0
                ? 'No accounts yet. Add your first one.'
                : 'No accounts match the current filters.'}
            </p>
          </div>
        ) : (
          filtered.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))
        )}
      </div>

      {/* New Account sheet (placeholder — AccountForm wired in task 2.3) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-card">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-display text-xl">New Account</SheetTitle>
            <SheetDescription>
              Account form — coming in task 2.3.
            </SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-border text-muted-foreground text-sm">
            AccountForm placeholder
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
