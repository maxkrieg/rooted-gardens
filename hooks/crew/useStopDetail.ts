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
    started_at: string | null
    ended_at: string | null
    service_types: string[] | null
    completion_note: string | null
    skip_reason: string | null
    vehicle_id: string | null
    invoiced_at: string | null
  }
  property: {
    id: string
    address: string
    frequency: string
    crew_notes: string | null
    access_notes: string | null
    parking_notes: string | null
  }
  account: {
    id: string
    name: string
    billing_type: string
    contact_name: string | null
  }
  assignedCrew: Array<{
    employee_id: string
    name: string
  }>
  completedBy: Array<{
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

export function useStopDetail(visitId: string | undefined, options?: { initialData?: StopDetail }) {
  return useQuery<StopDetail | null>({
    queryKey: ['stop-detail', visitId],
    queryFn: async () => {
      if (!visitId) return null

      const supabase = createClient()

      const { data, error } = await supabase
        .from('visits')
        .select(`
          id, status, crew_instruction, week_start, started_at, ended_at,
          service_types, completion_note, skip_reason, vehicle_id, invoiced_at,
          property:properties!inner(
            id, address, frequency, crew_notes, access_notes, parking_notes
          ),
          account:accounts!inner(id, name, billing_type, contact_name),
          visit_crew(employee_id, relation, employees(id, name)),
          photos(id, storage_path, type, created_at, caption)
        `)
        .eq('id', visitId)
        .single()

      if (error) throw error

      const property = data.property as unknown as StopDetail['property']
      const account = data.account as unknown as StopDetail['account']

      type RawVisitCrew = { employee_id: string; relation: string; employees: { id: string; name: string } | null }
      const rawCrew = (data.visit_crew ?? []) as unknown as RawVisitCrew[]
      const assignedCrew = rawCrew
        .filter((vc) => vc.relation === 'assigned' && vc.employees)
        .map((vc) => ({ employee_id: vc.employee_id, name: vc.employees!.name }))
      const completedBy = rawCrew
        .filter((vc) => vc.relation === 'completed' && vc.employees)
        .map((vc) => ({ employee_id: vc.employee_id, name: vc.employees!.name }))

      const photos = (data.photos ?? []) as StopDetail['photos']

      return {
        visitId: data.id,
        visit: {
          id: data.id,
          status: data.status ?? 'scheduled',
          crew_instruction: data.crew_instruction,
          week_start: data.week_start,
          started_at: data.started_at,
          ended_at: data.ended_at,
          service_types: data.service_types,
          completion_note: data.completion_note,
          skip_reason: data.skip_reason,
          vehicle_id: data.vehicle_id,
          invoiced_at: data.invoiced_at,
        },
        property,
        account,
        assignedCrew,
        completedBy,
        photos,
      }
    },
    enabled: !!visitId,
    staleTime: 30_000,
    ...(options?.initialData !== undefined && { initialData: options.initialData }),
  })
}
