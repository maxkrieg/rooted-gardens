import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { parseRoleCookie } from '@/lib/utils/role-cookie'
import type { EmployeeRole } from '@/types/app'

/**
 * The `rg-role` cookie, read server-side, for seeding RoleProvider.
 *
 * The cookie stores `<userId>_<role>` so a stale cookie from a previously
 * signed-in user is ignored — hence the explicit `userId` compare. Writing this
 * as `parsed?.userId === user?.id` looks equivalent and is not: with no cookie
 * and no user, both sides are `undefined` and the check passes.
 */
export async function getSeedRole(
  userId: string | undefined | null,
): Promise<EmployeeRole | null> {
  if (!userId) return null
  const cookieStore = await cookies()
  const parsed = parseRoleCookie(cookieStore.get('rg-role')?.value)
  if (!parsed || parsed.userId !== userId) return null
  return parsed.role as EmployeeRole
}

/** Server-action guard: resolves the signed-in employee and checks their role.
 *  RLS is the real boundary; this just gives a readable error instead of a denial. */
export async function requireRole(
  roles: EmployeeRole[],
  deniedMessage: string,
): Promise<{ employeeId: string; error?: undefined } | { employeeId?: undefined; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('user_id', user.id)
    .single()
  if (!employee) return { error: 'No employee record for this login' }
  if (!roles.includes(employee.role as EmployeeRole)) return { error: deniedMessage }

  return { employeeId: employee.id }
}
