import type { EmployeeRole } from '@/types/app'

/**
 * Route access and role capabilities, in one dependency-free module.
 *
 * Kept free of React and of any Node-only import so `proxy.ts` (Edge runtime)
 * can import it directly — that's what lets the redirect gate and the nav
 * filter agree instead of drifting, which is how `ROLE_HOME` ended up
 * duplicated into app/(public)/layout.tsx as `STAFF_HOME`.
 */

/**
 * Where a role lands when it has nowhere better to go.
 *
 * Owner/lead still land on the dashboard, unchanged from before the merge.
 * That moves to the schedule in R2.6, when the dashboard folds into it as the
 * `Today` view — not here, so R1 stays behavior-preserving.
 */
export const ROLE_HOME: Record<EmployeeRole, string> = {
  owner: '/app/dashboard',
  lead: '/app/dashboard',
  crew: '/app/schedule',
  accountant: '/management/billing',
}

/**
 * Which roles may load which route prefix. Longest match wins, so
 * `/management/team` beats `/management`.
 *
 * Access is deliberately broader than the nav: an accountant keeps the
 * schedule/accounts/routes access they had under the old `MANAGEMENT_ROLES`
 * set, they just aren't given bottom-bar tabs for it. Promoting a destination
 * and permitting it are different decisions.
 */
const ROUTE_ACCESS: Array<{ prefix: string; roles: readonly EmployeeRole[] }> = [
  // Field app — the merged surface.
  { prefix: '/app/schedule', roles: ['owner', 'lead', 'crew', 'accountant'] },
  { prefix: '/app/stop', roles: ['owner', 'lead', 'crew'] },
  { prefix: '/app/accounts', roles: ['owner', 'lead', 'accountant'] },
  { prefix: '/app/routes', roles: ['owner', 'lead', 'accountant'] },
  { prefix: '/app/dashboard', roles: ['owner', 'lead', 'accountant'] },

  // Desk routes — unchanged from the old proxy sub-route gates.
  { prefix: '/management/team', roles: ['owner'] },
  { prefix: '/management/leads', roles: ['owner', 'lead'] },
  { prefix: '/management', roles: ['owner', 'lead', 'accountant'] },
]

/** Longest-prefix match, so a sub-route gate beats the `/management` catch-all. */
function matchRoute(pathname: string) {
  let best: (typeof ROUTE_ACCESS)[number] | undefined
  for (const entry of ROUTE_ACCESS) {
    if (pathname === entry.prefix || pathname.startsWith(entry.prefix + '/')) {
      if (!best || entry.prefix.length > best.prefix.length) best = entry
    }
  }
  return best
}

/** True for routes that require a session at all. */
export function isProtectedRoute(pathname: string): boolean {
  return pathname.startsWith('/app') || pathname.startsWith('/management')
}

/**
 * Whether `role` may load `pathname`. An unmatched protected path denies —
 * a new route is inaccessible until it's listed here, which fails closed.
 */
export function canAccessRoute(pathname: string, role: EmployeeRole): boolean {
  const match = matchRoute(pathname)
  if (!match) return !isProtectedRoute(pathname)
  return match.roles.includes(role)
}

/**
 * What a role may *do*. Consolidates the checks that were duplicated across
 * VisitDetailContent, ScheduleView, AccountDetailView, and the two schedule
 * pages.
 *
 * These drive affordances only. RLS is the real boundary — every capability
 * here has a matching policy, and a forced-on flag still fails at the database.
 */
export interface Capabilities {
  /** Create visits, bulk-assign a route, edit crew instructions. */
  editSchedule: boolean
  /** Change who is on a visit. Crew can, so they can fix the roster on site. */
  reassignCrew: boolean
  /** Log or amend a completion. Everyone but the accountant. */
  editCompletion: boolean
  /** Create and edit accounts and properties. */
  editAccounts: boolean
  /** Archive an account or property — owner-only, enforced by a DB trigger. */
  archive: boolean
  /** Create route groups and move properties between them. */
  editRoutes: boolean
  seeBilling: boolean
  seeLeads: boolean
  manageTeam: boolean
}

const NO_CAPABILITIES: Capabilities = {
  editSchedule: false,
  reassignCrew: false,
  editCompletion: false,
  editAccounts: false,
  archive: false,
  editRoutes: false,
  seeBilling: false,
  seeLeads: false,
  manageTeam: false,
}

export function capabilitiesFor(role: EmployeeRole | null | undefined): Capabilities {
  if (!role) return NO_CAPABILITIES

  const isOwnerOrLead = role === 'owner' || role === 'lead'

  return {
    editSchedule: isOwnerOrLead,
    reassignCrew: isOwnerOrLead || role === 'crew',
    editCompletion: role !== 'accountant',
    editAccounts: isOwnerOrLead,
    archive: role === 'owner',
    editRoutes: isOwnerOrLead,
    seeBilling: isOwnerOrLead || role === 'accountant',
    seeLeads: isOwnerOrLead,
    manageTeam: role === 'owner',
  }
}
