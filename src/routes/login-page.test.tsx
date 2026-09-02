import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { LoginPage } from '@/routes/login-page'
import { renderWithProviders } from '@/test/render'

const signInWithPassword = vi.fn<() => Promise<{ data: unknown; error: unknown }>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: () => signInWithPassword(),
    },
  },
}))

async function signIn() {
  renderWithProviders(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
    { path: '/login' },
  )

  await userEvent.type(await screen.findByLabelText('Email'), 'staff@gymops.test')
  await userEvent.type(screen.getByLabelText('Password'), 'Password123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage', () => {
  it('says an account is deactivated instead of blaming the password', async () => {
    // A deactivated profile is banned in GoTrue, which answers `user_banned`.
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'user_banned', message: 'User is banned' },
    })
    await signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account has been deactivated',
    )
  })

  it('still blames the credentials for an ordinary refusal', async () => {
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    await signIn()

    expect(await screen.findByRole('alert')).not.toHaveTextContent('deactivated')
  })

  it('links to the forgot-password screen', async () => {
    renderWithProviders(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
      { path: '/login' },
    )

    expect(
      await screen.findByRole('link', { name: 'Forgot your password?' }),
    ).toHaveAttribute('href', '/forgot-password')
  })
})
