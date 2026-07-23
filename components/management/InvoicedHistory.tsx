'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Check, ChevronDown, ChevronsUpDown, ExternalLink, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { BillingTypeBadge, InvoiceStatusBadge } from '@/components/management/badges'
import { SortableTableHead } from '@/components/management/SortableTableHead'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { HistoryDateRangeFilter } from '@/components/management/HistoryDateRangeFilter'
import { pollInvoiceStatuses, refreshInvoiceStatuses } from '@/app/management/billing/actions'
import { qboInvoiceUrl, type DateRangePreset } from '@/lib/utils/billing'
import { cn } from '@/lib/utils'
import type { RevenueSummary } from '@/app/management/billing/actions'
import type {
  Account,
  EmployeeRole,
  InvoiceWithVisits,
  Property,
  Visit,
} from '@/types/app'

interface InvoicedHistoryProps {
  invoices: InvoiceWithVisits[]
  rangeLabel: string
  rangePreset: DateRangePreset
  customStart?: string
  customEnd?: string
  revenue: RevenueSummary
  role: EmployeeRole | undefined
}

type SheetRow = { property: Property; account: Account; visit: Visit }

// How often the tab auto-refreshes invoice status while visible. The server
// action is staleness-gated (see pollInvoiceStatuses), so this only bounds how
// quickly a stale invoice gets picked up — not how hard QBO is hit.
const POLL_INTERVAL_MS = 60_000

const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'] as const
const STATUS_LABELS: Record<(typeof INVOICE_STATUSES)[number], string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
}
// Lifecycle order for sorting the Status column (not alphabetical).
const STATUS_RANK: Record<string, number> = { draft: 0, sent: 1, overdue: 2, paid: 3 }

type InvoiceSortKey = 'account' | 'date' | 'dueDate' | 'status' | 'amount'

function RevenueCard({
  label,
  data,
}: {
  label: string
  data: { total: number; perVisit: number; contract: number; label: string }
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-3.5 shadow-warm">
      <p className="font-display text-lg font-semibold text-foreground tabular-nums">
        ${data.total.toFixed(2)}
      </p>
      <p className="text-xs text-muted-foreground">
        {label} <span className="text-muted-foreground/70">({data.label})</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
        Per-visit ${data.perVisit.toFixed(2)} · Contract ${data.contract.toFixed(2)}
      </p>
    </div>
  )
}

/**
 * Read-only audit trail of already-created invoices, one row per QBO invoice
 * (from the canonical `invoices` table), showing its real QBO lifecycle status
 * (draft/sent/paid/overdue). per_visit invoices are collapsible to their billed
 * visits; contract invoices show their period. Amounts are the invoice total
 * snapshot, never a live account price. "Refresh now" pulls current status for
 * the visible invoices from QuickBooks on demand (the daily cron does the same
 * unattended).
 */
export function InvoicedHistory({
  invoices,
  rangeLabel,
  rangePreset,
  customStart,
  customEnd,
  revenue,
  role,
}: InvoicedHistoryProps) {
  const router = useRouter()
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false)
  const [sort, setSort] = useState<{ key: InvoiceSortKey; dir: 'asc' | 'desc' }>({
    key: 'date',
    dir: 'desc',
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetRow, setSheetRow] = useState<SheetRow | null>(null)
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(() => new Set())
  const [refreshing, startRefresh] = useTransition()

  function handleVisitClick(row: SheetRow) {
    setSheetRow(row)
    setSheetOpen(true)
  }

  function handleAccountClick(accountId: string) {
    router.push(`/management/accounts/${accountId}`)
  }

  function toggleInvoiceExpanded(invoiceId: string) {
    setExpandedInvoiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(invoiceId)) next.delete(invoiceId)
      else next.add(invoiceId)
      return next
    })
  }

  const accountOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const inv of invoices) map.set(inv.account.id, inv.account.name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [invoices])

  const filtered = useMemo(() => {
    let list = invoices
    if (accountFilter !== 'all') list = list.filter((inv) => inv.account.id === accountFilter)
    if (statusFilter !== 'all') list = list.filter((inv) => inv.status === statusFilter)
    return list
  }, [invoices, accountFilter, statusFilter])

  // Display order — filtered rows sorted by the active column. Kept separate from
  // `filtered` (which backs the refresh/poll id sets, where order is irrelevant).
  const sorted = useMemo(() => {
    const { key, dir } = sort
    const factor = dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      // Invoices with no due date (e.g. drafts) always sort to the bottom,
      // regardless of direction — so the factor is applied before this returns.
      if (key === 'dueDate') {
        if (!a.qbo_due_date && !b.qbo_due_date) return 0
        if (!a.qbo_due_date) return 1
        if (!b.qbo_due_date) return -1
        return a.qbo_due_date.localeCompare(b.qbo_due_date) * factor
      }
      let cmp = 0
      if (key === 'account') cmp = a.account.name.localeCompare(b.account.name)
      else if (key === 'date') cmp = a.created_at.localeCompare(b.created_at)
      else if (key === 'status') cmp = (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0)
      else cmp = Number(a.amount) - Number(b.amount)
      return cmp * factor
    })
  }, [filtered, sort])

  function toggleSort(key: InvoiceSortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  function handleRefresh() {
    const ids = filtered.map((inv) => inv.id)
    if (ids.length === 0) return
    startRefresh(async () => {
      const { processed, errors } = await refreshInvoiceStatuses(ids)
      if (errors > 0) {
        toast.warning(`Refreshed ${processed} invoice${processed === 1 ? '' : 's'}, ${errors} failed`)
      } else {
        toast.success(`Refreshed ${processed} invoice${processed === 1 ? '' : 's'} from QuickBooks`)
      }
      router.refresh()
    })
  }

  // Background auto-refresh while the tab is visible: polls QBO status for the
  // visible, non-terminal (not paid) invoices on an interval and the moment the
  // tab regains focus. The server action is staleness-gated, so a short interval,
  // frequent refocus, or multiple open tabs can't hammer the QBO API. Silent —
  // the "Refresh now" button is the explicit, force-now path. Ids live in a ref
  // so the effect subscribes once (on mount) rather than re-subscribing whenever
  // the data changes.
  const pollableIds = useMemo(
    () => filtered.filter((inv) => inv.status !== 'paid').map((inv) => inv.id),
    [filtered],
  )
  const pollableIdsRef = useRef(pollableIds)
  useEffect(() => {
    pollableIdsRef.current = pollableIds
  }, [pollableIds])
  const pollInFlight = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      if (pollInFlight.current || document.hidden) return
      const ids = pollableIdsRef.current
      if (ids.length === 0) return
      pollInFlight.current = true
      try {
        const { synced } = await pollInvoiceStatuses(ids)
        // Only re-render when something actually changed — the staleness gate
        // makes most polls no-ops, so this avoids needless refresh churn.
        if (!cancelled && synced > 0) router.refresh()
      } catch {
        // Transient/network — the next tick retries.
      } finally {
        pollInFlight.current = false
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS)
    const kickoff = setTimeout(poll, 3_000) // one soon after landing
    function onVisibility() {
      if (!document.hidden) poll() // catch changes made while the tab was hidden
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      clearInterval(interval)
      clearTimeout(kickoff)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [router])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RevenueCard label="Invoiced this month" data={revenue.mtd} />
        <RevenueCard label="Invoiced this year" data={revenue.ytd} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <HistoryDateRangeFilter preset={rangePreset} customStart={customStart} customEnd={customEnd} />

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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          className="h-10 gap-1.5"
          onClick={handleRefresh}
          disabled={refreshing || filtered.length === 0}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground rounded-xl border border-border bg-card">
          No invoices for {rangeLabel}.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label="Account"
                  sortKey="account"
                  currentKey={sort.key}
                  dir={sort.dir}
                  onSort={toggleSort}
                />
                <SortableTableHead
                  label="Invoice Date"
                  sortKey="date"
                  currentKey={sort.key}
                  dir={sort.dir}
                  onSort={toggleSort}
                />
                <SortableTableHead
                  label="Due Date"
                  sortKey="dueDate"
                  currentKey={sort.key}
                  dir={sort.dir}
                  onSort={toggleSort}
                />
                <TableHead>QBO Invoice</TableHead>
                <SortableTableHead
                  label="Status"
                  sortKey="status"
                  currentKey={sort.key}
                  dir={sort.dir}
                  onSort={toggleSort}
                />
                <SortableTableHead
                  label="Amount"
                  sortKey="amount"
                  currentKey={sort.key}
                  dir={sort.dir}
                  onSort={toggleSort}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.flatMap((invoice) => {
                const invoicedDate = format(parseISO(invoice.created_at), 'MMM d')
                const isContract = invoice.billing_type === 'contract'
                const expandable = !isContract && invoice.visits.length > 0
                const isExpanded = expandedInvoiceIds.has(invoice.id)
                const link = (
                  <a
                    href={qboInvoiceUrl(invoice.qbo_invoice_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {invoice.qbo_invoice_id}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )

                const headerRow = (
                  <TableRow
                    key={`${invoice.id}-header`}
                    onClick={() => handleAccountClick(invoice.account.id)}
                    className="bg-muted/30 hover:bg-accent/40 transition-colors cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm text-foreground">{invoice.account.name}</span>
                          <BillingTypeBadge billingType={invoice.account.billing_type} />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {isContract
                              ? invoice.period_label
                              : `${invoice.visits.length} visit${invoice.visits.length === 1 ? '' : 's'}`}
                          </span>
                        </div>
                        {expandable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleInvoiceExpanded(invoice.id)
                            }}
                            aria-label={isExpanded ? 'Collapse visits' : 'Expand visits'}
                            aria-expanded={isExpanded}
                            className="shrink-0 rounded p-1 hover:bg-accent/60 transition-colors"
                          >
                            <ChevronDown
                              className="h-4 w-4 text-muted-foreground transition-transform duration-200"
                              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{invoicedDate}</TableCell>
                    <TableCell
                      className={cn(
                        'tabular-nums',
                        invoice.status === 'overdue'
                          ? 'text-destructive font-medium'
                          : 'text-muted-foreground',
                      )}
                    >
                      {invoice.qbo_due_date ? format(parseISO(invoice.qbo_due_date), 'MMM d') : '—'}
                    </TableCell>
                    <TableCell>{link}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ${Number(invoice.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                )

                if (!expandable || !isExpanded) return [headerRow]

                return [
                  headerRow,
                  ...invoice.visits.map((visit) => (
                    <TableRow
                      key={visit.id}
                      onClick={() =>
                        handleVisitClick({ property: visit.property, account: invoice.account, visit })
                      }
                      className="cursor-pointer hover:bg-accent/40 transition-colors bg-muted/10"
                    >
                      <TableCell className="pl-8 py-1.5 text-sm text-foreground">
                        {visit.property.address}
                        {visit.ended_at && (
                          <span className="text-xs text-muted-foreground">
                            {' '}
                            — {format(parseISO(visit.ended_at), 'MMM d')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5" />
                      <TableCell className="py-1.5" />
                      <TableCell className="py-1.5" />
                      <TableCell className="py-1.5" />
                      <TableCell className="py-1.5 text-right text-sm tabular-nums">
                        {/* Per-line price = invoice total / visit count. Every
                            per_visit line is billed at the same price, so this is
                            exact and stays a point-in-time snapshot (invoices.amount
                            is stored at push time, never a live account lookup). */}
                        ${(Number(invoice.amount) / invoice.visits.length).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )),
                ]
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {sheetRow && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          row={{
            property: sheetRow.property,
            account: sheetRow.account,
            visit: { ...sheetRow.visit, visit_crew: [] },
          }}
          weekStart={sheetRow.visit.week_start}
          role={role}
        />
      )}
    </div>
  )
}
