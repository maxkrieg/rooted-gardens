'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
// Cookie-less anon client, used only by resendEmployeeInvite — see the note there
// on why the @supabase/ssr client can't send that email.
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/server-role'
import { createServiceClient } from '@/lib/supabase/service'
import { employeeFormSchema, type EmployeeFormValues } from '@/lib/validators/employee'
import { toUserMessage } from '@/lib/errors'

/**
 * Team actions, owner-only. The proxy and RLS gate this too, but inviteEmployee uses the service
 * client, so requireOwner() is its only check.
 */

const requireOwner = () => requireRole(['owner'], 'Only owners can manage the team')

function employeePayload(data: EmployeeFormValues) {
  return {
    name: data.name,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    role: data.role,
    side: data.side,
    active: data.active,
    hourly_rate: data.hourly_rate ?? null,
  }
}

export async function createEmployee(values: EmployeeFormValues): Promise<{ error?: string }> {
  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const parsed = employeeFormSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }

  const supabase = await createClient()
  const { error } = await supabase.from('employees').insert(employeePayload(parsed.data))
  if (error) {
    return { error: toUserMessage(error, 'Could not add the employee.', '[createEmployee]') }
  }
  revalidatePath('/management/team')
  return {}
}

export async function updateEmployee(
  id: string,
  values: EmployeeFormValues,
): Promise<{ error?: string }> {
  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const parsed = employeeFormSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }

  const supabase = await createClient()

  // Login uses the auth email, not employees.email; keep an invited user's auth email in sync.
  const { data: existing, error: fetchErr } = await supabase
    .from('employees')
    .select('user_id, email')
    .eq('id', id)
    .single()
  if (fetchErr || !existing) return { error: 'Employee not found' }

  const newEmail = parsed.data.email?.trim() || null
  if (existing.user_id && newEmail !== existing.email) {
    if (!newEmail) {
      return { error: 'An employee with app access must keep an email address.' }
    }
    const service = createServiceClient()
    const { error: authErr } = await service.auth.admin.updateUserById(existing.user_id, {
      email: newEmail,
    })
    if (authErr) {
      // toUserMessage already maps the "already registered" case; anything else
      // is a GoTrue internal message that means nothing to an owner.
      return {
        error: toUserMessage(
          authErr,
          'Could not update the login email. The rest of the changes were not saved.',
          '[updateEmployee] auth email sync',
        ),
      }
    }
  }

  const { error } = await supabase.from('employees').update(employeePayload(parsed.data)).eq('id', id)
  if (error) {
    return { error: toUserMessage(error, 'Could not save the employee.', '[updateEmployee]') }
  }
  revalidatePath('/management/team')
  return {}
}

/** SMS consent (inert until SMS ships). The column is opt-out, the toggle opt-in. */
export async function setEmployeeSmsOptIn(id: string, optIn: boolean): Promise<{ error?: string }> {
  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('employees').update({ sms_opt_out: !optIn }).eq('id', id)
  if (error) {
    return { error: toUserMessage(error, 'Could not update the text-message setting.', '[setEmployeeSmsOptIn]') }
  }
  revalidatePath('/management/team')
  return {}
}

async function resolveOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const h = await headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/**
 * Invite and link the new auth user. Service client: an admin API, and the new user has no
 * role yet for RLS.
 */
export async function inviteEmployee(id: string): Promise<{ error?: string }> {
  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { data: employee, error: fetchErr } = await supabase
    .from('employees')
    .select('id, email, user_id')
    .eq('id', id)
    .single()
  if (fetchErr || !employee) return { error: 'Employee not found' }
  if (employee.user_id) return { error: 'This employee already has app access' }
  if (!employee.email) return { error: 'Add an email address before inviting' }

  const origin = await resolveOrigin()
  const service = createServiceClient()
  const { data, error } = await service.auth.admin.inviteUserByEmail(employee.email, {
    redirectTo: `${origin}/auth/callback`,
  })
  if (error) {
    return {
      error: toUserMessage(
        error,
        'Could not send the invitation. Check the email address and try again.',
        '[inviteEmployee]',
      ),
    }
  }

  const { error: linkErr } = await service
    .from('employees')
    .update({ user_id: data.user.id })
    .eq('id', id)
  if (linkErr) {
    console.error('[inviteEmployee] link', linkErr)
    return { error: 'Invite sent, but linking app access failed — try again.' }
  }

  revalidatePath('/management/team')
  return {}
}

/**
 * Re-send a sign-in link (inviteUserByEmail only works once). Uses a bare supabase-js client:
 * @supabase/ssr forces PKCE, which would put the code verifier in the owner's cookies.
 */
export async function resendEmployeeInvite(id: string): Promise<{ error?: string }> {
  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { data: employee, error: fetchErr } = await supabase
    .from('employees')
    .select('id, email, user_id')
    .eq('id', id)
    .single()
  if (fetchErr || !employee) return { error: 'Employee not found' }
  if (!employee.email) return { error: 'Add an email address before sending a link' }
  if (!employee.user_id) return { error: 'Use “Invite to App” first — they have no login yet' }

  const origin = await resolveOrigin()
  const mailer = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { error } = await mailer.auth.signInWithOtp({
    email: employee.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // A stale or mistyped address must never mint a second auth user that no
      // employees row points at.
      shouldCreateUser: false,
    },
  })
  if (error) {
    return {
      error: toUserMessage(
        error,
        'Could not send the sign-in link. Try again in a minute.',
        '[resendEmployeeInvite]',
      ),
    }
  }

  // Nothing was written — no revalidatePath.
  return {}
}
