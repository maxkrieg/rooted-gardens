'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ExternalLink } from 'lucide-react'
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
import { groupVisitsByInvoice } from '@/lib/utils/billing'
import type { RevenueSummary } from '@/app/management/billing/actions'
import type { VisitWithLocation } from '@/types/app'

interface InvoicedHistoryProps {
  visits: VisitWithLocation[]
  month: string
  revenue: RevenueSummary
}

function qboInvoiceUrl(qboInvoiceId: string): string {
  return `https://app.qbo.intuit.com/app/invoice?txnId=${qboInvoiceId}`
}

function RevenueCard({
  label,
  data,
}: {
  label: string
  data: { total: number; perVisit: number; contract: number }
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-3.5 shadow-warm">
      <p className="font-display text-lg font-semibold text-foreground tabular-nums">
        ${data.total.toFixed(2)}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
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
export function InvoicedHistory({ visits, month, revenue }: InvoicedHistoryProps) {
  const [accountFilter, setAccountFilter] = useState<string>('all')

  const accountOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of visits) map.set(v.account.id, v.account.name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [visits])

  const groups = useMemo(() => {
    const all = groupVisitsByInvoice(visits)
    return accountFilter === 'all' ? all : all.filter((g) => g.account.id === accountFilter)
  }, [visits, accountFilter])

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

      {groups.length === 0 ? (
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
              {groups.flatMap((group) => {
                const invoicedDate = format(parseISO(group.invoicedAt), 'MMM d')
                const link = (
                  <a
                    href={qboInvoiceUrl(group.qboInvoiceId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {group.qboInvoiceId}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )

                if (group.account.billing_type === 'contract') {
                  return [
                    <TableRow key={group.qboInvoiceId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{group.account.name}</span>
                          <BillingTypeBadge billingType={group.account.billing_type} />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {group.visits.length} visit{group.visits.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{invoicedDate}</TableCell>
                      <TableCell>{link}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        ${group.totalAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>,
                  ]
                }

                return [
                  <TableRow key={`${group.qboInvoiceId}-header`} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={4}>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm text-foreground">{group.account.name}</span>
                        <BillingTypeBadge billingType={group.account.billing_type} />
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...group.visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="pl-8 text-foreground">{visit.property.address}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{invoicedDate}</TableCell>
                      <TableCell>{link}</TableCell>
                      <TableCell className="text-right tabular-nums">
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
    </div>
  )
}
