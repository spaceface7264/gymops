import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'

export type Profile = Database['public']['Tables']['profiles']['Row']

export type Credentials = { email: string; password: string }

export const authKeys = {
  profile: (userId: string | undefined) => ['auth', 'profile', userId] as const,
}

/**
 * The signed-in user's profile with the gyms they belong to. RLS already limits
 * the row to themselves, so no filter is needed beyond the id.
 */
export function useProfile() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: authKeys.profile(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error('No signed-in user')

      const { data, error } = await supabase
        .from('profiles')
        .select('*, gym_memberships(role, gyms(id, name, slug))')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    },
  })
}

export function useSignIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password }: Credentials) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    // Nothing in the cache survives a sign-out: every row was read under the
    // previous user's RLS context.
    onSuccess: () => queryClient.clear(),
  })
}
