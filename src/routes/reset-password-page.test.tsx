import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { ResetPasswordPage } from '@/routes/reset-password-page'
import { renderWithProviders } from '@/test/render'

type SessionResult = { data: { session: Session | null }; error: null }

const getSession = vi.fn<() => Promise<SessionResult>>()
const updateUser = vi.fn<() => Promise<{ error: { message: string } | null }>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      updateUser: () => updateUser(),
    },
  },
}))

const session = {
  access_token: 'token',
  user: { id: 'user-1', email: 'staff@gymops.test' },
} as Session

function renderPage() {
  return renderWithProviders(
    <AuthProvider>
      <ResetPasswordPage />
    </AuthProvider>,
    {
      path: '/reset-password',
      routes: [{ path: '/', element: <p>Signed in home</p> }],
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ data: { session }, error: null })
  updateUser.mockResolvedValue({ error: null })
})

describe('ResetPasswordPage', () => {
  it('sends the user into the app after setting a new password', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('New password'), 'Bouldering1')
    await user.type(screen.getByLabelText('Repeat new password'), 'Bouldering1')
    await user.click(screen.getByRole('button', { name: 'Save password' }))

    expect(await screen.findByText('Signed in home')).toBeInTheDocument()
    expect(updateUser).toHaveBeenCalled()
  })

  it('refuses two passwords that do not match', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('New password'), 'Bouldering1')
    await user.type(screen.getByLabelText('Repeat new password'), 'Bouldering2')
    await user.click(screen.getByRole('button', { name: 'Save password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The two passwords do not match.',
    )
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses a password that does not meet the policy', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('New password'), 'boulder1')
    await user.type(screen.getByLabelText('Repeat new password'), 'boulder1')
    await user.click(screen.getByRole('button', { name: 'Save password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That password is too weak: use at least 10 characters, with an uppercase letter, a lowercase letter and a number.',
    )
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('asks for a new link when the recovery link carried no session', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null })
    renderPage()

    expect(
      await screen.findByText('This link has expired or has already been used.'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
        'href',
        '/forgot-password',
      ),
    )
  })
})
