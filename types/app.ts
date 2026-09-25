import type { Tables } from './database'

// Base row types aliased for convenience
export type Account = Tables<'accounts'>
export type Property = Tables<'properties'>
export type RouteGroup = Tables<'route_groups'>
export type Employee = Tables<'employees'>
export type Vehicle = Tables<'vehicles'>
export type RouteGroupWeekNote = Tables<'route_group_week_notes'>
/** A route group's regular crew member, with the employee row resolved. */
export type RouteGroupDefaultCrew = Tables<'route_group_default_crew'> & {
  employee: Employee | null
}
export type Equipment = Tables<'equipment'>
export type Visit = Tables<'visits'>
type VisitCrew = Tables<'visit_crew'>
export type Photo = Tables<'photos'>
export type Invoice = Tables<'invoices'>
export type MaintenanceLog = Tables<'maintenance_logs'>
export type Lead = Tables<'leads'>

// A property enriched with its account name and current route group — used by
// the routes management page and its Assign Properties sheet.
export interface PropertyWithAccount extends Property {
  accountName: string
  /** At most one route group (property_route_groups_property_idx); null = unrouted. */
  currentRouteGroup: { id: string; name: string } | null
}

// ─── Domain constants ─────────────────────────────────────────────────────────

// 'as_needed' is retired as a billing type (it's a cadence, on properties.frequency). The DB
// CHECK still allows it, so billing_type readers keep defensive fallbacks.
export const BILLING_TYPES = ['per_visit', 'contract'] as const
export type BillingType = (typeof BILLING_TYPES)[number]

export const ACCOUNT_STATUSES = ['active', 'inactive', 'prospective'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const CONTRACT_PERIODS = ['monthly', 'seasonal'] as const

export const EMPLOYEE_ROLES = ['owner', 'lead', 'crew', 'accountant'] as const
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number]

export const SERVICE_SIDES = ['lawn', 'garden', 'both'] as const

export const PROPERTY_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'as_needed'] as const
export type Frequency = (typeof PROPERTY_FREQUENCIES)[number]

const VISIT_STATUSES = ['scheduled', 'completed', 'skipped'] as const
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

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  mow: 'Mow',
  double_cut: 'Double Cut',
  trim: 'Trim',
  edge: 'Edge',
  leaf_mulch: 'Leaf Mulch',
  cleanup: 'Cleanup',
  other: 'Other',
}

export const VEHICLE_STATUSES = ['available', 'in_use', 'maintenance', 'retired'] as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

// vehicles.type is free text at the DB level (no CHECK) — this tuple is a UI
// convenience for the form dropdown, not an enforced constraint.
export const VEHICLE_TYPES = ['truck', 'trailer', 'other'] as const

export const EQUIPMENT_TYPES = ['mower', 'trimmer', 'blower', 'edger', 'other'] as const

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

/** Gallery buckets. 'other' catches any photo type the UI doesn't know yet. */
const PHOTO_GROUP_KEYS = [
  'how_to',
  'customer_request',
  'visit',
  'reference',
  'other',
] as const
export type PhotoGroupKey = (typeof PHOTO_GROUP_KEYS)[number]

// The CRM lead (a public-site prospect), unrelated to the 'lead' employee role.
export const LEAD_KINDS = ['service_inquiry', 'job_application'] as const
export type LeadKind = (typeof LEAD_KINDS)[number]

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

// Derived from SERVICE_SIDES so the two can't drift apart.
const LEAD_SERVICE_INTERESTS = [...SERVICE_SIDES, 'other'] as const
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

/** A job_application lead's `details` jsonb. `resume_path` points into the private `resumes` bucket. */
export type JobApplicationDetails = {
  position: string
  resume_path: string | null
}

// ─── Joined / composite types ─────────────────────────────────────────────────

/** 'invited' means an invite went out but the user never signed in (user_id alone can't tell). */
export type AppAccessStatus = 'none' | 'invited' | 'active'

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

export type LeadWithConverted = Lead & {
  converted?: Pick<Account, 'id' | 'name'> | null
}

/** Visit with its property and account. */
export type VisitWithLocation = Visit & {
  property: Property
  account: Account
}

/** An invoice with its account and billed visits (empty for most contract invoices). */
export type InvoiceWithVisits = Invoice & {
  account: Account
  visits: (Visit & { property: Property })[]
}

/** The bit of an invoice a visit-centric view needs to show a status badge +
 *  QBO link — embedded via the visits.invoice_id FK (`invoice:invoices(...)`). */
export type VisitInvoiceInfo = Pick<Invoice, 'status' | 'qbo_invoice_id'>

/** `invoice` and `photo_count` are only populated by queries that embed them. */
export type VisitWithCrew = Visit & {
  visit_crew: VisitCrewWithEmployee[]
  invoice?: VisitInvoiceInfo | null
  photo_count?: number
}

/** Full visit: property, account, crew, and vehicle. */
export type VisitWithDetails = Visit & {
  property: Property
  account: Account
  visit_crew: VisitCrewWithEmployee[]
  vehicle: Vehicle | null
}

export type RecentVisit = VisitWithCrew & {
  property: Property | null
}

export type SchedulePropertyRow = {
  property: Property
  account: Account
  /** null = the property isn't on any route group ("ungrouped" bucket below). */
  routeGroup: RouteGroup | null
  visit: VisitWithCrew | null
}

export type ScheduleWeek = {
  weekStart: string // ISO date string, always a Monday
  routeGroups: Array<{
    routeGroup: RouteGroup
    rows: SchedulePropertyRow[]
  }>
  /** Properties on no route group. Always present, even when empty. */
  ungrouped: SchedulePropertyRow[]
}

// ─── Photos ───────────────────────────────────────────────────────────────────

/** `url` is null when signing failed; render a placeholder. */
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

// ─── Public marketing site content ─────────────────────────────────────────────

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

const SITE_CONTENT_KINDS = ['text', 'richtext', 'image', 'email', 'phone', 'url'] as const
export type SiteContentKind = (typeof SITE_CONTENT_KINDS)[number]

export const SITE_COLLECTIONS = ['faq', 'job', 'team'] as const
export type SiteCollection = (typeof SITE_COLLECTIONS)[number]

/**
 * A resolved slot, falling back to lib/content/defaults.ts. Richtext `value` is sanitized HTML;
 * `doc` is the raw Tiptap JSON, present only when a DB row exists.
 */
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
