/** Status and label badges. Colours live as classes in globals.css. */

import { AlertTriangle, CheckCircle2, Circle, MinusCircle, Receipt } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { cadenceFor, type Cadence, type CadenceProperty, type CadenceState } from '@/lib/utils/cadence'
import type {
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
  // Unknown types (e.g. legacy 'as_needed') render neutrally, not blank.
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

// ─── Cadence (frequency + how long this property has waited) ──────────────────

// One neutral pill for every cadence. Colour means only one thing: running late.
const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly:    'Weekly',
  biweekly:  'Bi-weekly',
  monthly:   'Monthly',
  as_needed: 'As Needed',
}

const CADENCE_STATE_CLASS: Record<CadenceState, string> = {
  ok:   'freq-badge',
  due:  'cadence-due',
  over: 'cadence-over',
}

/**
 * Cadence pill with optional days-since-last-visit, e.g. "WEEKLY · 12d". The dot on due/over
 * separates it from status pills with the same fills.
 */
export function CadenceBadge({
  property,
  lastVisitOn,
  showDays = false,
}: {
  property: CadenceProperty
  lastVisitOn?: string | null
  showDays?: boolean
}) {
  const label = FREQUENCY_LABELS[property.frequency as Frequency] ?? property.frequency
  const cadence = cadenceFor(property, lastVisitOn)

  // Nothing to count against: render exactly the old neutral frequency label.
  if (!showDays || cadence.intervalDays === null) {
    return (
      <Badge variant="outline" className="border-transparent uppercase tracking-wide text-[10px] font-semibold freq-badge">
        {label}
      </Badge>
    )
  }

  const marked = cadence.state !== 'ok'

  return (
    <Badge
      variant="outline"
      className={`border-transparent uppercase tracking-wide text-[10px] font-semibold ${CADENCE_STATE_CLASS[cadence.state]} ${marked ? 'gap-1' : ''}`}
    >
      {marked && <Circle className="h-1.5 w-1.5 shrink-0 fill-current" aria-hidden />}
      {/* No completed visit yet: an em dash, never red. Screen readers get the sentence. */}
      <span aria-hidden>
        {label} · {cadence.daysSince === null ? '—' : `${cadence.daysSince}d`}
      </span>
      <span className="sr-only">{describeCadence(label, cadence)}</span>
    </Badge>
  )
}

function describeCadence(label: string, cadence: Cadence): string {
  const every = `${label}, every ${cadence.intervalDays} days`
  if (cadence.daysSince === null) return `${every}. No visits logged yet.`

  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
  const since = `${days(cadence.daysSince)} since last visit`
  if (cadence.state === 'over') return `${every}. ${since} — ${days(cadence.overdueBy)} overdue. High priority.`
  if (cadence.state === 'due') return `${every}. ${since} — coming due.`
  return `${every}. ${since}.`
}

/** CadenceBadge spelled out, for surfaces with room for a sentence. */
export function CadenceSummary({
  property,
  lastVisitOn,
  className,
}: {
  property: CadenceProperty
  lastVisitOn?: string | null
  className?: string
}) {
  const cadence = cadenceFor(property, lastVisitOn)
  const every = cadence.intervalDays === null ? 'Scheduled by hand' : `Every ${cadence.intervalDays} days`

  return (
    <p className={`text-sm text-muted-foreground ${className ?? ''}`}>
      {every}
      {' · '}
      {lastVisitOn ? (
        <>
          last visit {format(parseISO(lastVisitOn), 'EEE MMM d')}
          {cadence.daysSince !== null && (
            <span className={cadence.state === 'over' ? 'font-medium text-[var(--clay)]' : undefined}>
              {' '}
              ({cadence.daysSince} {cadence.daysSince === 1 ? 'day' : 'days'} ago
              {cadence.state === 'over' ? `, ${cadence.overdueBy} past due` : ''})
            </span>
          )}
        </>
      ) : (
        'no visits logged yet'
      )}
    </p>
  )
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

// Status as a glyph plus row tint instead of a badge. Only settled states get a mark;
// outstanding work is the undecorated row.
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

// QBO invoice status synced back from QuickBooks: sent = denim, overdue = brick.
const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:   { label: 'Draft',   className: 'status-scheduled' },
  sent:    { label: 'Sent',    className: 'status-invoiced' },
  paid:    { label: 'Paid',    className: 'status-completed' },
  overdue: { label: 'Overdue', className: 'status-missed' },
}

// `withIcon` adds a receipt glyph where it sits beside a visit-status badge.
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

// Vehicles and equipment share one status vocabulary and the status-* colours.
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

// Service due state: overdue = brick, due soon = amber, otherwise nothing.
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

// ─── Lead kind & status ───────────────────────────────────────────────────

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

// `new` uses denim: "nobody has looked at this yet", distinct from any visit status colour.
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
