import { format } from 'date-fns'
import { BillingMonthNav } from '@/components/management/BillingMonthNav'
import { InvoiceQueue } from '@/components/management/InvoiceQueue'
import { getUninvoicedVisits } from './actions'

interface Props {
  searchParams: Promise<{ month?: string }>
}

/**
 * Billing invoice queue — accountant-facing, laptop-first (per CLAUDE.md, the
 * one management area that stays table/grid-dense rather than mobile-first).
 */
export default async function BillingPage({ searchParams }: Props) {
  const { month } = await searchParams
  const resolvedMonth = month ?? format(new Date(), 'yyyy-MM')
  const visits = await getUninvoicedVisits(resolvedMonth)

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-foreground">Billing</h1>
        <BillingMonthNav month={resolvedMonth} />
      </div>

      <InvoiceQueue visits={visits} month={resolvedMonth} />
    </div>
  )
}
