'use client'

import * as Sentry from '@sentry/nextjs'
import { createContext, useContext, useEffect, useMemo } from 'react'
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
 * Role and capabilities for the shell. `initialRole` is the `rg-role` cookie, a seed only:
 * employees.role via React Query wins when it lands. Cookie-seeded so field routes render offline.
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
    // Ignore a persisted employee row that belongs to someone else; the cookie seed stands until
    // the refetch.
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

  // Who hit an error, for Sentry: the employee id and role only — never name, email or phone.
  useEffect(() => {
    Sentry.setUser(value.employeeId ? { id: value.employeeId } : null)
    Sentry.setTag('role', value.role ?? 'unknown')
  }, [value.employeeId, value.role])

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
 * What the signed-in person may do: `const { editSchedule } = useCan()`.
 * Affordance only; RLS is the boundary.
 */
export function useCan(): Capabilities {
  return useRoleContext().can
}
