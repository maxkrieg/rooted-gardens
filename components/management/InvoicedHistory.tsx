'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ExternalLink } from 'lucide-react'
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
import { BillingTypeBadge } from '@/components/management/badges'
import { VisitDetailSheet } from '@/components/management/VisitDetailSheet'
import { groupVisitsByInvoice, type InvoiceGroup } from '@/lib/utils/billing'
import type { RevenueSummary } from '@/app/management/billing/actions'
import type { ContractInvoiceWithAccount, EmployeeRole, VisitWithLocation } from '@/types/app'

interface InvoicedHistoryProps {
  visits: VisitWithLocation[]
  contractInvoices: ContractInvoiceWithAccount[]
  month: string
  revenue: RevenueSummary
  role: EmployeeRole | undefined
}

type DisplayEntry =
  | { type: 'visitGroup'; invoicedAt: string; group: InvoiceGroup }
  | { type: 'contractInvoice'; invoicedAt: string; invoice: ContractInvoiceWithAccount }

function qboInvoiceUrl(qboInvoiceId: string): string {
  return `https://app.qbo.intuit.com/app/invoice?txnId=${qboInvoiceId}`
}

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
 * Read-only audit trail of already-invoiced visits (task 5.5), grouped by the
 * actual QBO invoice (not by account — one account can be pushed more than
 * once in a month). Amounts are the invoice_amount snapshot (task 5.6), never
 * a live account price, so the trail stays correct even after a price change.
 */
export function InvoicedHistory({ visits, contractInvoices, month, revenue, role }: InvoicedHistoryProps) {
  const router = useRouter()
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetVisit, setSheetVisit] = useState<VisitWithLocation | null>(null)
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(() => new Set())

  function handleVisitClick(visit: VisitWithLocation) {
    setSheetVisit(visit)
    setSheetOpen(true)
  }

  function handleAccountClick(accountId: string) {
    router.push(`/management/accounts/${accountId}`)
  }

  function toggleInvoiceExpanded(qboInvoiceId: string) {
    setExpandedInvoiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(qboInvoiceId)) next.delete(qboInvoiceId)
      else next.add(qboInvoiceId)
      return next
    })
  }

  const accountOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of visits) map.set(v.account.id, v.account.name)
    for (const inv of contractInvoices) map.set(inv.account.id, inv.account.name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [visits, contractInvoices])

  // Contract invoices render exclusively from the contract_invoices table
  // (Step 4 — ad-hoc contract invoicing), so visit-derived groups exclude
  // contract accounts entirely here — otherwise a contract invoice's tagged
  // visits would also form a group via groupVisitsByInvoice, duplicating the row.
  const groups = useMemo(() => {
    const all = groupVisitsByInvoice(visits).filter((g) => g.account.billing_type !== 'contract')
    return accountFilter === 'all' ? all : all.filter((g) => g.account.id === accountFilter)
  }, [visits, accountFilter])

  const filteredContractInvoices = useMemo(
    () =>
      accountFilter === 'all'
        ? contractInvoices
        : contractInvoices.filter((inv) => inv.account.id === accountFilter),
    [contractInvoices, accountFilter],
  )

  const combined = useMemo<DisplayEntry[]>(() => {
    const visitEntries: DisplayEntry[] = groups.map((group) => ({
      type: 'visitGroup',
      invoicedAt: group.invoicedAt,
      group,
    }))
    const contractEntries: DisplayEntry[] = filteredContractInvoices.map((invoice) => ({
      type: 'contractInvoice',
      invoicedAt: invoice.invoiced_at,
      invoice,
    }))
    return [...visitEntries, ...contractEntries].sort((a, b) =>
      a.invoicedAt < b.invoicedAt ? 1 : -1,
    )
  }, [groups, filteredContractInvoices])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RevenueCard label="Invoiced this month" data={revenue.mtd} />
        <RevenueCard label="Invoiced this year" data={revenue.ytd} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="h-10 w-full sm:w-56">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accountOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {combined.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground rounded-xl border border-border bg-card">
          No invoiced visits for {format(parseISO(`${month}-01`), 'MMMM yyyy')}.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account / Property</TableHead>
                <TableHead>Invoiced</TableHead>
                <TableHead>QBO Invoice</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combined.flatMap((entry) => {
                if (entry.type === 'contractInvoice') {
                  const invoice = entry.invoice
                  const invoicedDate = format(parseISO(invoice.invoiced_at), 'MMM d')
                  return [
                    <TableRow
                      key={invoice.id}
                      onClick={() => handleAccountClick(invoice.account.id)}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{invoice.account.name}</span>
                          <BillingTypeBadge billingType={invoice.account.billing_type} />
                          <span className="text-xs text-muted-foreground">{invoice.period_label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{invoicedDate}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        ${Number(invoice.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>,
                  ]
                }

                const { group } = entry
                const invoicedDate = format(parseISO(group.invoicedAt), 'MMM d')
                const link = (
                  <a
                    href={qboInvoiceUrl(group.qboInvoiceId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {group.qboInvoiceId}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )

                const isExpanded = expandedInvoiceIds.has(group.qboInvoiceId)

                const headerRow = (
                  <TableRow
                    key={`${group.qboInvoiceId}-header`}
                    onClick={() => handleAccountClick(group.account.id)}
                    className="bg-muted/30 hover:bg-accent/40 transition-colors cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm text-foreground">{group.account.name}</span>
                          <BillingTypeBadge billingType={group.account.billing_type} />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {group.visits.length} visit{group.visits.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleInvoiceExpanded(group.qboInvoiceId)
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
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{invoicedDate}</TableCell>
                    <TableCell>{link}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ${group.totalAmount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                )

                if (!isExpanded) return [headerRow]

                return [
                  headerRow,
                  ...group.visits.map((visit) => (
                    <TableRow
                      key={visit.id}
                      onClick={() => handleVisitClick(visit)}
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
                      <TableCell className="py-1.5 text-right text-sm tabular-nums">
                        ${Number(visit.invoice_amount ?? 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )),
                ]
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {sheetVisit && (
        <VisitDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          row={{
            property: sheetVisit.property,
            account: sheetVisit.account,
            visit: { ...sheetVisit, visit_crew: [] },
          }}
          weekStart={sheetVisit.week_start}
          role={role}
        />
      )}
    </div>
  )
}
