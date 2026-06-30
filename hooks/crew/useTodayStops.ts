'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { getWeekStart } from '@/lib/utils/schedule'

export type TodayStop = {
  visitId: string
  visit: {
    id: string
    status: string
    crew_instruction: string | null
    week_start: string
    started_at: string | null
    ended_at: string | null
    service_types: string[] | null
    completion_note: string | null
    skip_reason: string | null
  }
  zone: {
    id: string
    name: string
    frequency: string
    sort_order: number
  }
  property: {
    id: string
    address: string
    crew_notes: string | null
    access_notes: string | null
    parking_notes: string | null
    property_route_groups: Array<{
      sort_order: number
      route_group: { id: string; name: string; sort_order: number } | null
    }>
  }
  account: {
    id: string
    name: string
    billing_type: string
  }
  photoCount: number
}

export function useTodayStops(employeeId: string | undefined) {
  return useQuery<TodayStop[]>({
    queryKey: ['crew-today-stops', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('No employee ID')

      const supabase = createClient()
      const weekStart = format(getWeekStart(new Date()), 'yyyy-MM-dd')

      // Step 1: get all visit IDs this employee is assigned to
      const { data: assignments, error: assignErr } = await supabase
        .from('visit_crew')
        .select('visit_id')
        .eq('employee_id', employeeId)
        .eq('relation', 'assigned')

      if (assignErr) throw assignErr

      const visitIds = (assignments ?? []).map((r) => r.visit_id)
      if (visitIds.length === 0) return []

      // Step 2: fetch this week's visits with all display data
      const { data: visits, error: visitErr } = await supabase
        .from('visits')
        .select(`
          id, status, crew_instruction, week_start, started_at, ended_at, service_types,
          completion_note, skip_reason,
          service_zone:service_zones!inner(id, name, frequency, sort_order),
          property:properties!inner(
            id, address, crew_notes, access_notes, parking_notes,
            property_route_groups(sort_order, route_group:route_groups(id, name, sort_order))
          ),
          account:accounts!inner(id, name, billing_type),
          photos(id)
        `)
        .eq('week_start', weekStart)
        .in('id', visitIds)

      if (visitErr) throw visitErr

      const stops: TodayStop[] = (visits ?? []).map((v) => {
        const zone = v.service_zone as unknown as TodayStop['zone']
        const property = v.property as unknown as TodayStop['property']
        const account = v.account as unknown as TodayStop['account']
        const photoCount = (v.photos as Array<{ id: string }> | null)?.length ?? 0

        return {
          visitId: v.id,
          visit: {
            id: v.id,
            status: v.status ?? 'scheduled',
            crew_instruction: v.crew_instruction,
            week_start: v.week_start,
            started_at: v.started_at,
            ended_at: v.ended_at,
            service_types: v.service_types,
            completion_note: v.completion_note,
            skip_reason: v.skip_reason,
          },
          zone,
          property,
          account,
          photoCount,
        }
      })

      // Sort: route group sort_order → property sort_order within group → zone sort_order
      return stops.sort((a, b) => {
        const aPRG = a.property.property_route_groups[0]
        const bPRG = b.property.property_route_groups[0]

        const aRGOrder = aPRG?.route_group?.sort_order ?? 999
        const bRGOrder = bPRG?.route_group?.sort_order ?? 999
        if (aRGOrder !== bRGOrder) return aRGOrder - bRGOrder

        const aPropOrder = aPRG?.sort_order ?? 999
        const bPropOrder = bPRG?.sort_order ?? 999
        if (aPropOrder !== bPropOrder) return aPropOrder - bPropOrder

        return (a.zone.sort_order ?? 0) - (b.zone.sort_order ?? 0)
      })
    },
    enabled: !!employeeId,
    staleTime: 60_000,
  })
}
