import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { isDesktop } from '@/lib/platform'
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

/**
 * Mails a recovery link. On the web it lands on `/reset-password`, where the
 * Supabase client exchanges its `code` for a short-lived session (PKCE). The
 * desktop app asks for `gymops://auth/callback` instead (P7-02): the PKCE
 * verifier is in this client's storage, so the link can only be finished here,
 * and the deep link brings it back.
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: isDesktop()
          ? 'gymops://auth/callback'
          : `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    },
  })
}

/**
 * Exchanges a recovery link's `code` for a session (P7-02). The client does
 * this itself when the code is in the page URL at start-up; a deep link
 * arrives into a running app, so the callback screen asks explicitly.
 */
export function useExchangeCode(code: string | null) {
  return useQuery({
    queryKey: ['auth', 'exchange', code],
    queryFn: async () => {
      if (!code) throw new Error('No code to exchange')
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
      return true
    },
    enabled: code !== null,
    retry: false,
    staleTime: Infinity,
  })
}

/** Sets a new password for the session a recovery link established. */
export function useSetPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  })
}

export type InviteCompletion = {
  password: string
  fullName: string
  locale: Profile['locale']
}

/**
 * Finishes an invite: password on the auth user, name and locale on the
 * profile `handle_new_user` created when the invite was issued. Gym membership
 * and the admin flag come from the `invites` row and are applied by the
 * `invite` Edge Function (P2-03), not here.
 */
export function useCompleteInvite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ password, fullName, locale }: InviteCompletion) => {
      if (!user) throw new Error('No invited user session')

      const { error } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName, locale },
      })
      if (error) throw error

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, locale })
        .eq('id', user.id)
      if (profileError) throw profileError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
  })
}
