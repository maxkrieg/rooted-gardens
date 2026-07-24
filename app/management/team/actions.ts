'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { employeeFormSchema, type EmployeeFormValues } from '@/lib/validators/employee'

/**
 * Team Server Actions (task 7.1). Owner-only.
 *
 * Enforcement is layered: the proxy gates /management/team to owner, the
 * employees RLS write policies are owner-only (migration
 * 20260724000000_employees_owner_only_writes), and every action here re-checks
 * via requireOwner(). The re-check matters most for inviteEmployee, which uses
 * the service-role client (RLS-bypassing) to send the magic link and link the
 * returned auth user — so it is NOT covered by the RLS gate.
 */

async function requireOwner(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (employee?.role !== 'owner') return { error: 'Only owners can manage the team' }
  return {}
}

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
    console.error('[createEmployee]', error)
    return { error: error.message }
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

  // employees.email and the Supabase Auth login email (auth.users.email) are
  // independent — magic-link login only uses the auth email. For an already-
  // invited employee (user_id set), keep them in sync: an owner is an admin, so
  // push the change to auth immediately via updateUserById (no confirmation).
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
      console.error('[updateEmployee] auth email sync', authErr)
      return {
        error: /already|exists|registered/i.test(authErr.message)
          ? 'That email is already used by another user.'
          : `Could not update login email: ${authErr.message}`,
      }
    }
  }

  const { error } = await supabase.from('employees').update(employeePayload(parsed.data)).eq('id', id)
  if (error) {
    console.error('[updateEmployee]', error)
    return { error: error.message }
  }
  revalidatePath('/management/team')
  return {}
}

/**
 * SMS notification consent (used by the Phase 8.2 send-sms path). The DB column
 * is sms_opt_*out*, the UI toggle is opt-*in* — so store the inverse.
 */
export async function setEmployeeSmsOptIn(id: string, optIn: boolean): Promise<{ error?: string }> {
  const auth = await requireOwner()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('employees').update({ sms_opt_out: !optIn }).eq('id', id)
  if (error) {
    console.error('[setEmployeeSmsOptIn]', error)
    return { error: error.message }
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
 * Send a magic-link invite to an employee and link the returned auth user to
 * their employees row. Uses the service client because (a) inviteUserByEmail is
 * an admin API and (b) the freshly-created auth user has no employees row yet,
 * so get_my_role() is NULL and the RLS write would fail.
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
    console.error('[inviteEmployee]', error)
    return {
      error: /already been registered|already exists/i.test(error.message)
        ? 'A user with this email already exists in auth'
        : error.message,
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
