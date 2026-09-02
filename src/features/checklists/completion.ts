import { useMemo } from 'react'
import { useProfile } from '@/features/auth'

/**
 * The UI half of `can_complete_in()`: ticking a checklist needs membership of
 * that gym in any role, or the admin flag. The database refuses the same
 * writes, so this only decides what is worth offering.
 */
export function useCompletionScope() {
  const { data: profile } = useProfile()

  return useMemo(() => {
    const isAdmin = Boolean(profile?.is_admin || profile?.is_superadmin)
    const memberOf = new Set(
      (profile?.gym_memberships ?? []).map((membership) => membership.gyms?.id),
    )

    return {
      canCompleteIn: (gymId: string | null) =>
        isAdmin || (gymId !== null && memberOf.has(gymId)),
    }
  }, [profile])
}
