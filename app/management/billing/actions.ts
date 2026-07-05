'use server'

import { revalidatePath } from 'next/cache'
import { startOfMonth, endOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import type { VisitWithLocation } from '@/types/app'

/**
 * Completed, not-yet-invoiced visits for a given month (`yyyy-MM`), joined to
 * property + account. Filters on `ended_at` — a visit only reaches
 * `status='completed'` through the completion flow, which always writes
 * `ended_at` — and hits the existing `visits_uninvoiced_idx` partial index
 * (`WHERE status='completed' AND invoiced_at IS NULL`).
 */
export async function getUninvoicedVisits(month: string): Promise<VisitWithLocation[]> {
  const supabase = await createClient()
  const monthStart = startOfMonth(new Date(`${month}-01T00:00:00`))
  const monthEnd = endOfMonth(monthStart)

  const { data, error } = await supabase
    .from('visits')
    .select('*, property:properties(*), account:accounts(*)')
    .eq('status', 'completed')
    .is('invoiced_at', null)
    .gte('ended_at', monthStart.toISOString())
    .lte('ended_at', monthEnd.toISOString())
    .order('ended_at', { ascending: true })

  if (error) {
    console.error('[getUninvoicedVisits]', error)
    return []
  }

  return (data ?? []) as unknown as VisitWithLocation[]
}

/**
 * Bulk-sets `invoiced_at` on the given visits — a stopgap manual action standing
 * in for the real QuickBooks push (task 5.4, blocked on OAuth setup). Same field
 * semantics as `hooks/crew/useSetVisitInvoiced.ts`'s single-visit toggle.
 */
export async function markVisitsInvoiced(visitIds: string[]): Promise<{ error?: string }> {
  if (visitIds.length === 0) return {}

  const supabase = await createClient()
  const { error } = await supabase
    .from('visits')
    .update({ invoiced_at: new Date().toISOString() })
    .in('id', visitIds)

  if (error) {
    console.error('[markVisitsInvoiced]', error)
    return { error: error.message }
  }

  revalidatePath('/management/billing')
  return {}
}
