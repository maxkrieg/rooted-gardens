'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { StopDetail } from '@/hooks/crew/useStopDetail'

/**
 * Toggle the invoiced flag on a completed visit. Billing state is derived from
 * `invoiced_at` (nullable), never a `visits.status` value — same convention as
 * the in-progress derived state. Direct-client, online-only, shared by both
 * surfaces (replaces the old management-only `setVisitInvoiced` Server Action —
 * the crew container can't import from a management Server Actions file, and
 * this keeps one consistent optimistic-mutation pattern). The control itself is
 * gated to owner/lead in VisitDetailContent, so only they ever call this.
 */
export function useSetVisitInvoiced(visitId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invoiced: boolean) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline')
      }

      const supabase = createClient()
      const invoicedAt = invoiced ? new Date().toISOString() : null
      const { error } = await supabase
        .from('visits')
        .update({ invoiced_at: invoicedAt })
        .eq('id', visitId)
      if (error) throw error
      return invoicedAt
    },

    onMutate: async (invoiced) => {
      await queryClient.cancelQueries({ queryKey: ['stop-detail', visitId] })
      const previous = queryClient.getQueryData<StopDetail | null>(['stop-detail', visitId])
      const invoicedAt = invoiced ? new Date().toISOString() : null

      queryClient.setQueryData<StopDetail | null>(['stop-detail', visitId], (old) =>
        old ? { ...old, visit: { ...old.visit, invoiced_at: invoicedAt } } : old
      )

      return { previous }
    },

    onError: (_err, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(['stop-detail', visitId], context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stop-detail', visitId] })
      queryClient.invalidateQueries({ queryKey: ['crew-week-schedule'] })
    },
  })
}
