import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthProvider,
  type Credentials,
  useProfile,
  useSignIn,
  useSignOut,
} from '@/features/auth'

type PostgrestError = { message: string }
type SessionResult = { data: { session: Session | null }; error: PostgrestError | null }

const signInWithPassword = vi.fn<(credentials: Credentials) => Promise<SessionResult>>()
const signOut = vi.fn<() => Promise<{ error: PostgrestError | null }>>()
const single = vi.fn<() => Promise<{ data: unknown; error: PostgrestError | null }>>()
const getSession = vi.fn<() => Promise<SessionResult>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: (credentials: Credentials) => signInWithPassword(credentials),
      signOut: () => signOut(),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => single() }) }),
    }),
  },
}))

const session = {
  access_token: 'token',
  user: { id: 'user-1', email: 'staff@gymops.test' },
} as Session

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ data: { session: null }, error: null })
})

describe('useProfile', () => {
  it('stays idle while nobody is signed in', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper })

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(single).not.toHaveBeenCalled()
  })

  it('loads the signed-in user profile with their gyms', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null })
    single.mockResolvedValue({
      data: { id: 'user-1', locale: 'da', gym_memberships: [{ role: 'staff' }] },
      error: null,
    })

    const { result } = renderHook(() => useProfile(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ id: 'user-1', locale: 'da' })
  })

  it('surfaces a Postgres error', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null })
    single.mockResolvedValue({ data: null, error: { message: 'permission denied' } })

    const { result } = renderHook(() => useProfile(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSignIn', () => {
  it('passes the credentials to Supabase', async () => {
    signInWithPassword.mockResolvedValue({ data: { session }, error: null })

    const { result } = renderHook(() => useSignIn(), { wrapper })
    result.current.mutate({ email: 'staff@gymops.test', password: 'password123' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'staff@gymops.test',
      password: 'password123',
    })
  })

  it('fails the mutation on a rejected sign-in', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    })

    const { result } = renderHook(() => useSignIn(), { wrapper })
    result.current.mutate({ email: 'staff@gymops.test', password: 'wrong' })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSignOut', () => {
  it('signs out and empties the cache', async () => {
    signOut.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useSignOut(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(signOut).toHaveBeenCalled()
  })
})
