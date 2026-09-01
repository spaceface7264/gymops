import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gymKeys } from '@/features/gyms'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type AdminGym = Database['public']['Tables']['gyms']['Row']

/** What the gym form collects; the rest of the row is defaulted or audited. */
export type GymInput = {
  name: string
  slug: string
  city: string | null
  timezone: string
}

export const adminKeys = {
  gyms: ['admin', 'gyms'] as const,
}

/**
 * Every gym including the deactivated ones — the switcher's `useGyms` hides
 * those, but the admin screen is where they are brought back.
 */
export function useAdminGyms() {
  return useQuery({
    queryKey: adminKeys.gyms,
    queryFn: async () => {
      const { data, error } = await supabase.from('gyms').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

/**
 * Gym writes are superadmin-only (`gyms_insert`/`gyms_update`); the UI hides
 * them from everyone else, and RLS refuses them if it does not.
 */
function useGymWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.gyms }),
        // The gym switcher reads its own list.
        queryClient.invalidateQueries({ queryKey: gymKeys.all }),
      ])
    },
  })
}

export function useCreateGym() {
  return useGymWrite(async (input: GymInput) => {
    const { error } = await supabase.from('gyms').insert(input)
    if (error) throw error
  })
}

export function useUpdateGym() {
  return useGymWrite(async ({ id, ...input }: GymInput & { id: string }) => {
    const { error } = await supabase.from('gyms').update(input).eq('id', id)
    if (error) throw error
  })
}

/** Gyms are deactivated, never deleted: their history stays readable. */
export function useSetGymActive() {
  return useGymWrite(async ({ id, active }: { id: string; active: boolean }) => {
    const { error } = await supabase.from('gyms').update({ active }).eq('id', id)
    if (error) throw error
  })
}
