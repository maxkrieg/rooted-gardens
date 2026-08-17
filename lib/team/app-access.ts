import { createServiceClient } from '@/lib/supabase/service'
import type { AppAccessStatus, Employee } from '@/types/app'

/**
 * Resolve real app-access state for the Team page.
 *
 * `employees.user_id` is set by inviteEmployee the instant the invite email is
 * sent, so on its own it means "was invited", not "can get in" — an employee
 * whose invite link expired unclicked looks identical to one using the app
 * daily. The truth lives in auth.users, which only the admin API can read, so
 * this runs on the service client. Server-only: never import from a Client
 * Component.
 *
 * Degrades to `'active'` for any linked employee if the admin call fails — a
 * wrong-but-familiar label beats an error page on the roster.
 */
export async function getAppAccessStatuses(
  employees: Employee[],
): Promise<Record<string, AppAccessStatus>> {
  const statuses: Record<string, AppAccessStatus> = {}
  for (const e of employees) {
    statuses[e.id] = e.user_id ? 'active' : 'none'
  }

  const linked = employees.filter((e) => e.user_id)
  if (linked.length === 0) return statuses

  let signedIn: Set<string>
  try {
    signedIn = await fetchSignedInUserIds()
  } catch (err) {
    console.error('[getAppAccessStatuses] listUsers', err)
    return statuses
  }

  for (const e of linked) {
    statuses[e.id] = signedIn.has(e.user_id!) ? 'active' : 'invited'
  }
  return statuses
}

/**
 * IDs of auth users who have signed in at least once. Paged rather than a single
 * large call — a silent truncation would mislabel someone as never-signed-in,
 * which is the exact bug this is meant to fix. At ~20 employees this is one
 * request; the cap is a runaway guard, not a real limit.
 */
async function fetchSignedInUserIds(): Promise<Set<string>> {
  const service = createServiceClient()
  const perPage = 200
  const maxPages = 25
  const signedIn = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    for (const user of data.users) {
      if (user.last_sign_in_at) signedIn.add(user.id)
    }
    if (data.users.length < perPage) break
  }

  return signedIn
}
