'use client'

import { useMemo, useState, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { pushInvoicesToQuickBooks } from '@/app/management/billing/actions'
import { formatAccountPrice } from '@/lib/utils/accounts'
import { cn } from '@/lib/utils'
import type { Account, VisitWithLocation } from '@/types/app'

interface AccountInvoiceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account
  visits: VisitWithLocation[]
  qboConnected: boolean
}

/**
 * The selective-invoicing drawer — opened from an account row in the queue. Lists
 * that account's uninvoiced visits (same card as the account detail's Recent
 * visits) with a checkbox each and a select-all, and creates a single QBO invoice
 * from just the hand-picked visits. Any visits left unchecked stay uninvoiced, so
 * the account keeps its queue row after the page revalidates.
 */
export function AccountInvoiceDrawer({
  open,
  onOpenChange,
  account,
  visits,
  qboConnected,
}: AccountInvoiceDrawerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pending, startTransition] = useTransition()

  // Reset the picked set whenever the drawer is pointed at a different account or
  // the underlying visits change (render-phase reset, not an effect).
  const resetKey = `${account.id}:${visits.length}`
  const [prevKey, setPrevKey] = useState(resetKey)
  if (resetKey !== prevKey) {
    setPrevKey(resetKey)
    setSelectedIds(new Set())
  }

  const pricePerVisit = account.price_per_visit != null ? Number(account.price_per_visit) : 0
  const selectedTotal = selectedIds.size * pricePerVisit
  const allSelected = visits.length > 0 && visits.every((v) => selectedIds.has(v.id))

  const sortedVisits = useMemo(
    () =>
      [...visits].sort((a, b) =>
        parseISO(a.ended_at ?? a.week_start).getTime() -
        parseISO(b.ended_at ?? b.week_start).getTime(),
      ),
    [visits],
  )

  function toggleVisit(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) => (visits.every((v) => prev.has(v.id)) ? new Set() : new Set(visits.map((v) => v.id))))
  }

  function handleCreate() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    startTransition(async () => {
      const results = await pushInvoicesToQuickBooks(ids)
      const result = results[0]
      if (result?.success) {
        toast.success(`${account.name}: invoice pushed`, {
          description: `QuickBooks invoice ${result.qboInvoiceId}`,
        })
        onOpenChange(false)
      } else {
        toast.error(`${account.name}: push failed`, {
          description: result?.error ?? 'Could not create invoice',
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5 text-left">
          <SheetTitle className="font-display">{account.name}</SheetTitle>
          <SheetDescription>
            {formatAccountPrice(account)} · {visits.length} uninvoiced visit
            {visits.length === 1 ? '' : 's'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all visits"
            />
            Select all
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {selectedIds.size} selected · ${selectedTotal.toFixed(2)}
          </span>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {sortedVisits.map((visit) => {
            const selected = selectedIds.has(visit.id)
            return (
              <button
                key={visit.id}
                type="button"
                onClick={() => toggleVisit(visit.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  selected
                    ? 'border-primary bg-accent/30'
                    : 'border-border bg-card hover:bg-accent/20',
                )}
              >
                <Checkbox checked={selected} tabIndex={-1} aria-hidden className="mt-0.5 pointer-events-none" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {visit.property?.address ?? 'Unknown property'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {visit.ended_at
                      ? format(parseISO(visit.ended_at), 'EEE MMM d, yyyy')
                      : `Week of ${format(parseISO(visit.week_start), 'EEE MMM d')}`}
                  </p>
                  {visit.service_types && visit.service_types.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {visit.service_types.map((type) => (
                        <Badge
                          key={type}
                          variant="outline"
                          className="h-4 border-border px-1.5 text-[10px] font-normal text-muted-foreground"
                        >
                          {type.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  ${pricePerVisit.toFixed(2)}
                </span>
              </button>
            )
          })}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={pending || selectedIds.size === 0 || !qboConnected}
          >
            {pending ? 'Creating…' : `Create invoice · $${selectedTotal.toFixed(2)}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
