import { screen, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { useAuth } from '@/features/auth'
import { RequireAuth } from '@/features/auth'
import { renderWithProviders } from '@/test/render'

type SessionResult = { data: { session: Session | null }; error: null }
type AuthCallback = (event: string, session: Session | null) => void
type Subscription = { data: { subscription: { unsubscribe: () => void } } }

const getSession = vi.fn<() => Promise<SessionResult>>()
const onAuthStateChange = vi.fn<(callback: AuthCallback) => Subscription>()
const unsubscribe = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: (callback: AuthCallback) => onAuthStateChange(callback),
    },
  },
}))

function session(userId = 'user-1'): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: userId, email: 'staff@gymops.test' },
  } as Session
}

function emitAuthChange(next: Session | null) {
  const callback = onAuthStateChange.mock.calls.at(-1)?.[0]
  if (!callback) throw new Error('AuthProvider did not subscribe to auth changes')
  callback('TOKEN_REFRESHED', next)
}

function Probe() {
  const { status, user } = useAuth()
  return <p>{`${status}:${user?.id ?? 'none'}`}</p>
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
})

describe('AuthProvider', () => {
  it('reports the restored session once it has loaded', async () => {
    getSession.mockResolvedValue({ data: { session: session() }, error: null })

    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByText('loading:none')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('signedIn:user-1')).toBeInTheDocument())
  })

  it('reports signed out when there is no session', async () => {
    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('signedOut:none')).toBeInTheDocument())
  })

  it('follows later auth state changes', async () => {
    renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('signedOut:none')).toBeInTheDocument())

    emitAuthChange(session('user-2'))
    await waitFor(() => expect(screen.getByText('signedIn:user-2')).toBeInTheDocument())

    emitAuthChange(null)
    await waitFor(() => expect(screen.getByText('signedOut:none')).toBeInTheDocument())
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderWithProviders(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText('signedOut:none')).toBeInTheDocument())

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})

describe('RequireAuth', () => {
  it('renders nothing until the session is known', () => {
    renderWithProviders(
      <AuthProvider>
        <RequireAuth>
          <p>protected</p>
        </RequireAuth>
      </AuthProvider>,
    )

    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })

  it('renders the route for a signed-in user', async () => {
    getSession.mockResolvedValue({ data: { session: session() }, error: null })

    renderWithProviders(
      <AuthProvider>
        <RequireAuth>
          <p>protected</p>
        </RequireAuth>
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument())
  })

  it('sends a signed-out user to the login route', async () => {
    renderWithProviders(
      <AuthProvider>
        <RequireAuth>
          <p>protected</p>
        </RequireAuth>
      </AuthProvider>,
      { routes: [{ path: '/login', element: <p>login screen</p> }] },
    )

    await waitFor(() => expect(screen.getByText('login screen')).toBeInTheDocument())
    expect(screen.queryByText('protected')).not.toBeInTheDocument()
  })
})
