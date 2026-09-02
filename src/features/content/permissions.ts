import { useMemo } from 'react'
import { useProfile } from '@/features/auth'
import { useGyms, type Gym } from '@/features/gyms'

export type PublishScope = {
  /** Company-wide news and guides are admins only (spec §2.1). */
  canPublishCompanyWide: boolean
  /** The gyms this user may publish into, by name. */
  publishableGyms: Gym[]
  canPublishIn: (gymId: string | null) => boolean
  /** Whether to offer the "new post" and "edit" controls at all. */
  canPublishSomewhere: boolean
}

/**
 * The UI half of `can_publish_content()`: an admin publishes anywhere, a
 * manager in the gyms they manage. The database refuses the same writes, so
 * this only decides what is worth showing.
 */
export function usePublishScope(): PublishScope {
  const { data: profile } = useProfile()
  const isAdmin = Boolean(profile?.is_admin || profile?.is_superadmin)
  const allGyms = useGyms(isAdmin)

  return useMemo(() => {
    const managed = (profile?.gym_memberships ?? [])
      .filter((membership) => membership.role === 'manager')
      .map((membership) => membership.gyms)
      .filter((gym): gym is Gym => Boolean(gym))

    const publishableGyms = (isAdmin ? (allGyms.data ?? []) : managed)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      canPublishCompanyWide: isAdmin,
      publishableGyms,
      canPublishIn: (gymId: string | null) =>
        gymId === null ? isAdmin : isAdmin || managed.some((gym) => gym.id === gymId),
      canPublishSomewhere: isAdmin || managed.length > 0,
    }
  }, [profile, isAdmin, allGyms.data])
}
