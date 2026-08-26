'use client'

import { createContext, useContext, useMemo } from 'react'
import { useCurrentEmployee } from '@/hooks/crew/useCurrentEmployee'
import { capabilitiesFor, type Capabilities } from '@/lib/auth/access'
import type { Employee, EmployeeRole } from '@/types/app'

interface RoleContextValue {
  role: EmployeeRole | null
  employee: Employee | null
  employeeId: string | null
  can: Capabilities
  /** True until the employee row has loaded and confirmed the seeded role. */
  isReconciling: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

/**
 * The single source of role and capability for the app shell and everything
 * under it, replacing the `role` prop that was threaded through the schedule,
 * accounts, and visit-detail trees.
 *
 * `initialRole` comes from the httpOnly `rg-role` cookie, read server-side —
 * a seed, not the truth. The cookie lives 12h so a role change can lag, and the
 * page HTML may itself be served from the service worker cache. `employees.role`
 * via React Query is authoritative and wins as soon as it lands.
 *
 * Seeding from the cookie rather than querying the DB in the layout is
 * deliberate: a field route has to render offline, where a layout-time Supabase
 * round-trip cannot resolve.
 */
export function RoleProvider({
  initialRole,
  userId,
  children,
}: {
  initialRole: EmployeeRole | null
  userId?: string | null
  children: React.ReactNode
}) {
  const { data, isSuccess } = useCurrentEmployee()

  const value = useMemo<RoleContextValue>(() => {
    // A persisted `current-employee` entry can outlive the session that wrote
    // it, so a row belonging to someone else is ignored rather than trusted —
    // it would otherwise hand this person the previous user's role. The mount
    // refetch replaces it; until then the cookie seed (which is user-keyed)
    // stands.
    const stale = !!data && !!userId && !!data.user_id && data.user_id !== userId
    const employee = stale ? undefined : data

    const role = (employee?.role as EmployeeRole | undefined) ?? initialRole
    return {
      role: role ?? null,
      employee: employee ?? null,
      employeeId: employee?.id ?? null,
      can: capabilitiesFor(role),
      isReconciling: !isSuccess || stale,
    }
  }, [data, userId, initialRole, isSuccess])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

function useRoleContext(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) {
    throw new Error('useRole must be used inside <RoleProvider> (mounted by AppShell)')
  }
  return ctx
}

/** The signed-in person's role and employee row. */
export function useRole() {
  return useRoleContext()
}

/**
 * What the signed-in person may do.
 *
 * ```ts
 * const { editSchedule } = useCan()
 * ```
 *
 * Affordance only — never the security boundary. RLS is.
 */
export function useCan(): Capabilities {
  return useRoleContext().can
}
