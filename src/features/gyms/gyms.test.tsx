import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { GymProvider, useGymScope } from '@/features/gyms'

type SessionResult = { data: { session: Session | null }; error: null }
type Row = Record<string, unknown>

const getSession = vi.fn<() => Promise<SessionResult>>()
const single = vi.fn<() => Promise<{ data: Row | null; error: null }>>()
const gymRows = vi.fn<() => Promise<{ data: Row[]; error: null }>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => single(),
          order: () => (table === 'gyms' ? gymRows() : single()),
        }),
      }),
    }),
  },
}))

const session = { access_token: 'token', user: { id: 'user-1' } } as Session

const nord = { id: 'gym-nord', name: 'Copenhagen Nord', slug: 'kbh-nord' }
const aarhus = { id: 'gym-aarhus', name: 'Aarhus C', slug: 'aarhus-c' }
const odense = { id: 'gym-odense', name: 'Odense', slug: 'odense' }

function profile(overrides: Row = {}) {
  return {
    id: 'user-1',
    locale: 'da',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [
      { role: 'manager', gyms: nord },
      { role: 'manager', gyms: aarhus },
    ],
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GymProvider>{children}</GymProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  getSession.mockResolvedValue({ data: { session }, error: null })
  single.mockResolvedValue({ data: profile(), error: null })
  gymRows.mockResolvedValue({ data: [aarhus, nord, odense], error: null })
})

describe('useGymScope', () => {
  it('offers a manager only the gyms they belong to', async () => {
    const { result } = renderHook(() => useGymScope(), { wrapper })

    await waitFor(() => expect(result.current.options).toHaveLength(2))
    expect(result.current.options.map((gym) => gym.name)).toEqual([
      'Aarhus C',
      'Copenhagen Nord',
    ])
    expect(result.current.canSeeAllGyms).toBe(false)
  })

  it('selects the first gym when nothing is stored', async () => {
    const { result } = renderHook(() => useGymScope(), { wrapper })

    await waitFor(() => expect(result.current.gymId).toBe(aarhus.id))
  })

  it('offers an admin every gym and the all-gyms scope', async () => {
    single.mockResolvedValue({
      data: profile({ is_admin: true, gym_memberships: [] }),
      error: null,
    })

    const { result } = renderHook(() => useGymScope(), { wrapper })

    await waitFor(() => expect(result.current.options).toHaveLength(3))
    expect(result.current.canSeeAllGyms).toBe(true)
    // All gyms is the natural default for someone responsible for all of them.
    expect(result.current.gymId).toBeNull()
  })

  it('remembers the chosen gym on the next visit', async () => {
    const first = renderHook(() => useGymScope(), { wrapper })
    await waitFor(() => expect(first.result.current.gymId).toBe(aarhus.id))
    first.result.current.selectGym(nord.id)
    await waitFor(() => expect(first.result.current.gymId).toBe(nord.id))
    first.unmount()

    const second = renderHook(() => useGymScope(), { wrapper })

    await waitFor(() => expect(second.result.current.gymId).toBe(nord.id))
  })

  it('falls back to an available gym when the stored one is gone', async () => {
    localStorage.setItem('gymops.gym', 'gym-that-closed')

    const { result } = renderHook(() => useGymScope(), { wrapper })

    await waitFor(() => expect(result.current.gymId).toBe(aarhus.id))
  })

  it('refuses a gym the user has no access to', async () => {
    const { result } = renderHook(() => useGymScope(), { wrapper })
    await waitFor(() => expect(result.current.options).toHaveLength(2))

    result.current.selectGym(odense.id)

    await waitFor(() => expect(result.current.gymId).toBe(aarhus.id))
  })
})
