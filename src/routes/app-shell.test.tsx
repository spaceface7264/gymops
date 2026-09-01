import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { GymProvider } from '@/features/gyms'
import { i18next } from '@/lib/i18n'
import { AppShell } from '@/routes/app-shell'
import { renderWithProviders } from '@/test/render'

type SessionResult = { data: { session: Session | null }; error: null }
type AuthCallback = (event: string, session: Session | null) => void
type Row = Record<string, unknown>

const getSession = vi.fn<() => Promise<SessionResult>>()
const signOut = vi.fn<() => Promise<{ error: null }>>()
const single = vi.fn<() => Promise<{ data: Row | null; error: null }>>()
const gymRows = vi.fn<() => Promise<{ data: Row[]; error: null }>>()
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
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => single(),
          order: () => (table === 'gyms' ? gymRows() : single()),
        }),
      }),
    }),
  },
}))

const session = {
  access_token: 'token',
  user: { id: 'user-1', email: 'staff@gymops.test' },
} as Session

const nord = { id: 'gym-nord', name: 'Copenhagen Nord', slug: 'kbh-nord' }
const aarhus = { id: 'gym-aarhus', name: 'Aarhus C', slug: 'aarhus-c' }

function profile(overrides: Row = {}) {
  return {
    id: 'user-1',
    email: 'staff@gymops.test',
    locale: 'en',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [{ role: 'staff', gyms: nord }],
    ...overrides,
  }
}

function renderShell() {
  return renderWithProviders(
    <AuthProvider>
      <GymProvider>
        <AppShell />
      </GymProvider>
    </AuthProvider>,
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.clear()
  authCallback = null
  getSession.mockResolvedValue({ data: { session }, error: null })
  signOut.mockImplementation(() => {
    queueMicrotask(() => authCallback?.('SIGNED_OUT', null))
    return Promise.resolve({ error: null })
  })
  single.mockResolvedValue({ data: profile(), error: null })
  gymRows.mockResolvedValue({ data: [aarhus, nord], error: null })
  await i18next.changeLanguage('en')
})

afterEach(async () => {
  await i18next.changeLanguage('en')
})

describe('AppShell navigation', () => {
  it('reaches every V1 module a staff member may use', async () => {
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Sections' })

    for (const [label, href] of [
      ['Home', '/'],
      ['News', '/news'],
      ['Guides', '/guides'],
      ['Checklists', '/checklists'],
      ['Daily log', '/daily-log'],
      ['Incidents', '/incidents'],
      ['Chat', '/chat'],
    ] as const) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  it('keeps Admin out of the nav for staff', async () => {
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Sections' })

    expect(within(nav).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('adds Admin for a manager, who administers their own gyms', async () => {
    single.mockResolvedValue({
      data: profile({ gym_memberships: [{ role: 'manager', gyms: nord }] }),
      error: null,
    })
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Sections' })

    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Admin' })).toBeInTheDocument(),
    )
  })

  it('adds Admin for an admin', async () => {
    single.mockResolvedValue({ data: profile({ is_admin: true }), error: null })
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Sections' })

    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Admin' })).toHaveAttribute(
        'href',
        '/admin',
      ),
    )
  })
})

describe('AppShell gym switcher', () => {
  it('shows the gym as plain text when there is nothing to switch between', async () => {
    renderShell()

    expect(await screen.findByText('Copenhagen Nord')).toBeInTheDocument()
    expect(screen.queryByLabelText('Gym')).not.toBeInTheDocument()
  })

  it('lets a manager switch between their own gyms only', async () => {
    single.mockResolvedValue({
      data: profile({
        gym_memberships: [
          { role: 'manager', gyms: nord },
          { role: 'manager', gyms: aarhus },
        ],
      }),
      error: null,
    })
    const user = userEvent.setup()
    renderShell()

    const switcher = await screen.findByLabelText('Gym')
    expect(
      within(switcher).getByRole('option', { name: 'Copenhagen Nord' }),
    ).toBeInTheDocument()
    expect(
      within(switcher).queryByRole('option', { name: 'All gyms' }),
    ).not.toBeInTheDocument()

    await user.selectOptions(switcher, nord.id)

    await waitFor(() => expect(localStorage.getItem('gymops.gym')).toBe(nord.id))
  })

  it('lets an admin switch to all gyms', async () => {
    single.mockResolvedValue({
      data: profile({ is_admin: true, gym_memberships: [] }),
      error: null,
    })
    const user = userEvent.setup()
    renderShell()

    const switcher = await screen.findByLabelText('Gym')
    await waitFor(() =>
      expect(
        within(switcher).getByRole('option', { name: 'All gyms' }),
      ).toBeInTheDocument(),
    )
    await user.selectOptions(switcher, nord.id)

    await waitFor(() => expect(localStorage.getItem('gymops.gym')).toBe(nord.id))
  })
})

describe('AppShell session', () => {
  it('names the signed-in user so a shared machine shows whose session it is', async () => {
    renderShell()

    expect(await screen.findByText('staff@gymops.test')).toBeInTheDocument()
  })

  it('ends the session when sign out is used', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })

  it('follows the language on the profile', async () => {
    single.mockResolvedValue({ data: profile({ locale: 'da' }), error: null })
    renderShell()

    expect(await screen.findByRole('link', { name: 'Nyheder' })).toBeInTheDocument()
    expect(i18next.language).toBe('da')
  })
})
