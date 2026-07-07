/**
 * Badge helpers for account-related status and billing-type labels.
 * Colours are defined as CSS classes in globals.css (@layer base).
 */

import { Badge } from '@/components/ui/badge'
import type { AccountStatus, BillingType, Frequency, VisitStatus } from '@/types/app'
import type { QboConnectionStatus } from '@/lib/quickbooks/client'

// ─── Account status ──────────────────────────────────────────────────────────

const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; className: string }> = {
  active:      { label: 'Active',      className: 'acct-active' },
  inactive:    { label: 'Inactive',    className: 'acct-inactive' },
  prospective: { label: 'Prospective', className: 'acct-prospective' },
}

export function AccountStatusBadge({ status }: { status: string }) {
  const meta = ACCOUNT_STATUS_META[status as AccountStatus] ?? {
    label: status,
    className: 'acct-inactive',
  }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// ─── Billing type ─────────────────────────────────────────────────────────────

const BILLING_TYPE_META: Record<BillingType, { label: string; className: string }> = {
  per_visit: { label: 'Per Visit', className: 'billing-per_visit' },
  contract:  { label: 'Contract',  className: 'billing-contract' },
  as_needed: { label: 'As Needed', className: 'billing-as_needed' },
}

export function BillingTypeBadge({ billingType }: { billingType: string }) {
  const meta = BILLING_TYPE_META[billingType as BillingType] ?? {
    label: billingType,
    className: 'billing-as_needed',
  }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// ─── Frequency ────────────────────────────────────────────────────────────────

const FREQUENCY_META: Record<Frequency, { label: string; className: string }> = {
  weekly:    { label: 'Weekly',    className: 'freq-weekly' },
  biweekly:  { label: 'Bi-weekly', className: 'freq-biweekly' },
  monthly:   { label: 'Monthly',   className: 'freq-monthly' },
  as_needed: { label: 'As Needed', className: 'freq-as_needed' },
}

export function FrequencyBadge({ frequency }: { frequency: string }) {
  const meta = FREQUENCY_META[frequency as Frequency] ?? {
    label: frequency,
    className: 'freq-as_needed',
  }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// ─── Visit status ─────────────────────────────────────────────────────────────

const VISIT_STATUS_META: Record<VisitStatus, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'status-scheduled' },
  completed: { label: 'Completed', className: 'status-completed' },
  skipped:   { label: 'Skipped',   className: 'status-skipped' },
}

export function VisitStatusBadge({ status, missed = false }: { status: string; missed?: boolean }) {
  const meta =
    status === 'scheduled' && missed
      ? { label: 'Missed', className: 'status-missed' }
      : VISIT_STATUS_META[status as VisitStatus] ?? { label: status, className: 'status-scheduled' }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// ─── QuickBooks connection status ─────────────────────────────────────────────

const QBO_STATUS_META: Record<QboConnectionStatus, { label: string; className: string }> = {
  connected:    { label: 'Connected',     className: 'status-completed' },
  disconnected: { label: 'Disconnected',  className: 'status-scheduled' },
  expired:      { label: 'Token Expired', className: 'status-skipped' },
}

export function QboStatusBadge({ status }: { status: QboConnectionStatus }) {
  const meta = QBO_STATUS_META[status]
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}
