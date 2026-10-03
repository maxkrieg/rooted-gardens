'use server'

import { cookies } from 'next/headers'
import { createClient as createBareClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ROLE_HOME } from '@/lib/auth/access'
import { isSuperAdmin } from '@/lib/auth/super-admin'
import {
  IMPERSONATION_MAX_AGE,
  IMPERSONATOR_COOKIE,
  impersonationConfigured,
  openImpersonator,
  sealImpersonator,
  sessionIdFromAccessToken,
} from '@/lib/auth/impersonation'
import {
  IMPERSONATION_DISPLAY_COOKIE,
  formatImpersonationDisplay,
} from '@/lib/auth/impersonation-display'
import { reportError } from '@/lib/observability/report'
import type { Database } from '@/types/database'
import type { EmployeeRole } from '@/types/app'

const ROLE_COOKIE = 'rg-role'

type Result = { error: string; home?: undefined } | { home: string; error?: undefined }

const cookieOptions = (httpOnly: boolean) => ({
  httpOnly,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: IMPERSONATION_MAX_AGE,
  path: '/',
})

/** Audit rows for start/stop, written directly: the service client has no auth.uid() to log. */
async function logImpersonation(
  action: 'admin.impersonation_started' | 'admin.impersonation_stopped',
  adminUserId: string,
  adminLabel: string,
  target: { id: string; name: string },
) {
  const service = createServiceClient()
  const { data: adminEmployee } = await service
    .from('employees')
    .select('id')
    .eq('user_id', adminUserId)
    .maybeSingle()
  const { error } = await service.from('audit_log').insert({
    actor_employee_id: adminEmployee?.id ?? null,
    actor_label: adminLabel,
    action,
    entity_table: 'employees',
    entity_id: target.id,
    entity_label: target.name,
  })
  if (error) reportError(error, '[impersonation] audit', { message: error.message })
}

/** Sign the super admin in as `employeeId`, parking their own session in a sealed cookie. */
export async function startImpersonation(employeeId: string): Promise<Result> {
  if (!impersonationConfigured()) {
    return { error: 'Impersonation isn’t configured: set IMPERSONATION_SECRET on the server.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user.id)) return { error: 'Only a super admin can impersonate.' }

  // getUser() may have refreshed the session above, so read the refresh token after it.
  const {
    data: { session: adminSession },
  } = await supabase.auth.getSession()
  if (!adminSession) return { error: 'Your session has expired. Sign in again.' }

  const service = createServiceClient()
  const { data: target, error: targetError } = await service
    .from('employees')
    .select('id, name, role, user_id')
    .eq('id', employeeId)
    .maybeSingle()
  if (targetError || !target) return { error: 'That employee no longer exists.' }
  if (!target.user_id) return { error: `${target.name} has no app login to impersonate.` }
  if (target.user_id === user.id || isSuperAdmin(target.user_id)) {
    return { error: 'Super admins can’t be impersonated.' }
  }

  const { data: authUser } = await service.auth.admin.getUserById(target.user_id)
  const email = authUser.user?.email
  if (!email) return { error: `${target.name}’s login has no email address.` }

  // Mints a one-time token without sending anything; it would only email if we asked.
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !link.properties?.hashed_token) {
    reportError(linkError, '[impersonation] generateLink', { message: linkError?.message })
    return { error: 'Couldn’t create a session for that person.' }
  }

  // Redeem it on a client that writes no cookies, so a failure here leaves the admin as they were.
  const bare = createBareClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: verified, error: verifyError } = await bare.auth.verifyOtp({
    type: 'email',
    token_hash: link.properties.hashed_token,
  })
  const targetSession = verified.session
  const authSessionId = targetSession && sessionIdFromAccessToken(targetSession.access_token)
  if (verifyError || !targetSession || !authSessionId) {
    reportError(verifyError, '[impersonation] verifyOtp', { message: verifyError?.message })
    return { error: 'Couldn’t create a session for that person.' }
  }

  const adminLabel = user.email ?? 'Super admin'

  // Recorded before the swap: without this row the audit trigger can't tell it's you.
  const { error: rowError } = await service.from('impersonation_sessions').insert({
    auth_session_id: authSessionId,
    admin_user_id: user.id,
    admin_label: adminLabel,
    target_employee_id: target.id,
  })
  if (rowError) {
    await bare.auth.signOut({ scope: 'local' })
    reportError(rowError, '[impersonation] record session', { message: rowError.message })
    return { error: 'Couldn’t record the impersonation, so it wasn’t started.' }
  }

  const { error: setError } = await supabase.auth.setSession({
    access_token: targetSession.access_token,
    refresh_token: targetSession.refresh_token,
  })
  if (setError) {
    await bare.auth.signOut({ scope: 'local' })
    reportError(setError, '[impersonation] setSession', { message: setError.message })
    return { error: 'Couldn’t switch to that person’s session.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(
    IMPERSONATOR_COOKIE,
    await sealImpersonator({
      adminUserId: user.id,
      adminLabel,
      adminRefreshToken: adminSession.refresh_token,
      targetUserId: target.user_id,
      targetEmployeeId: target.id,
      targetName: target.name,
      authSessionId,
      startedAt: new Date().toISOString(),
    }),
    cookieOptions(true),
  )
  cookieStore.set(
    IMPERSONATION_DISPLAY_COOKIE,
    formatImpersonationDisplay({
      userId: target.user_id,
      name: target.name,
      role: target.role,
      live: process.env.VERCEL_ENV === 'production',
    }),
    cookieOptions(false),
  )
  // The proxy re-derives the role for the new user; don't make it wade through the old one.
  cookieStore.delete(ROLE_COOKIE)

  await logImpersonation('admin.impersonation_started', user.id, adminLabel, target)

  return { home: ROLE_HOME[target.role as EmployeeRole] ?? '/app/schedule' }
}

/** End the impersonated session and hand the super admin their own back. */
export async function stopImpersonation(): Promise<Result> {
  const cookieStore = await cookies()
  const parked = await openImpersonator(cookieStore.get(IMPERSONATOR_COOKIE)?.value)

  const supabase = await createClient()
  // Revokes only this browser's impersonated session; their own devices stay signed in.
  await supabase.auth.signOut({ scope: 'local' })

  cookieStore.delete(IMPERSONATOR_COOKIE)
  cookieStore.delete(IMPERSONATION_DISPLAY_COOKIE)
  cookieStore.delete(ROLE_COOKIE)

  if (!parked) return { home: '/login' }

  if (impersonationConfigured()) {
    const service = createServiceClient()
    const { error } = await service
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('auth_session_id', parked.authSessionId)
    if (error) reportError(error, '[impersonation] end session', { message: error.message })
    await logImpersonation('admin.impersonation_stopped', parked.adminUserId, parked.adminLabel, {
      id: parked.targetEmployeeId,
      name: parked.targetName,
    })
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: parked.adminRefreshToken,
  })
  if (error || data.user?.id !== parked.adminUserId) {
    // Expired or revoked while parked. Signed out is the safe place to land.
    if (data.session) await supabase.auth.signOut({ scope: 'local' })
    return { home: '/login' }
  }

  return { home: '/admin/impersonate' }
}
