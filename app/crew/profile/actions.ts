'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { crewProfileSchema, type CrewProfileValues } from '@/lib/validators/employee'

/**
 * Crew self-service profile update (crew /profile) — online-only.
 *
 * employees UPDATE RLS is owner-only (migration 20260724000000), so a crew
 * member cannot write their own row via the normal client. This writes through
 * the service-role client, but safety comes from two hard constraints, not RLS:
 *   1. the update is scoped to `.eq('user_id', user.id)` — only their own row, and
 *   2. only the { phone, sms_opt_out } columns are ever set — role / active /
 *      hourly_rate / side / email can never be escalated.
 * Same service-client-with-ownership-check shape as inviteEmployee.
 */
export async function updateMyProfile(values: CrewProfileValues): Promise<{ error?: string }> {
  const parsed = crewProfileSchema.safeParse(values)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const service = createServiceClient()
  const { error } = await service
    .from('employees')
    .update({
      phone: parsed.data.phone?.trim() || null,
      sms_opt_out: !parsed.data.smsOptIn,
    })
    .eq('user_id', user.id)
  if (error) {
    console.error('[updateMyProfile]', error)
    return { error: error.message }
  }
  return {}
}
