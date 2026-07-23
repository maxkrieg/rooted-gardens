/**
 * Badge helpers for account-related status and billing-type labels.
 * Colours are defined as CSS classes in globals.css (@layer base).
 */

import { AlertTriangle, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type {
  AccountStatus,
  BillingType,
  EquipmentStatus,
  Frequency,
  InvoiceStatus,
  VehicleStatus,
  VisitStatus,
} from '@/types/app'
import type { ServiceDueState } from '@/lib/utils/fleet'
import { serviceDueState } from '@/lib/utils/fleet'
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

// ─── Invoice lifecycle status ─────────────────────────────────────────────────

// Real QBO invoice status, synced back from QuickBooks (draft → sent → paid,
// with overdue branching off sent). Reuses existing status-* classes: sent maps
// to the denim "invoiced/billed" hue, overdue to the brick destructive hue.
const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:   { label: 'Draft',   className: 'status-scheduled' },
  sent:    { label: 'Sent',    className: 'status-invoiced' },
  paid:    { label: 'Paid',    className: 'status-completed' },
  overdue: { label: 'Overdue', className: 'status-missed' },
}

// `withIcon` prepends a small receipt glyph so the badge reads as an *invoice*
// status wherever it sits next to a visit-status badge (schedule cells, the visit
// drawer, account recent-visits). The Billing → Invoices tab omits it — the
// context there is already unambiguous.
export function InvoiceStatusBadge({ status, withIcon = false }: { status: string; withIcon?: boolean }) {
  const meta = INVOICE_STATUS_META[status as InvoiceStatus] ?? {
    label: status,
    className: 'status-scheduled',
  }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {withIcon && <Receipt className="w-2.5 h-2.5 mr-1 shrink-0" aria-hidden />}
      {meta.label}
    </Badge>
  )
}

// ─── Fleet: vehicle & equipment status ───────────────────────────────────────

// Vehicles and equipment share the same status vocabulary. Reuses the existing
// status-* colour classes (like InvoiceStatusBadge) — no new CSS: available =
// green, in_use = denim, maintenance = amber, retired = neutral gray.
const FLEET_STATUS_META: Record<VehicleStatus, { label: string; className: string }> = {
  available:   { label: 'Available',   className: 'status-completed' },
  in_use:      { label: 'In Use',      className: 'status-invoiced' },
  maintenance: { label: 'Maintenance', className: 'status-skipped' },
  retired:     { label: 'Retired',     className: 'status-scheduled' },
}

export function VehicleStatusBadge({ status }: { status: string }) {
  const meta = FLEET_STATUS_META[status as VehicleStatus] ?? {
    label: status,
    className: 'status-scheduled',
  }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

export function EquipmentStatusBadge({ status }: { status: string }) {
  const meta = FLEET_STATUS_META[status as EquipmentStatus] ?? {
    label: status,
    className: 'status-scheduled',
  }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// ─── Fleet: service-due indicator ─────────────────────────────────────────────

// Derived from a maintenance log's next_service_due (see lib/utils/fleet.ts):
// overdue → brick, due-soon → amber, otherwise nothing. Pass either a raw due
// date or a pre-computed state.
const SERVICE_DUE_META: Record<ServiceDueState, { label: string; className: string }> = {
  overdue:  { label: 'Overdue',  className: 'status-missed' },
  due_soon: { label: 'Due Soon', className: 'status-skipped' },
}

export function ServiceDueBadge({ dueDate }: { dueDate: string | null | undefined }) {
  const state = serviceDueState(dueDate)
  if (!state) return null
  const meta = SERVICE_DUE_META[state]
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      <AlertTriangle className="w-2.5 h-2.5 mr-1 shrink-0" aria-hidden />
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
