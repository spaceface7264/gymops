import { useQuery } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Gym = Pick<
  Database['public']['Tables']['gyms']['Row'],
  'id' | 'name' | 'slug'
>

export const gymKeys = {
  all: ['gyms'] as const,
}

/**
 * Every active gym, ordered by name. `gyms_select` lets any signed-in user read
 * the list; who may *switch* to which gym is decided in `GymProvider`.
 */
export function useGyms(enabled: boolean) {
  return useQuery({
    queryKey: gymKeys.all,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gyms')
        .select('id, name, slug')
        .eq('active', true)
        .order('name')

      if (error) throw error
      return data
    },
  })
}
