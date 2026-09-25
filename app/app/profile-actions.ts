'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { crewProfileSchema, type CrewProfileValues } from '@/lib/validators/employee'
import { toUserMessage } from '@/lib/errors'

/**
 * Self-service profile update, online-only. Service client (employees RLS is owner-only), made
 * safe by scoping to the caller's own row and only { phone, sms_opt_out }.
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
    return { error: toUserMessage(error, 'Could not save your profile.', '[updateMyProfile]') }
  }
  return {}
}
