import {
  BarChart3,
  CalendarDays,
  Inbox,
  Receipt,
  Route,
  Truck,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { canAccessRoute } from '@/lib/auth/access'
import type { EmployeeRole } from '@/types/app'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Extra path prefixes that should light this item up (e.g. a detail route). */
  alsoActiveFor?: string[]
}

/** Every destination in sidebar order. Access comes from canAccessRoute, shared with the proxy. */
const NAV_ITEMS: NavItem[] = [
  {
    href: '/app/schedule',
    label: 'Schedule',
    icon: CalendarDays,
    // A stop is opened from the schedule and returns to it.
    alsoActiveFor: ['/app/stop'],
  },
  { href: '/app/routes', label: 'Routes', icon: Route },
  { href: '/app/accounts', label: 'Accounts', icon: Users },
  { href: '/management/leads', label: 'Leads', icon: Inbox },
  { href: '/management/billing', label: 'Billing', icon: Receipt },
  { href: '/management/reports', label: 'Reports', icon: BarChart3 },
  { href: '/management/fleet', label: 'Fleet', icon: Truck },
  { href: '/management/team', label: 'Team', icon: UserCircle },
]

/**
 * Bottom-bar tabs per role (max 3, plus More). The bar holds what works offline; More holds
 * what needs a connection.
 */
const BAR_BY_ROLE: Record<EmployeeRole, string[]> = {
  owner: ['/app/schedule', '/app/routes', '/app/accounts'],
  lead: ['/app/schedule', '/app/routes', '/app/accounts'],
  crew: ['/app/schedule'],
  accountant: ['/management/billing', '/management/reports'],
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const prefixes = [item.href, ...(item.alsoActiveFor ?? [])]
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/** The items a role may see, split into bottom-bar tabs and `More` contents. */
export function navFor(role: EmployeeRole | null): {
  bar: NavItem[]
  more: NavItem[]
  all: NavItem[]
} {
  if (!role) return { bar: [], more: [], all: [] }

  const all = NAV_ITEMS.filter((item) => canAccessRoute(item.href, role))
  const barHrefs = BAR_BY_ROLE[role] ?? []

  // Ordered by BAR_BY_ROLE, not by NAV_ITEMS, so the tab order is deliberate.
  const bar = barHrefs
    .map((href) => all.find((item) => item.href === href))
    .filter((item): item is NavItem => !!item)

  const more = all.filter((item) => !barHrefs.includes(item.href))

  return { bar, more, all }
}
