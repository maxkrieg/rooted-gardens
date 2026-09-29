'use client'

import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { enqueueMutation, flushMutationQueue } from '@/lib/offline/mutation-queue'
import { useRole } from '@/components/app/RoleProvider'

export type ProgressState = 'seen' | 'completed' | 'dismissed'

export interface ProgressRow {
  version: number
  state: ProgressState
  created_at: string
}

export type ProgressMap = Record<string, ProgressRow>

export const onboardingProgressKey = ['onboarding-progress'] as const

/** Higher is further along; a write never moves a row backwards at the same version. */
const RANK: Record<ProgressState, number> = { seen: 0, dismissed: 1, completed: 2 }

/** The signed-in person's onboarding rows, keyed by item_key. Persisted for offline. */
export function useOnboardingProgress() {
  const { employeeId } = useRole()
  return useQuery({
    queryKey: [...onboardingProgressKey, employeeId],
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProgressMap> => {
      const supabase = createClient()
      // Filter explicitly: an owner's RLS returns everyone's rows.
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('item_key, version, state, created_at')
        .eq('employee_id', employeeId!)
      if (error) throw error
      const map: ProgressMap = {}
      for (const row of data) {
        map[row.item_key] = {
          version: row.version,
          state: row.state as ProgressState,
          created_at: row.created_at,
        }
      }
      return map
    },
  })
}

interface MarkInput {
  key: string
  version?: number
  state: ProgressState
}

/** Record progress through the offline queue, patching the cache first. */
export function useMarkProgress() {
  const { employeeId } = useRole()
  const queryClient = useQueryClient()
  const key = [...onboardingProgressKey, employeeId]

  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: async ({ key: itemKey, version = 1, state }: MarkInput) => {
      if (!employeeId) return
      await enqueueMutation('onboarding_progress', { employeeId, itemKey, version, state })
      await flushMutationQueue()
    },
    onMutate: ({ key: itemKey, version = 1, state }) => {
      queryClient.setQueryData<ProgressMap>(key, (old = {}) => ({
        ...old,
        [itemKey]: {
          version,
          state,
          created_at: old[itemKey]?.created_at ?? new Date().toISOString(),
        },
      }))
    },
  })

  const { mutate } = mutation
  return useCallback(
    (input: MarkInput) => {
      if (!employeeId) return
      const current = queryClient.getQueryData<ProgressMap>(key)?.[input.key]
      const version = input.version ?? 1
      if (current) {
        if (current.version > version) return
        if (current.version === version && RANK[current.state] >= RANK[input.state]) return
      }
      mutate({ ...input, version })
    },
    // `key` is derived from employeeId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employeeId, mutate, queryClient],
  )
}
