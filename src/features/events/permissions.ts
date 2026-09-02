import { useMemo } from 'react'
import { useProfile } from '@/features/auth'
import { useGyms, type Gym } from '@/features/gyms'

export type EventScope = {
  /** The UI half of `is_admin()`: admins and superadmins, nobody else. */
  canManageEvents: boolean
  /** The gyms an event can be put in. Empty until `canManageEvents`. */
  scopableGyms: Gym[]
}

/**
 * Events are the one content module a manager does not write in their own gym
 * (spec §2.1): the calendar is run centrally, so this is `is_admin()` rather
 * than `usePublishScope`. The database refuses the same writes; this only
 * decides what is worth showing.
 */
export function useEventScope(): EventScope {
  const { data: profile } = useProfile()
  const canManageEvents = Boolean(profile?.is_admin || profile?.is_superadmin)
  const gyms = useGyms(canManageEvents)

  return useMemo(
    () => ({
      canManageEvents,
      scopableGyms: canManageEvents
        ? (gyms.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
        : [],
    }),
    [canManageEvents, gyms.data],
  )
}
