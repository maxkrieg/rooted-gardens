import { Suspense } from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TableSkeleton } from '@/components/states/skeletons'
import { ErrorState } from '@/components/states/ErrorState'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import { getQboConnectionStatus } from '@/lib/quickbooks/client'
import { QuickBooksConnect } from '@/components/management/QuickBooksConnect'
import { InvoiceQueue } from '@/components/management/InvoiceQueue'
import { InvoicedHistory } from '@/components/management/InvoicedHistory'
import { ContractInvoicing } from '@/components/management/ContractInvoicing'
import { resolveDateRange, type ResolvedDateRange } from '@/lib/utils/billing'
import {
  getUninvoicedVisits,
  getInvoicesForRange,
  getRevenueSummary,
  getContractAccountsOverview,
} from './actions'
import type { EmployeeRole } from '@/types/app'

interface Props {
  searchParams: Promise<{
    range?: string
    start?: string
    end?: string
    qbo?: string
    reason?: string
    view?: string
  }>
}

type BillingView = 'queue' | 'invoices' | 'contracts'

function resolveView(view: string | undefined): BillingView {
  if (view === 'invoices') return 'invoices'
  if (view === 'contracts') return 'contracts'
  return 'queue'
}

/**
 * Billing invoice queue — accountant-facing, laptop-first (per CLAUDE.md, the
 * one management area that stays table/grid-dense rather than mobile-first).
 */
export default async function BillingPage({ searchParams }: Props) {
  const { range, start, end, qbo, reason, view } = await searchParams
  const resolvedView = resolveView(view)
  const resolvedRange = resolveDateRange({ range, start, end })

  const cookieStore = await cookies()
  const role = parseRoleCookie(cookieStore.get('rg-role')?.value)?.role ?? 'accountant'

  const qboStatus = await getQboConnectionStatus()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-foreground">Billing</h1>
        <div className="flex items-center gap-4">
          <QuickBooksConnect
            status={qboStatus}
            canManage={role === 'owner'}
            feedback={qbo ? { qbo, reason } : undefined}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border">
        <Link
          href="/management/billing?view=queue"
          className={cn(
            'inline-flex items-center min-h-11 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            resolvedView === 'queue'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Queue
        </Link>
        <Link
          href="/management/billing?view=invoices"
          className={cn(
            'inline-flex items-center min-h-11 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            resolvedView === 'invoices'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Invoices
        </Link>
        <Link
          href="/management/billing?view=contracts"
          className={cn(
            'inline-flex items-center min-h-11 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            resolvedView === 'contracts'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Contracts
        </Link>
      </div>

      {/* Stream each tab rather than blocking the header behind it. The key
          resets the boundary so a switch shows the skeleton, not the old table. */}
      <Suspense key={resolvedView} fallback={<TableSkeleton rows={8} />}>
        {resolvedView === 'invoices' ? (
          <InvoicedTab range={resolvedRange} role={role as EmployeeRole} />
        ) : resolvedView === 'contracts' ? (
          <ContractsTab qboConnected={qboStatus !== 'disconnected'} />
        ) : (
          <QueueTab qboConnected={qboStatus !== 'disconnected'} />
        )}
      </Suspense>
    </div>
  )
}

async function QueueTab({ qboConnected }: { qboConnected: boolean }) {
  const { data: visits, loadError } = await getUninvoicedVisits()
  // "Nothing to bill" and "we don't know what's unbilled" are opposite things to
  // an accountant. Never let the failure read as the former.
  if (loadError) {
    return (
      <ErrorState
        title="The invoice queue didn't load."
        hint="Don't invoice from this list until it loads — it may be incomplete."
      />
    )
  }
  return <InvoiceQueue visits={visits} qboConnected={qboConnected} />
}

async function InvoicedTab({ range, role }: { range: ResolvedDateRange; role: EmployeeRole }) {
  const [invoices, revenue] = await Promise.all([
    getInvoicesForRange(range),
    getRevenueSummary(),
  ])
  if (invoices.loadError) {
    return (
      <ErrorState
        title="Invoice history didn't load."
        hint="Check your connection, then try again."
      />
    )
  }
  return (
    <InvoicedHistory
      invoices={invoices.data}
      rangeLabel={range.label}
      rangePreset={range.preset}
      customStart={range.customStart}
      customEnd={range.customEnd}
      revenue={revenue}
      role={role}
    />
  )
}

async function ContractsTab({ qboConnected }: { qboConnected: boolean }) {
  const { data: accounts, loadError } = await getContractAccountsOverview()
  if (loadError) {
    return (
      <ErrorState
        title="Contract accounts didn't load."
        hint="Check your connection, then try again."
      />
    )
  }
  return <ContractInvoicing accounts={accounts} qboConnected={qboConnected} />
}
