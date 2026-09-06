import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/features/auth'
import { GymProvider } from '@/features/gyms'
import { i18next } from '@/lib/i18n'
import { AppShell, initials } from '@/routes/app-shell'
import { renderWithProviders } from '@/test/render'

type SessionResult = { data: { session: Session | null }; error: null }
type AuthCallback = (event: string, session: Session | null) => void
type Row = Record<string, unknown>

const getSession = vi.fn<() => Promise<SessionResult>>()
const signOut = vi.fn<() => Promise<{ error: null }>>()
const single = vi.fn<() => Promise<{ data: Row | null; error: null }>>()
const gymRows = vi.fn<() => Promise<{ data: Row[]; error: null }>>()
const unreadCount = vi.fn<() => Promise<{ count: number; error: null }>>()
const chatOverview = vi.fn<() => Promise<{ data: Row[]; error: null }>>()
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
        // The header's unread badge (P5-04).
        is: () => unreadCount(),
      }),
    }),
    // The chat badge on the nav entry (P6-03).
    rpc: () => chatOverview(),
    channel: () => {
      const subscription = { on: () => subscription, subscribe: () => subscription }
      return subscription
    },
    removeChannel: vi.fn(),
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
  unreadCount.mockResolvedValue({ count: 0, error: null })
  chatOverview.mockResolvedValue({ data: [], error: null })
  await i18next.changeLanguage('en')
})

afterEach(async () => {
  await i18next.changeLanguage('en')
})

describe('a deactivated account', () => {
  it('is shown the door rather than an app with nothing in it', async () => {
    single.mockResolvedValue({ data: profile({ active: false }), error: null })
    renderShell()

    expect(
      await screen.findByText('This account has been deactivated'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('keeps the app open while the profile has not loaded', async () => {
    single.mockResolvedValue({ data: profile(), error: null })
    renderShell()

    expect(await screen.findByRole('navigation')).toBeInTheDocument()
    expect(
      screen.queryByText('This account has been deactivated'),
    ).not.toBeInTheDocument()
  })
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

  it('puts the sections after the first four behind More on a phone', async () => {
    const user = userEvent.setup()
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Sections' })

    // Four tabs and More share the bar; the rest are sidebar-only entries.
    for (const label of ['Home', 'Chat', 'Checklists', 'Daily log']) {
      expect(within(nav).getByRole('link', { name: label })).not.toHaveClass('hidden')
    }
    for (const label of ['Incidents', 'News', 'Events', 'Guides', 'Ask']) {
      expect(within(nav).getByRole('link', { name: label })).toHaveClass('hidden')
    }

    await user.click(within(nav).getByRole('button', { name: 'More' }))
    const sheet = await screen.findByRole('dialog', { name: 'More' })
    for (const [label, href] of [
      ['Incidents', '/incidents'],
      ['News', '/news'],
      ['Events', '/events'],
      ['Guides', '/guides'],
      ['Ask', '/ask'],
    ] as const) {
      expect(within(sheet).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      )
    }
    expect(within(sheet).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()

    await user.click(within(sheet).getByRole('link', { name: 'News' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument(),
    )
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

describe('AppShell chat badge', () => {
  it('counts what is unread in chat, leaving the muted channels out of it', async () => {
    chatOverview.mockResolvedValue({
      data: [
        { channel_id: 'channel-gym', unread: 3, last_message_at: null, muted: false },
        { channel_id: 'channel-loud', unread: 7, last_message_at: null, muted: true },
      ],
      error: null,
    })
    renderShell()

    const chat = await screen.findByRole('link', { name: /Chat/ })
    expect(await within(chat).findByLabelText('Chat, 3 unread')).toHaveTextContent('3')
  })

  it('shows no badge when there is nothing waiting', async () => {
    renderShell()

    const chat = await screen.findByRole('link', { name: 'Chat' })
    await waitFor(() => expect(single).toHaveBeenCalled())
    expect(within(chat).queryByLabelText(/unread/)).not.toBeInTheDocument()
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
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: i18next.t('auth.account.menu') }))

    expect(await screen.findByText('staff@gymops.test')).toBeInTheDocument()
  })

  it('ends the session when sign out is used', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: i18next.t('auth.account.menu') }))
    await user.click(
      await screen.findByRole('menuitem', { name: i18next.t('auth.signOut') }),
    )

    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })

  it('follows the language on the profile', async () => {
    single.mockResolvedValue({ data: profile({ locale: 'da' }), error: null })
    renderShell()

    expect(await screen.findByRole('link', { name: 'Nyheder' })).toBeInTheDocument()
    expect(i18next.language).toBe('da')
  })
})

describe('initials', () => {
  it('takes the first letters of the first and last name', () => {
    expect(initials('Mads Bo Hansen', 'mads@gymops.test')).toBe('MH')
  })
  it('falls back to the email when there is no name', () => {
    expect(initials(null, 'staff@gymops.test')).toBe('S')
  })
})

describe('AppShell pull-to-refresh', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has no indicator on a desktop, where the browser reloads', async () => {
    renderShell()
    await screen.findByRole('navigation', { name: 'Sections' })
    expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument()
  })

  it('mounts the indicator on a phone', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 767px)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const user = userEvent.setup()
    renderShell()
    const nav = await screen.findByRole('navigation', { name: 'Sections' })
    // The status line is always in the tree, silent until a refresh runs.
    expect(screen.getByRole('status')).toHaveTextContent('')

    // The same reload without the gesture, for a screen reader or a doubter.
    await user.click(within(nav).getByRole('button', { name: 'More' }))
    const sheet = await screen.findByRole('dialog', { name: 'More' })
    await user.click(within(sheet).getByRole('button', { name: 'Refresh' }))
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing…')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'More' })).not.toBeInTheDocument(),
    )
  })
})
