'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addManualSession(
  visitId: string,
  employeeId: string,
  startedAt: string,
  endedAt?: string
): Promise<{ error?: string }> {
  if (!startedAt) return { error: 'Start time is required' }
  if (!employeeId) return { error: 'Employee is required' }
  if (endedAt && endedAt <= startedAt) {
    return { error: 'End time must be after start time' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('visit_sessions').insert({
    visit_id: visitId,
    employee_id: employeeId,
    started_at: startedAt,
    ended_at: endedAt ?? null,
    source: 'manual',
  })

  if (error) {
    console.error('[addManualSession]', error)
    return { error: error.message }
  }

  revalidatePath('/management/schedule')
  return {}
}
