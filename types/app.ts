import type { Tables } from './database'

// Base row types aliased for convenience
export type Account = Tables<'accounts'>
export type Property = Tables<'properties'>
export type RouteGroup = Tables<'route_groups'>
export type PropertyRouteGroup = Tables<'property_route_groups'>
export type Employee = Tables<'employees'>
export type Vehicle = Tables<'vehicles'>
export type Equipment = Tables<'equipment'>
export type Visit = Tables<'visits'>
export type VisitCrew = Tables<'visit_crew'>
export type Photo = Tables<'photos'>
export type Integration = Tables<'integrations'>
export type Invoice = Tables<'invoices'>
export type MaintenanceLog = Tables<'maintenance_logs'>
export type Lead = Tables<'leads'>
export type SiteContentRow = Tables<'site_content'>
export type SiteCollectionItemRow = Tables<'site_collection_items'>

// A property enriched with its account name and current route group — used by
// the routes management page and its Assign Properties sheet.
export interface PropertyWithAccount extends Property {
  accountName: string
  /** The route group this property currently belongs to, if any — null means
   *  unassigned everywhere. At most one, enforced by
   *  property_route_groups_property_idx. */
  currentRouteGroup: { id: string; name: string } | null
}

// ─── Domain constants ─────────────────────────────────────────────────────────

export const BILLING_TYPES = ['per_visit', 'contract', 'as_needed'] as const
export type BillingType = (typeof BILLING_TYPES)[number]

export const ACCOUNT_STATUSES = ['active', 'inactive', 'prospective'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const CONTRACT_PERIODS = ['monthly', 'seasonal'] as const
export type ContractPeriod = (typeof CONTRACT_PERIODS)[number]

export const EMPLOYEE_ROLES = ['owner', 'lead', 'crew', 'accountant'] as const
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number]

export const SERVICE_SIDES = ['lawn', 'garden', 'both'] as const
export type ServiceSide = (typeof SERVICE_SIDES)[number]

export const PROPERTY_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'as_needed'] as const
export type Frequency = (typeof PROPERTY_FREQUENCIES)[number]

export const VISIT_STATUSES = ['scheduled', 'completed', 'skipped'] as const
export type VisitStatus = (typeof VISIT_STATUSES)[number]

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const SERVICE_TYPES = [
  'mow',
  'double_cut',
  'trim',
  'edge',
  'leaf_mulch',
  'cleanup',
  'other',
] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  mow: 'Mow',
  double_cut: 'Double Cut',
  trim: 'Trim',
  edge: 'Edge',
  leaf_mulch: 'Leaf Mulch',
  cleanup: 'Cleanup',
  other: 'Other',
}

export const CREW_RELATIONS = ['assigned', 'completed'] as const
export type CrewRelation = (typeof CREW_RELATIONS)[number]

export const VEHICLE_STATUSES = ['available', 'in_use', 'maintenance', 'retired'] as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

// vehicles.type is free text at the DB level (no CHECK) — this tuple is a UI
// convenience for the form dropdown, not an enforced constraint.
export const VEHICLE_TYPES = ['truck', 'trailer', 'other'] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const EQUIPMENT_TYPES = ['mower', 'trimmer', 'blower', 'edger', 'other'] as const
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number]

// Equipment shares the vehicle status vocabulary (available/in_use/maintenance/retired).
export const EQUIPMENT_STATUSES = ['available', 'in_use', 'maintenance', 'retired'] as const
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]

export const PHOTO_TYPES = ['visit', 'how_to', 'customer_request', 'before', 'after', 'plan'] as const
export type PhotoType = (typeof PHOTO_TYPES)[number]

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  how_to: 'How-To Guide',
  customer_request: 'Customer Request',
  visit: 'Visit',
  before: 'Before',
  after: 'After',
  plan: 'Visit Plan Reference',
}

/** UI buckets for the property photo gallery. A superset of PHOTO_TYPES — the
 *  'other' bucket is the default branch so a type added to the DB CHECK ahead of
 *  the UI still renders somewhere instead of vanishing from the gallery. */
export const PHOTO_GROUP_KEYS = [
  'how_to',
  'customer_request',
  'visit',
  'reference',
  'other',
] as const
export type PhotoGroupKey = (typeof PHOTO_GROUP_KEYS)[number]

// `Lead`/`LEAD_*` below is the Phase 9 CRM entity (a prospect from the public
// marketing site) — unrelated to the `'lead'` value in EMPLOYEE_ROLES above,
// which is a crew lead's job title. The names collide; the concepts don't.
export const LEAD_KINDS = ['service_inquiry', 'job_application'] as const
export type LeadKind = (typeof LEAD_KINDS)[number]

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

// Derived from SERVICE_SIDES so the two can't drift apart.
export const LEAD_SERVICE_INTERESTS = [...SERVICE_SIDES, 'other'] as const
export type LeadServiceInterest = (typeof LEAD_SERVICE_INTERESTS)[number]

export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  service_inquiry: 'Inquiry',
  job_application: 'Job Application',
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  won: 'Won',
  lost: 'Lost',
}

/** Shape of a `job_application` lead's `details` jsonb (task 9.6) —
 *  `details` itself is a totally free-form column with no DB constraint,
 *  shaped by app code only, same convention as `site_collection_items.data`
 *  (see JobItemData below). `resume_path` is null when no file was
 *  attached; when set it's a path in the private `resumes` Storage bucket,
 *  readable only by owner/lead via a signed URL. */
export type JobApplicationDetails = {
  position: string
  resume_path: string | null
}

// ─── Joined / composite types ─────────────────────────────────────────────────

/** Employee record joined to its auth.users identity (user_id is always set). */
export type EmployeeWithUser = Employee & {
  user_id: string
}

/** Account with its properties. */
export type AccountWithProperties = Account & {
  properties: Property[]
}

/** Account with its properties (alias kept for call sites that joined deeper before zones were removed). */
export type AccountWithDetails = Account & {
  properties: Property[]
}

/** Flat row used by the account list — augments base account with aggregated counts. */
export type AccountListRow = Account & {
  propertyCount: number
  lastVisitDate: string | null // ISO timestamp of most recent ended_at, or null
}

/** A visit_crew row joined to the employee record. */
export type VisitCrewWithEmployee = VisitCrew & {
  employee: Employee
}

/** A lead joined to the account it became, once converted (task 9.9) — null
 *  until set. Embedded via the real FK constraint name
 *  (`leads_converted_account_id_fkey`) for clarity, even though `leads` now
 *  has only the one FK (the `assigned_to` → `employees` FK was dropped —
 *  migration 20260807090000_drop_leads_assigned_to.sql). */
export type LeadWithConverted = Lead & {
  converted?: Pick<Account, 'id' | 'name'> | null
}

/** Visit with its property and account. */
export type VisitWithLocation = Visit & {
  property: Property
  account: Account
}

/** An invoice joined to its account and the visits it billed (empty for a
 *  contract invoice with no visits in the period). Backs the Billing → History
 *  tab, which renders one row per invoice with its status. See docs/INVOICING.md. */
export type InvoiceWithVisits = Invoice & {
  account: Account
  visits: (Visit & { property: Property })[]
}

/** The bit of an invoice a visit-centric view needs to show a status badge +
 *  QBO link — embedded via the visits.invoice_id FK (`invoice:invoices(...)`). */
export type VisitInvoiceInfo = Pick<Invoice, 'status' | 'qbo_invoice_id'>

/** Visit with crew assignment/completion rows and the associated employees.
 *  `invoice` is optional: only queries that embed it (schedule grid, account
 *  recent-visits) populate it; it's null for uninvoiced visits or under RLS for
 *  roles that can't read invoices. */
export type VisitWithCrew = Visit & {
  visit_crew: VisitCrewWithEmployee[]
  invoice?: VisitInvoiceInfo | null
}

/** Full visit: property, account, crew, and vehicle. */
export type VisitWithDetails = Visit & {
  property: Property
  account: Account
  visit_crew: VisitCrewWithEmployee[]
  vehicle: Vehicle | null
}

/**
 * Visit with crew and a (possibly missing) property — used by account-scoped
 * visit history views, e.g. the account detail page's Recent visits list.
 */
export type RecentVisit = VisitWithCrew & {
  property: Property | null
}

/** Route group with its assigned properties (via property_route_groups). */
export type RouteGroupWithProperties = RouteGroup & {
  properties: Property[]
}

/**
 * The top-level shape returned by getScheduleForWeek.
 * Route groups → properties → visit for the requested week.
 */
export type SchedulePropertyRow = {
  property: Property
  account: Account
  routeGroup: RouteGroup
  visit: VisitWithCrew | null
}

export type ScheduleWeek = {
  weekStart: string // ISO date string, always a Monday
  routeGroups: Array<{
    routeGroup: RouteGroup
    rows: SchedulePropertyRow[]
  }>
}

// ─── Photos ───────────────────────────────────────────────────────────────────

/** A photo row with its resolved signed URL. The `photos` bucket is private, so
 *  every render needs a signed URL; the account Photos tab signs them in a single
 *  batch server-side and denormalizes the result onto each row. `url` is null when
 *  signing failed (e.g. the object is missing) — render a placeholder, not a
 *  broken image. */
export type PhotoWithUrl = Photo & { url: string | null }

export interface PhotoGroup {
  key: PhotoGroupKey
  label: string
  photos: PhotoWithUrl[]
}

/** One property's photos, bucketed by group — the unit the gallery renders. */
export interface PropertyPhotos {
  propertyId: string
  address: string
  groups: PhotoGroup[]
  total: number
}

// ─── Search ───────────────────────────────────────────────────────────────────

/** Flat shape used by the global Cmd+K command palette search. */
export type AccountSearchResult = {
  id: string
  name: string
  contact_name: string | null
  status: AccountStatus
  addresses: string[]
}

// ─── Crew mobile helpers ──────────────────────────────────────────────────────

/** A crew member's stop for today — what's shown on the Today list. */
export type CrewStop = {
  visit: Visit
  property: Property
  account: Account
  isAssigned: boolean
}

// ─── Public marketing site content (Phase 9.2) ─────────────────────────────────
// `site_content` slots and `site_collection_items` back the owner-editable public
// site (app/(public)/*) — see lib/content/site.ts for the read layer and
// lib/validators/site-content.ts for the Zod schemas these types line up with.

export const SITE_PAGES = [
  'global',
  'home',
  'lawn',
  'gardens',
  'about',
  'faq',
  'jobs',
  'contact',
] as const
export type SitePage = (typeof SITE_PAGES)[number]

export const SITE_CONTENT_KINDS = ['text', 'richtext', 'image', 'email', 'phone', 'url'] as const
export type SiteContentKind = (typeof SITE_CONTENT_KINDS)[number]

export const SITE_COLLECTIONS = ['faq', 'job', 'team'] as const
export type SiteCollection = (typeof SITE_COLLECTIONS)[number]

/** A resolved content slot — `value` is already unwrapped from the DB's jsonb
 *  column and merged with lib/content/defaults.ts when no row exists yet, so
 *  callers never see a missing slot, only an empty string. For `kind:
 *  'richtext'`, `value` is always a pre-rendered, safe-to-inject HTML string
 *  (see lib/content/site.ts) — never raw Tiptap JSON. `doc` carries that raw
 *  Tiptap JSON for the editor to resume editing from; it's only present for a
 *  richtext slot backed by an actual DB row (task 9.2.5) — undefined for
 *  every other kind and for the still-default, no-row-yet case. */
export type SiteSlot = {
  page: SitePage
  key: string
  kind: SiteContentKind
  value: string
  doc?: unknown
}

/** getPageContent()'s return shape: every slot for the requested page, keyed
 *  for O(1) lookup in components, plus the raw list for iteration. */
export type PageContent = {
  page: SitePage
  slots: Record<string, SiteSlot>
}

export type FaqItemData = { question: string; answer: string }
export type JobItemData = { title: string; location: string; blurb: string }
export type TeamItemData = { name: string; role: string; bio: string; image_path: string | null }

export type SiteCollectionItem<T> = {
  id: string
  sortOrder: number
  published: boolean
  data: T
}
