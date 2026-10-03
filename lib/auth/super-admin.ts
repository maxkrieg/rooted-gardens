/**
 * The super admin (the app's developer) is an env allowlist of Supabase auth user ids, not an
 * `employees.role`: a role would ripple through RLS, capabilities and the nav, and nobody can
 * grant an env var from inside the app. Dependency-free so proxy.ts (Edge) can import it.
 */
function superAdminIds(): string[] {
  return (process.env.SUPER_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

export function isSuperAdmin(userId: string | null | undefined): boolean {
  return !!userId && superAdminIds().includes(userId)
}
