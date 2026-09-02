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
  users: (gymId: string | null) => ['admin', 'users', gymId] as const,
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

export type AdminUser = Database['public']['Tables']['profiles']['Row'] & {
  gym_memberships: {
    role: Database['public']['Enums']['gym_role']
    gyms: { id: string; name: string } | null
  }[]
}

const userColumns = '*, gym_memberships(role, gyms(id, name))'

/**
 * The people the signed-in user may see: everyone for an admin, the members of
 * their own gyms for a manager (`profiles_select`). `gymId` narrows that to one
 * gym — the shell's switcher is the filter, so there is no second gym control.
 */
export function useAdminUsers(gymId: string | null) {
  return useQuery({
    queryKey: adminKeys.users(gymId),
    queryFn: async () => {
      // An inner join on the gym drops the users who are not in it, and with it
      // the admins, who hold no membership anywhere. That is the intent: "who
      // works at this gym", not "who can see this gym".
      const query = gymId
        ? supabase
            .from('profiles')
            .select('*, gym_memberships!inner(role, gyms(id, name))')
            .eq('gym_memberships.gym_id', gymId)
        : supabase.from('profiles').select(userColumns)

      const { data, error } = await query.order('full_name', { nullsFirst: false })
      if (error) throw error
      return data
    },
  })
}

/**
 * Only an admin may deactivate someone: `guard_profile_privileges` raises if
 * anyone else touches `active`, so the button is admin-only in the UI too.
 */
export function useSetUserActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('profiles').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export type Membership = { gymId: string; role: Database['public']['Enums']['gym_role'] }

function useUserWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

/**
 * Grant a gym role or change one. `gym_memberships` is unique on
 * (user_id, gym_id), so an upsert covers both; the audit trigger from P2-06
 * records which of the two it was.
 */
export function useSetMembership() {
  return useUserWrite(
    async ({ userId, gymId, role }: Membership & { userId: string }) => {
      const { error } = await supabase
        .from('gym_memberships')
        .upsert(
          { user_id: userId, gym_id: gymId, role },
          { onConflict: 'user_id,gym_id' },
        )
      if (error) throw error
    },
  )
}

export function useRemoveMembership() {
  return useUserWrite(async ({ userId, gymId }: { userId: string; gymId: string }) => {
    const { error } = await supabase
      .from('gym_memberships')
      .delete()
      .eq('user_id', userId)
      .eq('gym_id', gymId)
    if (error) throw error
  })
}

/** Only a superadmin may promote or demote an admin (`guard_profile_privileges`). */
export function useSetAdmin() {
  return useUserWrite(async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: isAdmin })
      .eq('id', id)
    if (error) throw error
  })
}

export type AuditEntry = Database['public']['Tables']['audit_log']['Row']

/** The audit log, newest first. `audit_log_select` limits this to superadmins. */
export function useAuditLog() {
  return useQuery({
    queryKey: ['admin', 'audit'] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data
    },
  })
}

export type InviteInput = {
  email: string
  fullName: string
  /** Company-wide admin: no gym, no gym role. Superadmins only. */
  asAdmin: boolean
  gymId?: string
  role?: Database['public']['Enums']['gym_role']
}

/** What the `invite` function refuses with; anything else is a bug or an outage. */
export type InviteProblem = 'forbidden' | 'already_a_user' | 'unknown'

export class InviteError extends Error {
  problem: InviteProblem

  constructor(problem: InviteProblem) {
    super(problem)
    this.name = 'InviteError'
    this.problem = problem
  }
}

async function readProblem(error: unknown): Promise<InviteProblem> {
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context
  if (!context?.json) return 'unknown'

  const body: unknown = await context.json().catch(() => null)
  const code = (body as { error?: unknown } | null)?.error
  return code === 'forbidden' || code === 'already_a_user' ? code : 'unknown'
}

/**
 * Invites go through the Edge Function (P2-03): it holds the service-role key
 * that `inviteUserByEmail` needs, and it applies the gym membership the invite
 * promises. The client never writes `invites` directly.
 */
export function useInviteUser() {
  const queryClient = useQueryClient()

  return useMutation<{ userId: string }, InviteError, InviteInput>({
    mutationFn: async (input) => {
      const result = await supabase.functions.invoke<{ userId: string }>('invite', {
        body: input,
      })

      if (result.error) throw new InviteError(await readProblem(result.error))
      if (!result.data) throw new InviteError('unknown')
      return result.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}
