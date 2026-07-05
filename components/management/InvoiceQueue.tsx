'use client'

import { useMemo, useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BillingTypeBadge } from '@/components/management/badges'
import { markVisitsInvoiced } from '@/app/management/billing/actions'
import { groupVisitsByAccount, type AccountInvoiceGroup } from '@/lib/utils/billing'
import { formatAccountPrice } from '@/lib/utils/accounts'
import type { VisitWithLocation } from '@/types/app'

interface InvoiceQueueProps {
  visits: VisitWithLocation[]
  month: string
}

function groupAmount(group: AccountInvoiceGroup, selectedIds: Set<string>): number {
  if (group.account.billing_type === 'contract') {
    const allSelected = group.visits.length > 0 && group.visits.every((v) => selectedIds.has(v.id))
    return allSelected && group.account.contract_rate != null ? Number(group.account.contract_rate) : 0
  }
  return group.visits.reduce((sum, v) => {
    if (!selectedIds.has(v.id)) return sum
    if (group.account.billing_type === 'per_visit' && group.account.price_per_visit != null) {
      return sum + Number(group.account.price_per_visit)
    }
    return sum // as_needed accounts have no stored rate — listed, but contribute $0
  }, 0)
}

/**
 * The billing invoice queue — completed, not-yet-invoiced visits grouped by
 * account. per_visit accounts get one row per visit; contract accounts collapse
 * to a single summary row (flat periodic rate regardless of visit count),
 * matching the schedule grid's account-grouping convention. "Mark as invoiced"
 * is a stopgap manual bulk action standing in for the real QuickBooks push
 * (task 5.4, blocked on OAuth setup) — same invoiced_at field the single-visit
 * toggle in VisitDetailContent already uses.
 */
export function InvoiceQueue({ visits, month }: InvoiceQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(visits.map((v) => v.id)))
  const [pending, startTransition] = useTransition()

  // Re-select everything whenever the visit set changes (month nav, or after a
  // successful bulk mark-invoiced revalidates the page with fewer rows). Adjusted
  // during render (React's recommended pattern for resetting state from a prop
  // change) rather than in an effect, which would cause an extra render pass.
  const [prevVisits, setPrevVisits] = useState(visits)
  if (visits !== prevVisits) {
    setPrevVisits(visits)
    setSelectedIds(new Set(visits.map((v) => v.id)))
  }

  const groups = useMemo(() => groupVisitsByAccount(visits), [visits])

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + groupAmount(group, selectedIds), 0),
    [groups, selectedIds],
  )
  const selectedAccountCount = useMemo(
    () => groups.filter((group) => group.visits.some((v) => selectedIds.has(v.id))).length,
    [groups, selectedIds],
  )

  function toggleVisit(visitId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(visitId)) next.delete(visitId)
      else next.add(visitId)
      return next
    })
  }

  function toggleGroup(group: AccountInvoiceGroup) {
    const allSelected = group.visits.every((v) => selectedIds.has(v.id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const v of group.visits) {
        if (allSelected) next.delete(v.id)
        else next.add(v.id)
      }
      return next
    })
  }

  function handleMarkInvoiced() {
    const ids = [...selectedIds]
    startTransition(async () => {
      const res = await markVisitsInvoiced(ids)
      if (res.error) {
        toast.error('Could not mark visits invoiced', { description: res.error })
      } else {
        toast.success(`Marked ${ids.length} visit${ids.length === 1 ? '' : 's'} as invoiced`)
      }
    })
  }

  if (visits.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground rounded-xl border border-border bg-card">
        No completed visits awaiting invoice for {format(parseISO(`${month}-01`), 'MMMM yyyy')}.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-warm">
        <div>
          <p className="font-display text-lg font-semibold text-foreground tabular-nums">
            ${total.toFixed(2)} selected
          </p>
          <p className="text-xs text-muted-foreground">
            across {selectedAccountCount} {selectedAccountCount === 1 ? 'account' : 'accounts'}
          </p>
        </div>
        <Button onClick={handleMarkInvoiced} disabled={pending || selectedIds.size === 0}>
          {pending
            ? 'Marking…'
            : `Mark ${selectedIds.size} visit${selectedIds.size === 1 ? '' : 's'} as invoiced`}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Account / Property</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.flatMap((group) => {
              if (group.account.billing_type === 'contract') {
                const allSelected = group.visits.every((v) => selectedIds.has(v.id))
                return [
                  <TableRow key={group.account.id}>
                    <TableCell>
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleGroup(group)}
                        aria-label={`Select ${group.account.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{group.account.name}</span>
                        <BillingTypeBadge billingType={group.account.billing_type} />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {group.visits.length} visit{group.visits.length === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatAccountPrice(group.account)}
                    </TableCell>
                  </TableRow>,
                ]
              }

              return [
                <TableRow key={`${group.account.id}-header`} className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={4}>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm text-foreground">{group.account.name}</span>
                      <BillingTypeBadge billingType={group.account.billing_type} />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatAccountPrice(group.account)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>,
                ...group.visits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(visit.id)}
                        onCheckedChange={() => toggleVisit(visit.id)}
                        aria-label={`Select ${visit.property.address}`}
                      />
                    </TableCell>
                    <TableCell className="pl-8 text-foreground">{visit.property.address}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {visit.ended_at ? format(parseISO(visit.ended_at), 'MMM d') : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {group.account.billing_type === 'per_visit'
                        ? formatAccountPrice(group.account)
                        : '—'}
                    </TableCell>
                  </TableRow>
                )),
              ]
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
