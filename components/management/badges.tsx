/**
 * Badge helpers for account-related status and billing-type labels.
 * Colours are defined as CSS classes in globals.css (@layer base).
 */

import { AlertTriangle, CheckCircle2, Circle, MinusCircle, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type {
  Account,
  AccountStatus,
  BillingType,
  EmployeeRole,
  EquipmentStatus,
  Frequency,
  InvoiceStatus,
  LeadKind,
  LeadStatus,
  VehicleStatus,
  VisitStatus,
} from '@/types/app'
import { LEAD_KIND_LABELS, LEAD_STATUS_LABELS } from '@/types/app'
import type { ServiceDueState } from '@/lib/utils/fleet'
import { serviceDueState } from '@/lib/utils/fleet'
import type { QboConnectionStatus } from '@/lib/quickbooks/client'
import { formatAccountPrice } from '@/lib/utils/accounts'

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
}

export function BillingTypeBadge({ billingType }: { billingType: string }) {
  // billingType is the raw DB string, and the CHECK constraint still permits the
  // retired 'as_needed' value, so an unrecognised type renders neutrally rather
  // than blank. `.billing-unknown` is the muted stone treatment that value used.
  const meta = BILLING_TYPE_META[billingType as BillingType] ?? {
    label: billingType,
    className: 'billing-unknown',
  }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// ─── Frequency ────────────────────────────────────────────────────────────────

// One neutral pill for every cadence — the colour used to differ per frequency,
// but weekly's green was indistinguishable from a COMPLETED badge on the same
// schedule row. Colour is reserved for visit status; this is a label.
const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly:    'Weekly',
  biweekly:  'Bi-weekly',
  monthly:   'Monthly',
  as_needed: 'As Needed',
}

export function FrequencyBadge({ frequency }: { frequency: string }) {
  const label = FREQUENCY_LABELS[frequency as Frequency] ?? frequency
  return (
    <Badge variant="outline" className="border-transparent uppercase tracking-wide text-[10px] font-semibold freq-badge">
      {label}
    </Badge>
  )
}

// ─── Account price / billing-type meta ────────────────────────────────────────

// Price text already names the billing type ("$125.00 / visit", "$800.00 /
// monthly"), so the billing badge would be redundant whenever there's a flat
// price to show. It only earns its place as a fallback for an account with no
// price set at all — a per_visit account missing its rate, or a legacy row
// still carrying the retired 'as_needed' type. Shared by the schedule grid and
// the mobile list so their fallback rules can't drift apart.
export function AccountPriceMeta({ account }: { account: Account }) {
  const price = formatAccountPrice(account)
  if (price !== '—') {
    return <span className="text-[11px] tabular-nums text-muted-foreground">{price}</span>
  }
  return <BillingTypeBadge billingType={account.billing_type} />
}

// ─── Visit status ─────────────────────────────────────────────────────────────

const VISIT_STATUS_META: Record<VisitStatus, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'status-scheduled' },
  completed: { label: 'Completed', className: 'status-completed' },
  skipped:   { label: 'Skipped',   className: 'status-skipped' },
}

export function VisitStatusBadge({ status }: { status: string }) {
  const meta = VISIT_STATUS_META[status as VisitStatus] ?? { label: status, className: 'status-scheduled' }
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// The phone schedule says status with a glyph and a row-wide tint instead of a
// badge — five pills on one row left no width for the account name. The word
// still reaches screen readers via the sr-only label.
//
// Only the settled states get a mark. 'Scheduled' deliberately draws nothing:
// an outlined ring reads as an empty checkbox, and the whole point of the
// treatment is that outstanding work is the row with no decoration on it.
const VISIT_STATUS_ICON: Partial<Record<VisitStatus, { Icon: typeof Circle; className: string }>> = {
  completed: { Icon: CheckCircle2, className: 'icon-completed' },
  skipped:   { Icon: MinusCircle,  className: 'icon-skipped' },
}

export function VisitStatusIcon({ status, inProgress }: { status: string; inProgress?: boolean }) {
  const label = VISIT_STATUS_META[status as VisitStatus]?.label ?? status

  // On site wins over the underlying 'scheduled' — it's the live state, and it
  // gets the clay pulse the design system reserves for it.
  if (inProgress) {
    return (
      <>
        <Circle className="h-2 w-2 shrink-0 animate-pulse fill-current text-[var(--clay)]" aria-hidden />
        <span className="sr-only">On site</span>
      </>
    )
  }

  const meta = VISIT_STATUS_ICON[status as VisitStatus]
  if (!meta) return <span className="sr-only">{label}</span>
  return (
    <>
      <meta.Icon className={`h-[18px] w-[18px] shrink-0 ${meta.className}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </>
  )
}

/** Row-wide background for a settled visit; '' for anything still outstanding. */
export function visitRowTint(status: string | null | undefined): string {
  if (status === 'completed') return 'row-completed'
  if (status === 'skipped') return 'row-skipped'
  return ''
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
/** The badge's label alone, for surfaces too tight for a pill (the phone
 *  schedule row renders it as plain denim text beside a receipt glyph). */
export function invoiceStatusLabel(status: string): string {
  return INVOICE_STATUS_META[status as InvoiceStatus]?.label ?? status
}

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

// ─── Employee role ────────────────────────────────────────────────────────────

// Reuses existing status-* colour classes (no new CSS): owner = green, lead =
// denim, crew = neutral gray, accountant = amber.
const EMPLOYEE_ROLE_META: Record<EmployeeRole, { label: string; className: string }> = {
  owner:      { label: 'Owner',      className: 'status-completed' },
  lead:       { label: 'Lead',       className: 'status-invoiced' },
  crew:       { label: 'Crew',       className: 'status-scheduled' },
  accountant: { label: 'Accountant', className: 'status-skipped' },
}

export function EmployeeRoleBadge({ role }: { role: string }) {
  const meta = EMPLOYEE_ROLE_META[role as EmployeeRole] ?? {
    label: role,
    className: 'status-scheduled',
  }
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

// ─── Lead kind & status (task 9.8) ────────────────────────────────────────────

// Reuses existing status-* colour classes (no new CSS): an inquiry reads as
// "good news" (leaf green), a job application as neutral (stone).
const LEAD_KIND_META: Record<LeadKind, { className: string }> = {
  service_inquiry: { className: 'status-completed' },
  job_application: { className: 'status-scheduled' },
}

export function LeadKindBadge({ kind }: { kind: string }) {
  const meta = LEAD_KIND_META[kind as LeadKind] ?? { className: 'status-scheduled' }
  const label = LEAD_KIND_LABELS[kind as LeadKind] ?? kind
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {label}
    </Badge>
  )
}

// Pipeline: new (needs attention) -> contacted -> qualified -> won/lost.
// `new` deliberately reuses the denim "invoiced" hue rather than stone/gray —
// it's the one status that means "nobody has looked at this yet," and denim
// doesn't collide with any visit-status meaning the way green/amber/brick do.
const LEAD_STATUS_META: Record<LeadStatus, { className: string }> = {
  new:       { className: 'status-invoiced' },
  contacted: { className: 'status-scheduled' },
  qualified: { className: 'status-skipped' },
  won:       { className: 'status-completed' },
  lost:      { className: 'status-missed' },
}

export function LeadStatusBadge({ status }: { status: string }) {
  const meta = LEAD_STATUS_META[status as LeadStatus] ?? { className: 'status-scheduled' }
  const label = LEAD_STATUS_LABELS[status as LeadStatus] ?? status
  return (
    <Badge variant="outline" className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${meta.className}`}>
      {label}
    </Badge>
  )
}
