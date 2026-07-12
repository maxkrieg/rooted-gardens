'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown } from 'lucide-react'
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
import { pushInvoicesToQuickBooks } from '@/app/management/billing/actions'
import { groupVisitsByAccountMonth, type AccountMonthGroup } from '@/lib/utils/billing'
import { formatAccountPrice } from '@/lib/utils/accounts'
import type { VisitWithLocation } from '@/types/app'

interface InvoiceQueueProps {
  visits: VisitWithLocation[]
  qboConnected: boolean
}

function groupAmount(group: AccountMonthGroup, selectedIds: Set<string>): number {
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
 * The billing invoice queue — every completed, not-yet-invoiced visit
 * regardless of month, grouped by (account, completion month) so nothing in
 * an old month goes unnoticed, and so a push always maps to exactly one QBO
 * invoice per group (the owner invoices monthly — combining two months into
 * one push would under-bill a contract account). per_visit accounts get one
 * row per visit; contract accounts collapse to a single summary row (flat
 * periodic rate regardless of visit count). A divider row marks each new
 * month, oldest first.
 */
export function InvoiceQueue({ visits, qboConnected }: InvoiceQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() => new Set())
  const [pending, startTransition] = useTransition()

  // Reset selection whenever the visit set changes (e.g. after a push
  // revalidates the page with fewer rows) — nothing is pre-selected, so a
  // stale id from a now-invoiced visit never lingers in the set. Adjusted
  // during render (React's recommended pattern for resetting state from a
  // prop change) rather than in an effect, which would cause an extra render pass.
  const [prevVisits, setPrevVisits] = useState(visits)
  if (visits !== prevVisits) {
    setPrevVisits(visits)
    setSelectedIds(new Set())
  }

  const groups = useMemo(() => groupVisitsByAccountMonth(visits), [visits])

  // All visit ids for a given month, across every account in that month —
  // backs the month divider's "select all" checkbox.
  const visitIdsByMonth = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const group of groups) {
      const ids = map.get(group.monthKey) ?? []
      ids.push(...group.visits.map((v) => v.id))
      map.set(group.monthKey, ids)
    }
    return map
  }, [groups])

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + groupAmount(group, selectedIds), 0),
    [groups, selectedIds],
  )
  // Each group is exactly one future QBO invoice (one per account per month).
  const selectedInvoiceCount = useMemo(
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

  function toggleGroup(group: AccountMonthGroup) {
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

  function toggleMonth(monthKey: string) {
    const ids = visitIdsByMonth.get(monthKey) ?? []
    const allSelected = ids.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  function toggleMonthExpanded(monthKey: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }

  function handlePush() {
    const ids = [...selectedIds]
    startTransition(async () => {
      const results = await pushInvoicesToQuickBooks(ids)
      for (const r of results) {
        const label = r.monthLabel ? `${r.accountName} — ${r.monthLabel}` : r.accountName
        if (r.success) {
          toast.success(`${label}: invoice pushed`, {
            description: `QuickBooks invoice ${r.qboInvoiceId}`,
          })
        } else {
          toast.error(`${label}: push failed`, { description: r.error })
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
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-warm">
        <div>
          <p className="font-display text-lg font-semibold text-foreground tabular-nums">
            ${total.toFixed(2)} selected
          </p>
          <p className="text-xs text-muted-foreground">
            across {selectedInvoiceCount} {selectedInvoiceCount === 1 ? 'invoice' : 'invoices'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handlePush} disabled={pending || selectedIds.size === 0 || !qboConnected}>
            {pending
              ? 'Pushing…'
              : `Push ${selectedIds.size} visit${selectedIds.size === 1 ? '' : 's'} to QuickBooks`}
          </Button>
          {!qboConnected && (
            <p className="text-xs text-muted-foreground">Connect QuickBooks above first</p>
          )}
        </div>
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
            {groups.flatMap((group, index) => {
              const rows: ReactNode[] = []
              const prevGroup = groups[index - 1]
              const isExpanded = !collapsedMonths.has(group.monthKey)

              if (!prevGroup || prevGroup.monthKey !== group.monthKey) {
                const monthIds = visitIdsByMonth.get(group.monthKey) ?? []
                const monthAllSelected = monthIds.length > 0 && monthIds.every((id) => selectedIds.has(id))
                rows.push(
                  <TableRow
                    key={`month-${group.monthKey}`}
                    onClick={() => toggleMonthExpanded(group.monthKey)}
                    className="cursor-pointer hover:bg-secondary border-t-4 border-border"
                  >
                    <TableCell className="bg-secondary py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={monthAllSelected}
                        onCheckedChange={() => toggleMonth(group.monthKey)}
                        aria-label={`Select all visits in ${group.monthLabel}`}
                      />
                    </TableCell>
                    <TableCell colSpan={3} className="bg-secondary py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-semibold text-foreground uppercase tracking-wide">
                          {group.monthLabel}
                          <span className="ml-2 font-sans text-sm font-normal normal-case tracking-normal text-muted-foreground">
                            ({monthIds.length} visit{monthIds.length === 1 ? '' : 's'})
                          </span>
                        </span>
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>,
                )
              }

              if (!isExpanded) return rows

              if (group.account.billing_type === 'contract') {
                const allSelected = group.visits.every((v) => selectedIds.has(v.id))
                rows.push(
                  <TableRow key={`${group.account.id}-${group.monthKey}`}>
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
                )
                return rows
              }

              rows.push(
                <TableRow key={`${group.account.id}-${group.monthKey}-header`} className="bg-muted/30 hover:bg-muted/30">
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
              )
              for (const visit of group.visits) {
                rows.push(
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
                  </TableRow>,
                )
              }
              return rows
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
