import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatPage } from '@/features/chat'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const channelRows = vi.fn<() => Row[]>()
const memberRows = vi.fn<() => Row[]>()
const overviewRows = vi.fn<() => Row[]>()

function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: table === 'channels' ? channelRows() : memberRows(),
        error: null,
      }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve({ data: overviewRows(), error: null }),
  },
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-sam' } }),
}))

const channel = (overrides: Row = {}): Row => ({
  id: 'channel-nord',
  kind: 'gym',
  gym_id: 'gym-nord',
  name: 'Copenhagen Nord',
  description: null,
  is_private: false,
  channel_members: [{ muted: false, last_read_at: '2026-09-03T08:00:00Z' }],
  ...overrides,
})

const activity = (overrides: Row = {}): Row => ({
  channel_id: 'channel-nord',
  unread: 0,
  last_message_at: null,
  muted: false,
  ...overrides,
})

function renderChat(path = '/chat', route = '/chat') {
  return renderWithProviders(<ChatPage />, { path: route, initialEntries: [path] })
}

beforeEach(() => {
  vi.clearAllMocks()
  channelRows.mockReturnValue([channel()])
  memberRows.mockReturnValue([])
  overviewRows.mockReturnValue([activity()])
})

describe('the channel list', () => {
  it('groups the gyms, the custom channels and the direct messages', async () => {
    channelRows.mockReturnValue([
      channel(),
      channel({ id: 'channel-company', kind: 'company', gym_id: null, name: 'Company' }),
      channel({ id: 'channel-setting', kind: 'custom', name: 'Route setting' }),
      channel({
        id: 'channel-dm',
        kind: 'dm',
        gym_id: null,
        name: null,
        is_private: true,
      }),
    ])
    memberRows.mockReturnValue([
      {
        channel_id: 'channel-dm',
        user_id: 'user-mette',
        profiles: { full_name: 'Mette Holm', email: 'mette@gymops.test' },
      },
      {
        channel_id: 'channel-dm',
        user_id: 'user-sam',
        profiles: { full_name: 'Sam Ruiz', email: 'sam@gymops.test' },
      },
    ])

    renderChat()

    const gyms = await screen.findByRole('region', { name: 'Gyms' })
    expect(
      within(gyms).getByRole('link', { name: /Copenhagen Nord/ }),
    ).toBeInTheDocument()
    expect(within(gyms).getByRole('link', { name: /Company/ })).toBeInTheDocument()

    const custom = screen.getByRole('region', { name: 'Channels' })
    expect(
      within(custom).getByRole('link', { name: /Route setting/ }),
    ).toBeInTheDocument()

    // A DM is named by whoever else is in it, never by the reader themselves.
    // Its name arrives with the member list, one query after the channels.
    const dms = screen.getByRole('region', { name: 'Direct messages' })
    expect(
      await within(dms).findByRole('link', { name: /Mette Holm/ }),
    ).toBeInTheDocument()
    expect(within(dms).queryByText(/Sam Ruiz/)).not.toBeInTheDocument()
  })

  it('badges a channel with what has been said since it was last read', async () => {
    overviewRows.mockReturnValue([activity({ unread: 4 })])
    renderChat()

    const link = await screen.findByRole('link', { name: /Copenhagen Nord/ })
    expect(within(link).getByLabelText('4 unread')).toHaveTextContent('4')
  })

  it('marks a muted channel, and still shows what it missed', async () => {
    channelRows.mockReturnValue([
      channel({
        channel_members: [{ muted: true, last_read_at: '2026-09-03T08:00:00Z' }],
      }),
    ])
    overviewRows.mockReturnValue([activity({ unread: 2, muted: true })])
    renderChat()

    const link = await screen.findByRole('link', { name: /Copenhagen Nord/ })
    expect(within(link).getByLabelText('Muted')).toBeInTheDocument()
    expect(within(link).getByLabelText('2 unread')).toBeInTheDocument()
  })

  it('says so when there is nothing to show', async () => {
    channelRows.mockReturnValue([])
    overviewRows.mockReturnValue([])
    renderChat()

    expect(
      await screen.findByText('You are not in any channels yet.'),
    ).toBeInTheDocument()
  })
})

describe('picking a channel', () => {
  it('opens it with its name, and a way back on a phone', async () => {
    channelRows.mockReturnValue([channel({ description: 'Everything at Nord' })])
    renderChat('/chat/channel-nord', '/chat/:channelId')

    expect(
      await screen.findByRole('heading', { name: 'Copenhagen Nord' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Everything at Nord')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All channels' })).toBeInTheDocument()
  })

  it('asks for one when none is picked', async () => {
    renderChat()

    expect(await screen.findByText('Pick a channel to read it.')).toBeInTheDocument()
  })
})
