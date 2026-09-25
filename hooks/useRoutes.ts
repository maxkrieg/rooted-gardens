'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchRoutesData } from '@/lib/routes/fetch'
import { scheduleReferenceKey } from '@/hooks/useManagementSchedule'
import { navUnroutedCountKey } from '@/hooks/useNavCounts'

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

/** Refresh after a route write, including schedule-reference: membership changes the schedule. */
export function useRefreshRoutes() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: routesDataKey })
    queryClient.invalidateQueries({ queryKey: scheduleReferenceKey })
    // The sidebar's unrouted badge has no realtime path — see useNavCounts.
    queryClient.invalidateQueries({ queryKey: navUnroutedCountKey })
  }, [queryClient])
}
