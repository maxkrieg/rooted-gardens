'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Employee } from '@/types/app'

export function useCurrentEmployee() {
  return useQuery<Employee>({
    queryKey: ['current-employee'],
    queryFn: async () => {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      return data as Employee
    },
    staleTime: 5 * 60 * 1000,
  })
}
