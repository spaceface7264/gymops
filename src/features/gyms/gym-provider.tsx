import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useProfile } from '@/features/auth'
import { GymContext, type GymScope } from './gym-context'
import { useGyms, type Gym } from './queries'

const storageKey = 'gymops.gym'

/** "all gyms" is stored as this, so it survives a reload like any other choice. */
const allGyms = 'all'

function readStored(): string | null {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function writeStored(value: string) {
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // A locked-down browser is not a reason to break the switcher.
  }
}

/**
 * Holds the gym every feature reads from: managers and staff switch between the
 * gyms they belong to, admins and superadmins between all of them plus "all
 * gyms". The choice is per device, so a shared front-desk machine keeps the gym
 * it is standing in.
 */
export function GymProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile()
  const canSeeAllGyms = Boolean(profile?.is_admin || profile?.is_superadmin)
  const allGymsQuery = useGyms(canSeeAllGyms)
  const [selected, setSelected] = useState<string | null>(() => readStored())

  const options = useMemo<Gym[]>(() => {
    if (!profile) return []
    if (canSeeAllGyms) return allGymsQuery.data ?? []

    return profile.gym_memberships
      .map((membership) => membership.gyms)
      .filter((gym): gym is Gym => Boolean(gym))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [profile, canSeeAllGyms, allGymsQuery.data])

  // The stored gym can be one the user just lost access to, or one that closed.
  const gymId = useMemo(() => {
    const first = options[0]
    if (!first) return null
    if (selected && selected !== allGyms && options.some((gym) => gym.id === selected)) {
      return selected
    }
    // "All gyms" for whoever may see it; otherwise the first gym they have.
    return canSeeAllGyms ? null : first.id
  }, [selected, options, canSeeAllGyms])

  // Keep storage in step with what is actually in view.
  useEffect(() => {
    if (options.length === 0) return
    writeStored(gymId ?? allGyms)
  }, [gymId, options.length])

  const selectGym = useCallback((next: string | null) => {
    setSelected(next ?? allGyms)
  }, [])

  const value = useMemo<GymScope>(
    () => ({ gymId, options, canSeeAllGyms, selectGym }),
    [gymId, options, canSeeAllGyms, selectGym],
  )

  return <GymContext value={value}>{children}</GymContext>
}
