import type { EmployeeRole } from '@/types/app'

/**
 * Route access and role capabilities. Dependency-free so proxy.ts (Edge) can import it: the
 * redirect gate and the nav must share one list.
 */

/** Where each role lands. The schedule carries the dashboard as its `Today` view. */
export const ROLE_HOME: Record<EmployeeRole, string> = {
  owner: '/app/schedule',
  lead: '/app/schedule',
  crew: '/app/schedule',
  accountant: '/management/billing',
}

/** Which roles may load which prefix; longest match wins. Deliberately broader than the nav. */
const ROUTE_ACCESS: Array<{ prefix: string; roles: readonly EmployeeRole[] }> = [
  // Field app — the merged surface.
  { prefix: '/app/schedule', roles: ['owner', 'lead', 'crew', 'accountant'] },
  { prefix: '/app/stop', roles: ['owner', 'lead', 'crew'] },
  { prefix: '/app/accounts', roles: ['owner', 'lead', 'accountant'] },
  { prefix: '/app/routes', roles: ['owner', 'lead', 'accountant'] },
  // Retired, but listed so the redirect to ?view=today isn't gated
  // away before next.config gets to it.
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

/** Unmatched protected paths deny, so a new route fails closed until listed. */
export function canAccessRoute(pathname: string, role: EmployeeRole): boolean {
  const match = matchRoute(pathname)
  if (!match) return !isProtectedRoute(pathname)
  return match.roles.includes(role)
}

/** What a role may do. Affordances only: RLS is the real boundary. */
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
  /** The schedule's `Today` view — week stats, fleet issues, uninvoiced counts. */
  seeDashboard: boolean
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
  seeDashboard: false,
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
    seeDashboard: isOwnerOrLead || role === 'accountant',
    seeBilling: isOwnerOrLead || role === 'accountant',
    seeLeads: isOwnerOrLead,
    manageTeam: role === 'owner',
  }
}
