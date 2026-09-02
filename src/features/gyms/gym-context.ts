import { createContext, use } from 'react'
import type { Gym } from './queries'

export type GymScope = {
  /** The gym in view, or null for "all gyms" (admins and superadmins only). */
  gymId: string | null
  /** The gyms this user may switch between, by name. */
  options: Gym[]
  /** Whether the "all gyms" scope is available. */
  canSeeAllGyms: boolean
  /** Pass null for "all gyms". A gym outside `options` is ignored. */
  selectGym: (gymId: string | null) => void
}

export const GymContext = createContext<GymScope | null>(null)

export function useGymScope(): GymScope {
  const scope = use(GymContext)
  if (!scope) throw new Error('useGymScope must be used inside <GymProvider>')
  return scope
}
