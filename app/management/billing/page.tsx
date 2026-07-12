import { cookies } from 'next/headers'
import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import { getQboConnectionStatus } from '@/lib/quickbooks/client'
import { BillingMonthNav } from '@/components/management/BillingMonthNav'
import { QuickBooksConnect } from '@/components/management/QuickBooksConnect'
import { InvoiceQueue } from '@/components/management/InvoiceQueue'
import { InvoicedHistory } from '@/components/management/InvoicedHistory'
import { getUninvoicedVisits, getInvoicedVisits, getRevenueSummary } from './actions'
import type { EmployeeRole } from '@/types/app'

interface Props {
  searchParams: Promise<{ month?: string; qbo?: string; reason?: string; view?: string }>
}

/**
 * Billing invoice queue — accountant-facing, laptop-first (per CLAUDE.md, the
 * one management area that stays table/grid-dense rather than mobile-first).
 */
export default async function BillingPage({ searchParams }: Props) {
  const { month, qbo, reason, view } = await searchParams
  const resolvedMonth = month ?? format(new Date(), 'yyyy-MM')
  const resolvedView = view === 'invoiced' ? 'invoiced' : 'queue'

  const cookieStore = await cookies()
  const role = parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'accountant'

  const qboStatus = await getQboConnectionStatus()
  const [visits, revenue] = resolvedView === 'invoiced'
    ? await Promise.all([getInvoicedVisits(resolvedMonth), getRevenueSummary()])
    : await Promise.all([getUninvoicedVisits(), Promise.resolve(null)])

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
          {resolvedView === 'invoiced' && <BillingMonthNav month={resolvedMonth} view={resolvedView} />}
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border">
        <Link
          href="/management/billing?view=queue"
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            resolvedView === 'queue'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Queue
        </Link>
        <Link
          href={`/management/billing?view=invoiced&month=${resolvedMonth}`}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            resolvedView === 'invoiced'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Invoiced
        </Link>
      </div>

      {resolvedView === 'invoiced' && revenue ? (
        <InvoicedHistory visits={visits} month={resolvedMonth} revenue={revenue} role={role as EmployeeRole} />
      ) : (
        <InvoiceQueue visits={visits} qboConnected={qboStatus !== 'disconnected'} />
      )}
    </div>
  )
}
