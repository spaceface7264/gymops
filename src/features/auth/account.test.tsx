import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthProvider,
  useAuth,
  useChangePassword,
  useUpdateLocale,
  useUpdateName,
} from '@/features/auth'

type Err = { message: string } | null
const signInWithPassword = vi.fn<() => Promise<{ error: Err }>>()
const updateUser = vi.fn<(attrs: Record<string, unknown>) => Promise<{ error: Err }>>()
const update = vi.fn<(values: Record<string, unknown>) => void>()
const session = {
  access_token: 't',
  user: { id: 'user-1', email: 'staff@gymops.test' },
} as Session

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: () => signInWithPassword(),
      updateUser: (attrs: Record<string, unknown>) => updateUser(attrs),
    },
    from: () => ({
      update: (values: Record<string, unknown>) => {
        update(values)
        return { eq: () => Promise.resolve({ error: null }) }
      },
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  signInWithPassword.mockResolvedValue({ error: null })
  updateUser.mockResolvedValue({ error: null })
})

describe('account hooks', () => {
  it('writes a new name to the profile and the auth user', async () => {
    const { result } = renderHook(() => ({ auth: useAuth(), name: useUpdateName() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.auth.status).toBe('signedIn'))
    result.current.name.mutate('Sam Stone')
    await waitFor(() => expect(result.current.name.isSuccess).toBe(true))
    expect(update).toHaveBeenCalledWith({ full_name: 'Sam Stone' })
    expect(updateUser).toHaveBeenCalledWith({ data: { full_name: 'Sam Stone' } })
  })

  it('writes a new locale to the profile and the auth user', async () => {
    const { result } = renderHook(
      () => ({ auth: useAuth(), locale: useUpdateLocale() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.auth.status).toBe('signedIn'))
    result.current.locale.mutate('en')
    await waitFor(() => expect(result.current.locale.isSuccess).toBe(true))
    expect(update).toHaveBeenCalledWith({ locale: 'en' })
    expect(updateUser).toHaveBeenCalledWith({ data: { locale: 'en' } })
  })

  it('checks the current password before setting the new one', async () => {
    const { result } = renderHook(
      () => ({ auth: useAuth(), password: useChangePassword() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.auth.status).toBe('signedIn'))
    result.current.password.mutate({ current: 'Password123', next: 'Bouldering2026' })
    await waitFor(() => expect(result.current.password.isSuccess).toBe(true))
    expect(signInWithPassword).toHaveBeenCalledTimes(1)
    expect(updateUser).toHaveBeenCalledWith({ password: 'Bouldering2026' })
  })

  it('refuses a wrong current password without touching the account', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })
    const { result } = renderHook(
      () => ({ auth: useAuth(), password: useChangePassword() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.auth.status).toBe('signedIn'))
    result.current.password.mutate({ current: 'nope', next: 'Bouldering2026' })
    await waitFor(() => expect(result.current.password.isError).toBe(true))
    expect(result.current.password.error?.message).toBe('wrong_password')
    expect(updateUser).not.toHaveBeenCalled()
  })
})
