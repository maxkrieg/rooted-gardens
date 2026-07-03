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
export type TimeEntry = Tables<'time_entries'>
export type Photo = Tables<'photos'>
export type Integration = Tables<'integrations'>

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

export const EQUIPMENT_TYPES = ['mower', 'trimmer', 'blower', 'edger', 'other'] as const
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number]

export const PHOTO_TYPES = ['visit', 'how_to', 'customer_request', 'before', 'after'] as const
export type PhotoType = (typeof PHOTO_TYPES)[number]

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

/** Visit with its property and account. */
export type VisitWithLocation = Visit & {
  property: Property
  account: Account
}

/** Visit with crew assignment/completion rows and the associated employees. */
export type VisitWithCrew = Visit & {
  visit_crew: VisitCrewWithEmployee[]
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
