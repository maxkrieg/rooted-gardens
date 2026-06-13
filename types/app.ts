import type { Tables } from './database'

// Base row types aliased for convenience
export type Account = Tables<'accounts'>
export type Property = Tables<'properties'>
export type ServiceZone = Tables<'service_zones'>
export type RouteGroup = Tables<'route_groups'>
export type PropertyRouteGroup = Tables<'property_route_groups'>
export type Employee = Tables<'employees'>
export type Vehicle = Tables<'vehicles'>
export type Equipment = Tables<'equipment'>
export type Visit = Tables<'visits'>
export type VisitCrew = Tables<'visit_crew'>
export type VisitSession = Tables<'visit_sessions'>
export type TimeEntry = Tables<'time_entries'>
export type Photo = Tables<'photos'>
export type Integration = Tables<'integrations'>

// ─── Domain constants ─────────────────────────────────────────────────────────

export const BILLING_TYPES = ['per_visit', 'contract', 'as_needed'] as const
export type BillingType = (typeof BILLING_TYPES)[number]

export const ACCOUNT_STATUSES = ['active', 'inactive', 'prospective'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const EMPLOYEE_ROLES = ['owner', 'lead', 'crew', 'accountant'] as const
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number]

export const SERVICE_SIDES = ['lawn', 'garden', 'both'] as const
export type ServiceSide = (typeof SERVICE_SIDES)[number]

export const ZONE_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'as_needed'] as const
export type ZoneFrequency = (typeof ZONE_FREQUENCIES)[number]

export const VISIT_STATUSES = ['scheduled', 'completed', 'skipped', 'invoiced'] as const
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

export const CREW_RELATIONS = ['assigned', 'completed'] as const
export type CrewRelation = (typeof CREW_RELATIONS)[number]

export const SESSION_SOURCES = ['crew_app', 'manual'] as const
export type SessionSource = (typeof SESSION_SOURCES)[number]

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

/** Property with all its service zones. */
export type PropertyWithZones = Property & {
  service_zones: ServiceZone[]
}

/** Account with its properties (no zones). */
export type AccountWithProperties = Account & {
  properties: Property[]
}

/** Account with properties and their service zones. */
export type AccountWithDetails = Account & {
  properties: PropertyWithZones[]
}

/** Service zone with its parent property and account info. */
export type ZoneWithProperty = ServiceZone & {
  property: Property
  account: Account
}

/** A visit_crew row joined to the employee record. */
export type VisitCrewWithEmployee = VisitCrew & {
  employee: Employee
}

/** Visit with its service zone. */
export type VisitWithZone = Visit & {
  service_zone: ServiceZone
}

/** Visit with its service zone, parent property, and account. */
export type VisitWithLocation = Visit & {
  service_zone: ServiceZone
  property: Property
  account: Account
}

/** Visit with crew assignment/completion rows and the associated employees. */
export type VisitWithCrew = Visit & {
  visit_crew: VisitCrewWithEmployee[]
}

/** Full visit: zone, property, account, crew, and vehicle. */
export type VisitWithDetails = Visit & {
  service_zone: ServiceZone
  property: Property
  account: Account
  visit_crew: VisitCrewWithEmployee[]
  vehicle: Vehicle | null
}

/** visit_session row joined to the employee. */
export type VisitSessionWithEmployee = VisitSession & {
  employee: Employee
}

/** Visit with its open and closed sessions (for in-progress / elapsed-time UI). */
export type VisitWithSessions = Visit & {
  visit_sessions: VisitSession[]
}

/** Full visit including sessions (for management in-progress view). */
export type VisitWithDetailsAndSessions = VisitWithDetails & {
  visit_sessions: VisitSessionWithEmployee[]
}

/** Route group with its assigned properties (via property_route_groups). */
export type RouteGroupWithProperties = RouteGroup & {
  properties: PropertyWithZones[]
}

/**
 * The top-level shape returned by getScheduleForWeek.
 * Route groups → properties → zones → visit for the requested week.
 */
export type ScheduleZoneRow = {
  zone: ServiceZone
  property: Property
  account: Account
  routeGroup: RouteGroup
  visit: VisitWithCrew | null
}

export type ScheduleWeek = {
  weekStart: string // ISO date string, always a Monday
  routeGroups: Array<{
    routeGroup: RouteGroup
    rows: ScheduleZoneRow[]
  }>
}

// ─── Crew mobile helpers ──────────────────────────────────────────────────────

/** A crew member's stop for today — what's shown on the Today list. */
export type CrewStop = {
  visit: Visit
  property: Property
  account: Account
  zones: ServiceZone[]
  isAssigned: boolean
}
