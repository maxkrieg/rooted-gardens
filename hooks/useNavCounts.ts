'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export const navLeadCountKey = ['nav-lead-count'] as const
export const navUnroutedCountKey = ['nav-unrouted-count'] as const

/**
 * Sidebar badge counts, cached rather than server-fetched.
 *
 * These used to be three extra round-trips in app/management/layout.tsx on every
 * navigation, existing only to avoid a flash of "0" while the client query ran.
 * The persisted cache plus the hydration gate solves that better, and offline
 * these hold their last known value instead of hanging.
 */
export function useNewLeadCount(role: string | null | undefined) {
  const enabled = role === 'owner' || role === 'lead'

  return useQuery({
    queryKey: navLeadCountKey,
    queryFn: async () => {
      const supabase = createClient()
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new')
      if (error) throw error
      return count ?? 0
    },
    enabled,
    staleTime: 60_000,
  })
}

/**
 * Refreshed by the writes that move it (useRefreshRoutes, useRefreshAccounts),
 * not by realtime: `property_route_groups` and `properties` are NOT in the
 * supabase_realtime publication, so the channel this used to rely on could never
 * fire. It only looked live because the layout re-fetched the count server-side
 * on every navigation.
 */
export function useUnroutedCount() {
  return useQuery({
    queryKey: navUnroutedCountKey,
    queryFn: async () => {
      const supabase = createClient()
      // property_route_groups holds at most one row per property, so unrouted is
      // properties − routed: two head counts instead of an anti-join.
      const [propertiesCount, routedCount] = await Promise.all([
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('is_archived', false),
        supabase.from('property_route_groups').select('property_id', { count: 'exact', head: true }),
      ])
      if (propertiesCount.error) throw propertiesCount.error
      if (routedCount.error) throw routedCount.error
      return Math.max((propertiesCount.count ?? 0) - (routedCount.count ?? 0), 0)
    },
    staleTime: 60_000,
  })
}
