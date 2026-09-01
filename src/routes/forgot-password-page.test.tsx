import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { ForgotPasswordPage } from '@/routes/forgot-password-page'
import { renderWithProviders } from '@/test/render'

const resetPasswordForEmail =
  vi.fn<() => Promise<{ error: { message: string } | null }>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      resetPasswordForEmail: () => resetPasswordForEmail(),
    },
  },
}))

function renderPage() {
  return renderWithProviders(
    <AuthProvider>
      <ForgotPasswordPage />
    </AuthProvider>,
    { path: '/forgot-password' },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForgotPasswordPage', () => {
  it('confirms the mail was sent without revealing whether the account exists', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'staff@gymops.test')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() =>
      expect(
        screen.getByText(
          'If that address belongs to a GymOps account, a reset link is on its way.',
        ),
      ).toBeInTheDocument(),
    )
    expect(resetPasswordForEmail).toHaveBeenCalled()
  })

  it('reports a request that Supabase rejected', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'rate limited' } })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Email'), 'staff@gymops.test')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The reset link could not be sent. Try again in a moment.',
    )
  })
})
