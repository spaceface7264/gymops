import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { RootLayout } from '@/routes/root-layout'
import { renderWithProviders } from '@/test/render'

type SessionResult = { data: { session: Session | null }; error: null }
type AuthCallback = (event: string, session: Session | null) => void

const getSession = vi.fn<() => Promise<SessionResult>>()
const signOut = vi.fn<() => Promise<{ error: { message: string } | null }>>()
let authCallback: AuthCallback | null = null

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: (callback: AuthCallback) => {
        authCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signOut: () => signOut(),
    },
  },
}))

const session = {
  access_token: 'token',
  user: { id: 'user-1', email: 'staff@gymops.test' },
} as Session

function renderLayout() {
  return renderWithProviders(
    <AuthProvider>
      <RootLayout />
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authCallback = null
  getSession.mockResolvedValue({ data: { session }, error: null })
  // A real signOut ends the session and tells every listener.
  signOut.mockImplementation(() => {
    queueMicrotask(() => authCallback?.('SIGNED_OUT', null))
    return Promise.resolve({ error: null })
  })
})

describe('RootLayout', () => {
  it('names the signed-in user so a shared machine shows whose session it is', async () => {
    renderLayout()

    expect(await screen.findByText('staff@gymops.test')).toBeInTheDocument()
  })

  it('ends the session when sign out is used', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })
})
