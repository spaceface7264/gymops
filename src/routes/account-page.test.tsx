import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { i18next } from '@/lib/i18n'
import { AccountPage } from '@/routes/account-page'
import { renderWithProviders } from '@/test/render'

type Err = { message: string } | null
const signInWithPassword = vi.fn<() => Promise<{ error: Err }>>()
const updateUser = vi.fn<(attrs: Record<string, unknown>) => Promise<{ error: Err }>>()
const update = vi.fn<(values: Record<string, unknown>) => void>()
const profile = {
  id: 'user-1',
  full_name: 'Sam Staff',
  locale: 'en',
  gym_memberships: [],
}
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
        eq: () => ({ single: () => Promise.resolve({ data: profile, error: null }) }),
      }),
    }),
  },
}))

function renderPage() {
  return renderWithProviders(
    <AuthProvider>
      <AccountPage />
    </AuthProvider>,
    { path: '/account' },
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  signInWithPassword.mockResolvedValue({ error: null })
  updateUser.mockResolvedValue({ error: null })
  await i18next.changeLanguage('en')
})

describe('AccountPage', () => {
  it('starts from the stored name and saves a new one', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Full name')
    await waitFor(() => expect(name).toHaveValue('Sam Staff'))

    await user.clear(name)
    await user.type(name, 'Sam Stone')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!)

    expect(await screen.findByText('Name saved.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ full_name: 'Sam Stone' })
  })

  it('refuses an empty name without saving', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Full name')
    await waitFor(() => expect(name).toHaveValue('Sam Staff'))

    await user.clear(name)
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!)

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('saves a new language', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Full name')
    await waitFor(() => expect(name).toHaveValue('Sam Staff'))

    await user.selectOptions(screen.getByLabelText('Language'), 'da')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]!)

    await waitFor(() => expect(update).toHaveBeenCalledWith({ locale: 'da' }))
  })

  it('changes the password when the current one is right', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Full name')
    await waitFor(() => expect(name).toHaveValue('Sam Staff'))

    await user.type(screen.getByLabelText('Current password'), 'Password123')
    await user.type(screen.getByLabelText('New password'), 'Bouldering2026')
    await user.type(screen.getByLabelText('Repeat new password'), 'Bouldering2026')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]!)

    expect(await screen.findByText('Password changed.')).toBeInTheDocument()
    expect(updateUser).toHaveBeenCalledWith({ password: 'Bouldering2026' })
  })

  it('says so when the current password is wrong', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Full name')
    await waitFor(() => expect(name).toHaveValue('Sam Staff'))

    await user.type(screen.getByLabelText('Current password'), 'nope')
    await user.type(screen.getByLabelText('New password'), 'Bouldering2026')
    await user.type(screen.getByLabelText('Repeat new password'), 'Bouldering2026')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]!)

    expect(
      await screen.findByText('That is not your current password.'),
    ).toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('refuses a weak or mismatched new password before asking the server', async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText('Full name')
    await waitFor(() => expect(name).toHaveValue('Sam Staff'))

    await user.type(screen.getByLabelText('Current password'), 'Password123')
    await user.type(screen.getByLabelText('New password'), 'Bouldering2026')
    await user.type(screen.getByLabelText('Repeat new password'), 'Bouldering2027')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]!)

    expect(await screen.findByText('The two passwords do not match.')).toBeInTheDocument()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })
})
