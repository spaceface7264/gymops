import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthProvider,
  useAuth,
  type Credentials,
  useCompleteInvite,
  useProfile,
  useRequestPasswordReset,
  useSetPassword,
  useSignIn,
  useSignOut,
} from '@/features/auth'

type PostgrestError = { message: string }
type SessionResult = { data: { session: Session | null }; error: PostgrestError | null }

const signInWithPassword = vi.fn<(credentials: Credentials) => Promise<SessionResult>>()
const signOut = vi.fn<() => Promise<{ error: PostgrestError | null }>>()
const single = vi.fn<() => Promise<{ data: unknown; error: PostgrestError | null }>>()
const getSession = vi.fn<() => Promise<SessionResult>>()
const resetPasswordForEmail =
  vi.fn<
    (
      email: string,
      options?: { redirectTo?: string },
    ) => Promise<{ error: PostgrestError | null }>
  >()
const updateUser =
  vi.fn<
    (attributes: {
      password?: string
      data?: Record<string, unknown>
    }) => Promise<{ error: PostgrestError | null }>
  >()
const update = vi.fn<
  (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<{ error: PostgrestError | null }>
  }
>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: (credentials: Credentials) => signInWithPassword(credentials),
      signOut: () => signOut(),
      resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) =>
        resetPasswordForEmail(email, options),
      updateUser: (attributes: { password?: string; data?: Record<string, unknown> }) =>
        updateUser(attributes),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => single() }) }),
      update: (values: Record<string, unknown>) => update(values),
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
  update.mockReturnValue({ eq: () => Promise.resolve({ error: null }) })
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

describe('useRequestPasswordReset', () => {
  it('asks Supabase to mail a link back to the reset screen', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper })
    result.current.mutate('staff@gymops.test')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(resetPasswordForEmail).toHaveBeenCalledWith('staff@gymops.test', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('fails the mutation when Supabase rejects the request', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'rate limited' } })

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper })
    result.current.mutate('staff@gymops.test')

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSetPassword', () => {
  it('updates the password of the recovery session', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null })
    updateUser.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useSetPassword(), { wrapper })
    result.current.mutate('a-new-password')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(updateUser).toHaveBeenCalledWith({ password: 'a-new-password' })
  })

  it('fails the mutation when the link no longer carries a session', async () => {
    updateUser.mockResolvedValue({ error: { message: 'Auth session missing!' } })

    const { result } = renderHook(() => useSetPassword(), { wrapper })
    result.current.mutate('a-new-password')

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCompleteInvite', () => {
  it('sets the password and writes the name and locale to the profile', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null })
    updateUser.mockResolvedValue({ error: null })
    const eq = vi.fn(() => Promise.resolve({ error: null }))
    update.mockReturnValue({ eq })

    const { result } = renderHook(
      () => ({ auth: useAuth(), invite: useCompleteInvite() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.auth.status).toBe('signedIn'))
    result.current.invite.mutate({
      password: 'password123',
      fullName: 'Ida Staff',
      locale: 'da',
    })

    await waitFor(() => expect(result.current.invite.isSuccess).toBe(true))
    expect(updateUser).toHaveBeenCalledWith({
      password: 'password123',
      data: { full_name: 'Ida Staff', locale: 'da' },
    })
    expect(update).toHaveBeenCalledWith({ full_name: 'Ida Staff', locale: 'da' })
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('fails when the invite link produced no session', async () => {
    const { result } = renderHook(() => useCompleteInvite(), { wrapper })
    result.current.mutate({
      password: 'password123',
      fullName: 'Ida Staff',
      locale: 'da',
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(updateUser).not.toHaveBeenCalled()
  })
})
