'use client'

import { useMemo, useState, useTransition } from 'react'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AccountInvoiceDrawer } from '@/components/management/AccountInvoiceDrawer'
import { SortableTableHead, type SortDir } from '@/components/management/SortableTableHead'
import { BillingTypeBadge } from '@/components/management/badges'
import { pushInvoicesToQuickBooks } from '@/app/management/billing/actions'
import {
  groupVisitsByAccount,
  resolveDateRange,
  DATE_RANGE_PRESETS,
  DATE_RANGE_PRESET_LABELS,
  type AccountGroup,
  type DateRangePreset,
} from '@/lib/utils/billing'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { cn } from '@/lib/utils'
import type { VisitWithLocation } from '@/types/app'

interface InvoiceQueueProps {
  visits: VisitWithLocation[]
  qboConnected: boolean
}

/** The dollars an account's uninvoiced (shown) visits will bill: per_visit rate
 *  × visit count. The queue is per_visit-only, so this is the whole story. */
function accountTotal(group: AccountGroup): number {
  const price = group.account.price_per_visit != null ? Number(group.account.price_per_visit) : 0
  return price * group.visits.length
}

// The Queue's own date filter adds an "All time" default on top of the History
// tab's presets — the Queue's job is to surface *every* unbilled visit so nothing
// old is missed, so it must not hide old work by default the way History does.
type QueueDatePreset = 'all' | DateRangePreset
type SortKey = 'account' | 'visits' | 'total'

/**
 * The billing invoice queue — one row per (per_visit) account with uninvoiced,
 * completed visits. Checking an account row and pushing bills *all* of that
 * account's shown uninvoiced visits onto a single QBO invoice ("bazooka");
 * clicking a row opens a drawer to hand-pick which visits go on the invoice
 * instead. Sortable columns + the same Date/Account filters as the Invoices tab
 * (applied in-memory here — the queue already holds every uninvoiced visit).
 */
export function InvoiceQueue({ visits, qboConnected }: InvoiceQueueProps) {
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(() => new Set())
  const [datePreset, setDatePreset] = useState<QueueDatePreset>('all')
  const [customStart, setCustomStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'account', dir: 'asc' })
  const [drawerAccountId, setDrawerAccountId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Reset selection whenever the visit set changes (e.g. after a push
  // revalidates the page) — nothing is pre-selected, so a stale id from a
  // now-invoiced account never lingers. Render-phase reset (React's recommended
  // pattern) rather than an effect, to avoid an extra render pass.
  const [prevVisits, setPrevVisits] = useState(visits)
  if (visits !== prevVisits) {
    setPrevVisits(visits)
    setSelectedAccountIds(new Set())
  }

  // The account dropdown always lists every account in the queue, regardless of
  // the active date filter.
  const accountOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of visits) map.set(v.account.id, v.account.name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [visits])

  const dateRange = useMemo(
    () =>
      datePreset === 'all'
        ? null
        : resolveDateRange({ range: datePreset, start: customStart, end: customEnd }),
    [datePreset, customStart, customEnd],
  )

  const filteredVisits = useMemo(() => {
    let list = visits
    if (dateRange) {
      list = list.filter((v) => {
        const d = parseISO(v.ended_at ?? v.week_start)
        return d >= dateRange.start && d <= dateRange.end
      })
    }
    if (accountFilter !== 'all') list = list.filter((v) => v.account.id === accountFilter)
    return list
  }, [visits, dateRange, accountFilter])

  const groups = useMemo(() => {
    const grouped = groupVisitsByAccount(filteredVisits)
    const { key, dir } = sort
    const factor = dir === 'asc' ? 1 : -1
    return [...grouped].sort((a, b) => {
      let cmp = 0
      if (key === 'account') cmp = a.account.name.localeCompare(b.account.name)
      else if (key === 'visits') cmp = a.visits.length - b.visits.length
      else cmp = accountTotal(a) - accountTotal(b)
      return cmp * factor
    })
  }, [filteredVisits, sort])

  const total = useMemo(
    () =>
      groups.reduce(
        (sum, g) => (selectedAccountIds.has(g.account.id) ? sum + accountTotal(g) : sum),
        0,
      ),
    [groups, selectedAccountIds],
  )
  const selectedCount = useMemo(
    () => groups.filter((g) => selectedAccountIds.has(g.account.id)).length,
    [groups, selectedAccountIds],
  )
  const allVisibleSelected =
    groups.length > 0 && groups.every((g) => selectedAccountIds.has(g.account.id))

  const drawerGroup = drawerAccountId
    ? groups.find((g) => g.account.id === drawerAccountId) ?? null
    : null

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  function toggleAll() {
    setSelectedAccountIds((prev) => {
      if (groups.every((g) => prev.has(g.account.id))) return new Set()
      return new Set(groups.map((g) => g.account.id))
    })
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  function handlePush() {
    // Bazooka: every shown uninvoiced visit for each selected account → one
    // invoice per account (grouping is account-only server-side).
    const ids = groups
      .filter((g) => selectedAccountIds.has(g.account.id))
      .flatMap((g) => g.visits.map((v) => v.id))
    if (ids.length === 0) return
    startTransition(async () => {
      const results = await pushInvoicesToQuickBooks(ids)
      for (const r of results) {
        if (r.success) {
          toast.success(`${r.accountName}: invoice pushed`, {
            description: `QuickBooks invoice ${r.qboInvoiceId}`,
          })
        } else {
          toast.error(`${r.accountName}: push failed`, { description: r.error })
        }
      }
    })
  }

  if (visits.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground rounded-xl border border-border bg-card">
        No completed visits awaiting invoice.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as QueueDatePreset)}>
            <SelectTrigger className="h-10 w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              {DATE_RANGE_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {DATE_RANGE_PRESET_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="h-10 w-[150px]"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                className="h-10 w-[150px]"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>

        <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={accountPopoverOpen}
              className="h-10 w-full sm:w-56 justify-between font-normal"
            >
              <span className="truncate">
                {accountFilter === 'all'
                  ? 'All accounts'
                  : (accountOptions.find(([id]) => id === accountFilter)?.[1] ?? 'All accounts')}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0">
            <Command>
              <CommandInput placeholder="Search accounts…" />
              <CommandList>
                <CommandEmpty>No account found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all accounts"
                    onSelect={() => {
                      setAccountFilter('all')
                      setAccountPopoverOpen(false)
                    }}
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4', accountFilter === 'all' ? 'opacity-100' : 'opacity-0')}
                    />
                    All accounts
                  </CommandItem>
                  {accountOptions.map(([id, name]) => (
                    <CommandItem
                      key={id}
                      value={name}
                      onSelect={() => {
                        setAccountFilter(id)
                        setAccountPopoverOpen(false)
                      }}
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4', accountFilter === id ? 'opacity-100' : 'opacity-0')}
                      />
                      {name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary bar + push */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-warm">
        <div>
          <p className="font-display text-lg font-semibold text-foreground tabular-nums">
            ${total.toFixed(2)} selected
          </p>
          <p className="text-xs text-muted-foreground">
            across {selectedCount} {selectedCount === 1 ? 'invoice' : 'invoices'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handlePush} disabled={pending || selectedCount === 0 || !qboConnected}>
            {pending
              ? 'Pushing…'
              : `Push ${selectedCount} account${selectedCount === 1 ? '' : 's'} to QuickBooks`}
          </Button>
          {!qboConnected && (
            <p className="text-xs text-muted-foreground">Connect QuickBooks above first</p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all accounts"
                  disabled={groups.length === 0}
                />
              </TableHead>
              <SortableTableHead
                label="Account"
                sortKey="account"
                currentKey={sort.key}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortableTableHead
                label="Uninvoiced visits"
                sortKey="visits"
                currentKey={sort.key}
                dir={sort.dir}
                onSort={toggleSort}
              />
              <SortableTableHead
                label="Total Uninvoiced"
                sortKey="total"
                currentKey={sort.key}
                dir={sort.dir}
                onSort={toggleSort}
                align="right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                  No accounts match these filters.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow
                  key={group.account.id}
                  onClick={() => setDrawerAccountId(group.account.id)}
                  className="cursor-pointer hover:bg-accent/40 transition-colors"
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedAccountIds.has(group.account.id)}
                      onCheckedChange={() => toggleAccount(group.account.id)}
                      aria-label={`Select ${group.account.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{group.account.name}</span>
                      <BillingTypeBadge billingType={group.account.billing_type} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatAccountPrice(group.account)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {group.visits.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    ${accountTotal(group).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {drawerGroup && (
        <AccountInvoiceDrawer
          open={drawerAccountId !== null}
          onOpenChange={(open) => {
            if (!open) setDrawerAccountId(null)
          }}
          account={drawerGroup.account}
          visits={drawerGroup.visits}
          qboConnected={qboConnected}
        />
      )}
    </div>
  )
}
