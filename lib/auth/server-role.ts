import { cookies } from 'next/headers'
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
