'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function setVisitTimes(
  visitId: string,
  startedAt: string | null,
  endedAt: string | null,
): Promise<{ error?: string }> {
  if (endedAt && startedAt && endedAt <= startedAt) {
    return { error: 'End time must be after start time' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('visits')
    .update({ started_at: startedAt, ended_at: endedAt })
    .eq('id', visitId)

  if (error) {
    console.error('[setVisitTimes]', error)
    return { error: error.message }
  }

  revalidatePath('/management/schedule')
  return {}
}
