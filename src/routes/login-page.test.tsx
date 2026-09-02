import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { LoginPage } from '@/routes/login-page'
import { renderWithProviders } from '@/test/render'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

describe('LoginPage', () => {
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
