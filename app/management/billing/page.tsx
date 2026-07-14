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
import { ContractInvoicing } from '@/components/management/ContractInvoicing'
import {
  getUninvoicedVisits,
  getInvoicedVisits,
  getRevenueSummary,
  getContractAccountsOverview,
  getContractInvoicesForMonth,
} from './actions'
import type { EmployeeRole } from '@/types/app'

interface Props {
  searchParams: Promise<{ month?: string; qbo?: string; reason?: string; view?: string }>
}

type BillingView = 'queue' | 'invoiced' | 'contracts'

function resolveView(view: string | undefined): BillingView {
  if (view === 'invoiced') return 'invoiced'
  if (view === 'contracts') return 'contracts'
  return 'queue'
}

/**
 * Billing invoice queue — accountant-facing, laptop-first (per CLAUDE.md, the
 * one management area that stays table/grid-dense rather than mobile-first).
 */
export default async function BillingPage({ searchParams }: Props) {
  const { month, qbo, reason, view } = await searchParams
  const resolvedMonth = month ?? format(new Date(), 'yyyy-MM')
  const resolvedView = resolveView(view)

  const cookieStore = await cookies()
  const role = parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'accountant'

  const qboStatus = await getQboConnectionStatus()

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
        <Link
          href="/management/billing?view=contracts"
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            resolvedView === 'contracts'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Contracts
        </Link>
      </div>

      {resolvedView === 'invoiced' ? (
        <InvoicedTab month={resolvedMonth} role={role as EmployeeRole} />
      ) : resolvedView === 'contracts' ? (
        <ContractsTab qboConnected={qboStatus !== 'disconnected'} />
      ) : (
        <QueueTab qboConnected={qboStatus !== 'disconnected'} />
      )}
    </div>
  )
}

async function QueueTab({ qboConnected }: { qboConnected: boolean }) {
  const visits = await getUninvoicedVisits()
  return <InvoiceQueue visits={visits} qboConnected={qboConnected} />
}

async function InvoicedTab({ month, role }: { month: string; role: EmployeeRole }) {
  const [visits, revenue, contractInvoices] = await Promise.all([
    getInvoicedVisits(month),
    getRevenueSummary(),
    getContractInvoicesForMonth(month),
  ])
  return (
    <InvoicedHistory
      visits={visits}
      contractInvoices={contractInvoices}
      month={month}
      revenue={revenue}
      role={role}
    />
  )
}

async function ContractsTab({ qboConnected }: { qboConnected: boolean }) {
  const accounts = await getContractAccountsOverview()
  return <ContractInvoicing accounts={accounts} qboConnected={qboConnected} />
}
