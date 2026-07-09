import { cookies } from 'next/headers'
import { format } from 'date-fns'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import { getQboConnectionStatus } from '@/lib/quickbooks/client'
import { BillingMonthNav } from '@/components/management/BillingMonthNav'
import { QuickBooksConnect } from '@/components/management/QuickBooksConnect'
import { InvoiceQueue } from '@/components/management/InvoiceQueue'
import { getUninvoicedVisits } from './actions'

interface Props {
  searchParams: Promise<{ month?: string; qbo?: string; reason?: string }>
}

/**
 * Billing invoice queue — accountant-facing, laptop-first (per CLAUDE.md, the
 * one management area that stays table/grid-dense rather than mobile-first).
 */
export default async function BillingPage({ searchParams }: Props) {
  const { month, qbo, reason } = await searchParams
  const resolvedMonth = month ?? format(new Date(), 'yyyy-MM')

  const cookieStore = await cookies()
  const role = parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'accountant'

  const [visits, qboStatus] = await Promise.all([
    getUninvoicedVisits(resolvedMonth),
    getQboConnectionStatus(),
  ])

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-foreground">Billing</h1>
        <div className="flex items-center gap-4">
          <QuickBooksConnect
            status={qboStatus}
            canManage={role === 'owner'}
            feedback={qbo ? { qbo, reason } : undefined}
          />
          <BillingMonthNav month={resolvedMonth} />
        </div>
      </div>

      <InvoiceQueue visits={visits} month={resolvedMonth} qboConnected={qboStatus !== 'disconnected'} />
    </div>
  )
}
