'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchRoutesData } from '@/lib/routes/fetch'
import { scheduleReferenceKey } from '@/hooks/useManagementSchedule'

export const routesDataKey = ['routes-data'] as const

export function useRoutesData() {
  const query = useQuery({
    queryKey: routesDataKey,
    queryFn: fetchRoutesData,
    staleTime: 60_000,
  })

  const hasData = !!query.data
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isStale: query.isError && hasData,
    hasData,
  }
}

/**
 * Refresh after a route write. The actions' revalidatePath only refreshes an RSC
 * shell that no longer holds data — and route membership changes what the
 * schedule renders (its ungrouped bucket, and which group a row falls under),
 * so the schedule's reference data has to go too.
 */
export function useRefreshRoutes() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: routesDataKey })
    queryClient.invalidateQueries({ queryKey: scheduleReferenceKey })
  }, [queryClient])
}
