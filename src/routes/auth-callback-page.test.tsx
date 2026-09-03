import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthCallbackPage } from '@/routes/auth-callback-page'
import { renderWithProviders } from '@/test/render'

const exchangeCodeForSession =
  vi.fn<() => Promise<{ error: { message: string } | null }>>()
const isDesktop = vi.fn(() => false)

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { exchangeCodeForSession: () => exchangeCodeForSession() } },
}))
vi.mock('@/lib/platform', () => ({
  isDesktop: () => isDesktop(),
  onDeepLink: () => () => {},
}))

const fragment = '#access_token=a&refresh_token=b&type=invite'

function renderPage(entry: string) {
  return renderWithProviders(<AuthCallbackPage />, {
    path: '/auth/callback',
    initialEntries: [entry],
    routes: [
      { path: '/accept-invite', element: <p>Accept invite</p> },
      { path: '/reset-password', element: <p>Reset password</p> },
      { path: '/login', element: <p>Sign in</p> },
    ],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  isDesktop.mockReturnValue(false)
  exchangeCodeForSession.mockResolvedValue({ error: null })
})

describe('AuthCallbackPage', () => {
  it('offers an invite to the desktop app or the browser', () => {
    renderPage(`/auth/callback${fragment}`)

    expect(screen.getByRole('link', { name: 'Open in the GymOps app' })).toHaveAttribute(
      'href',
      `gymops://auth/callback${fragment}`,
    )
    expect(screen.getByRole('link', { name: 'Continue in the browser' })).toHaveAttribute(
      'href',
      `/accept-invite${fragment}`,
    )
  })

  it('carries an invite straight on inside the desktop app', async () => {
    isDesktop.mockReturnValue(true)
    renderPage(`/auth/callback${fragment}`)
    expect(await screen.findByText('Accept invite')).toBeInTheDocument()
  })

  it('exchanges a recovery code and moves to the password screen', async () => {
    renderPage('/auth/callback?code=abc')
    expect(await screen.findByText('Reset password')).toBeInTheDocument()
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1)
  })

  it('says so when the code is spent', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid' } })
    renderPage('/auth/callback?code=abc')
    expect(
      await screen.findByText('This link has expired or has already been used.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument()
  })

  it('reports an error the auth server sent', () => {
    renderPage('/auth/callback#error_code=otp_expired&error_description=x')
    expect(screen.getByText(/This invite link has expired/)).toBeInTheDocument()
  })

  it('goes to sign-in when there is nothing to do', async () => {
    renderPage('/auth/callback')
    expect(await screen.findByText('Sign in')).toBeInTheDocument()
  })
})
