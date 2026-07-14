'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { BillingTypeBadge } from '@/components/management/badges'
import { createContractInvoice, type ContractAccountOverview } from '@/app/management/billing/actions'
import { createContractInvoiceSchema, type CreateContractInvoiceValues } from '@/lib/validators/contractInvoice'
import { formatAccountPrice } from '@/lib/utils/accounts'
import type { Account } from '@/types/app'

interface ContractInvoicingProps {
  accounts: ContractAccountOverview[]
  qboConnected: boolean
}

/**
 * Ad-hoc contract invoicing (docs/INVOICING.md) — lists every active contract
 * account regardless of visit activity, since contract billing is a flat rate
 * per period, not visit-driven. "Create Invoice" opens a small dialog for the
 * period, and works even when zero visits happened in it.
 */
export function ContractInvoicing({ accounts, qboConnected }: ContractInvoicingProps) {
  const [dialogAccountId, setDialogAccountId] = useState<string | null>(null)
  const dialogEntry = accounts.find((a) => a.account.id === dialogAccountId) ?? null

  if (accounts.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground rounded-xl border border-border bg-card">
        No active contract accounts.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {accounts.map(({ account, lastInvoice }) => (
        <div
          key={account.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-warm"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold text-foreground truncate">
                {account.name}
              </span>
              <BillingTypeBadge billingType={account.billing_type} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {formatAccountPrice(account)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {lastInvoice
                ? `Last: ${lastInvoice.period_label} · $${Number(lastInvoice.amount).toFixed(2)} · ${format(parseISO(lastInvoice.invoiced_at), 'MMM d')}`
                : 'Never invoiced'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Button onClick={() => setDialogAccountId(account.id)} disabled={!qboConnected}>
              Create Invoice
            </Button>
            {!qboConnected && (
              <p className="text-xs text-muted-foreground">Connect QuickBooks above first</p>
            )}
          </div>
        </div>
      ))}

      {dialogEntry && (
        <ContractInvoiceDialog account={dialogEntry.account} onClose={() => setDialogAccountId(null)} />
      )}
    </div>
  )
}

function ContractInvoiceDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const router = useRouter()
  const now = new Date()
  const isMonthly = account.contract_period === 'monthly'

  const form = useForm<CreateContractInvoiceValues>({
    resolver: zodResolver(createContractInvoiceSchema),
    defaultValues: isMonthly
      ? {
          periodLabel: format(now, 'MMMM yyyy'),
          periodStart: format(startOfMonth(now), 'yyyy-MM-dd'),
          periodEnd: format(endOfMonth(now), 'yyyy-MM-dd'),
          amount: account.contract_rate ?? undefined,
        }
      : {
          periodLabel: '',
          periodStart: '',
          periodEnd: '',
          amount: account.contract_rate ?? undefined,
        },
  })

  async function onSubmit(values: CreateContractInvoiceValues) {
    const result = await createContractInvoice({ accountId: account.id, ...values })
    if (result.success) {
      toast.success(`${account.name}: invoice pushed`, {
        description: `QuickBooks invoice ${result.qboInvoiceId}`,
      })
      onClose()
      router.refresh()
    } else {
      toast.error(`${account.name}: push failed`, { description: result.error })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create invoice — {account.name}</DialogTitle>
          <DialogDescription>
            Standing rate is {formatAccountPrice(account)}. Bills the amount below for the
            period, regardless of how many visits happened during it — override it if this
            invoice should be for a different amount.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="periodLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period label</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. July 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating…' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
