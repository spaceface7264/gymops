import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { i18next } from '@/lib/i18n'
import { AcceptInvitePage } from '@/routes/accept-invite-page'
import { renderWithProviders } from '@/test/render'

type SessionResult = { data: { session: Session | null }; error: null }

const getSession = vi.fn<() => Promise<SessionResult>>()
const updateUser = vi.fn<() => Promise<{ error: { message: string } | null }>>()
const update = vi.fn<(values: Record<string, unknown>) => unknown>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      updateUser: () => updateUser(),
    },
    from: () => ({
      update: (values: Record<string, unknown>) => {
        update(values)
        return { eq: () => Promise.resolve({ error: null }) }
      },
    }),
  },
}))

const session = {
  access_token: 'token',
  user: { id: 'user-1', email: 'newcomer@gymops.test' },
} as Session

function renderPage() {
  return renderWithProviders(
    <AuthProvider>
      <AcceptInvitePage />
    </AuthProvider>,
    {
      path: '/accept-invite',
      routes: [{ path: '/', element: <p>Signed in home</p> }],
    },
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ data: { session }, error: null })
  updateUser.mockResolvedValue({ error: null })
  await i18next.changeLanguage('en')
})

describe('AcceptInvitePage', () => {
  it('saves the name, locale and password, then opens the app', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Full name'), 'Ida Staff')
    await user.selectOptions(screen.getByLabelText('Language'), 'da')
    await user.type(screen.getByLabelText('Password'), 'Bouldering1')
    await user.type(screen.getByLabelText('Repeat password'), 'Bouldering1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Signed in home')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ full_name: 'Ida Staff', locale: 'da' })
  })

  it('switches the interface to the language the newcomer picked', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Full name'), 'Ida Staff')
    await user.selectOptions(screen.getByLabelText('Language'), 'da')
    await user.type(screen.getByLabelText('Password'), 'Bouldering1')
    await user.type(screen.getByLabelText('Repeat password'), 'Bouldering1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Signed in home')).toBeInTheDocument()
    expect(i18next.language).toBe('da')
  })

  it('asks for a new invite when the link carried no session', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null })
    renderPage()

    expect(
      await screen.findByText(
        'This invite link has expired. Ask an administrator for a new one.',
      ),
    ).toBeInTheDocument()
  })
})
