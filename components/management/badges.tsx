/**
 * Badge helpers for account-related status and billing-type labels.
 * Colours are defined as CSS classes in globals.css (@layer base).
 */

import { Badge } from '@/components/ui/badge'
import type { AccountStatus, BillingType } from '@/types/app'

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
