'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type StopDetail = {
  visitId: string
  visit: {
    id: string
    status: string
    crew_instruction: string | null
    week_start: string
    actual_date: string | null
    service_types: string[] | null
    completion_note: string | null
    skip_reason: string | null
  }
  zone: {
    id: string
    name: string
    frequency: string
    sort_order: number
    notes: string | null
  }
  property: {
    id: string
    address: string
    crew_notes: string | null
    access_notes: string | null
    parking_notes: string | null
    service_zones: Array<{
      id: string
      name: string
      frequency: string
      sort_order: number
      active: boolean
    }>
  }
  account: {
    id: string
    name: string
    billing_type: string
  }
  sessions: Array<{
    id: string
    started_at: string
    ended_at: string | null
    employee_id: string
  }>
  assignedCrew: Array<{
    employee_id: string
    name: string
  }>
  photos: Array<{
    id: string
    storage_path: string
    type: string
    created_at: string
    caption: string | null
  }>
}

export function useStopDetail(visitId: string | undefined) {
  return useQuery<StopDetail | null>({
    queryKey: ['stop-detail', visitId],
    queryFn: async () => {
      if (!visitId) return null

      const supabase = createClient()

      const { data, error } = await supabase
        .from('visits')
        .select(`
          id, status, crew_instruction, week_start, actual_date,
          service_types, completion_note, skip_reason,
          service_zone:service_zones!inner(id, name, frequency, sort_order, notes),
          property:properties!inner(
            id, address, crew_notes, access_notes, parking_notes,
            service_zones(id, name, frequency, sort_order, active)
          ),
          account:accounts!inner(id, name, billing_type),
          visit_sessions(id, started_at, ended_at, employee_id),
          visit_crew(employee_id, relation, employees(id, name)),
          photos(id, storage_path, type, created_at, caption)
        `)
        .eq('id', visitId)
        .single()

      if (error) throw error

      const zone = data.service_zone as unknown as StopDetail['zone']
      const property = data.property as unknown as StopDetail['property']
      const account = data.account as unknown as StopDetail['account']
      const sessions = (data.visit_sessions ?? []) as StopDetail['sessions']

      type RawVisitCrew = { employee_id: string; relation: string; employees: { id: string; name: string } | null }
      const assignedCrew = ((data.visit_crew ?? []) as unknown as RawVisitCrew[])
        .filter((vc) => vc.relation === 'assigned' && vc.employees)
        .map((vc) => ({ employee_id: vc.employee_id, name: vc.employees!.name }))

      const photos = (data.photos ?? []) as StopDetail['photos']

      return {
        visitId: data.id,
        visit: {
          id: data.id,
          status: data.status ?? 'scheduled',
          crew_instruction: data.crew_instruction,
          week_start: data.week_start,
          actual_date: data.actual_date,
          service_types: data.service_types,
          completion_note: data.completion_note,
          skip_reason: data.skip_reason,
        },
        zone,
        property,
        account,
        sessions,
        assignedCrew,
        photos,
      }
    },
    enabled: !!visitId,
    staleTime: 30_000,
  })
}
