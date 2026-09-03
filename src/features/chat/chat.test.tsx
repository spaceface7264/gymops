import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatPage } from '@/features/chat'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const channelRows = vi.fn<() => Row[]>()
const memberRows = vi.fn<() => Row[]>()
const overviewRows = vi.fn<() => Row[]>()
const messageRows = vi.fn<(cursor: string | null) => Row[]>()
const updated = vi.fn<(table: string, values: Row) => void>()
const inserted = vi.fn<(table: string, values: Row) => void>()
const uploaded = vi.fn<(bucket: string, path: string) => void>()
const tracked = vi.fn<(state: Row) => void>()

function builder(table: string) {
  let cursor: string | null = null

  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    // The keyset cursor: the last row already on screen, as PostgREST sees it.
    or: (filter: string) => {
      cursor = filter
      return chain
    },
    update: (values: Row) => {
      updated(table, values)
      return chain
    },
    insert: (values: Row) => {
      inserted(table, values)
      return chain
    },
    single: () => Promise.resolve({ data: { id: 'message-new' }, error: null }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rowsFor(table, cursor), error: null }).then(resolve),
  }
  return chain
}

function rowsFor(table: string, cursor: string | null): Row[] {
  if (table === 'channels') return channelRows()
  if (table === 'messages') return messageRows(cursor)
  return memberRows()
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve({ data: overviewRows(), error: null }),
    // The live sync and the typing presence (P6-04, P6-05).
    channel: () => {
      const subscription = {
        on: () => subscription,
        subscribe: () => subscription,
        track: (state: Row) => {
          tracked(state)
          return Promise.resolve('ok')
        },
        presenceState: () => ({}),
      }
      return subscription
    },
    removeChannel: vi.fn(),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string) => {
          uploaded(bucket, path)
          return Promise.resolve({ error: null })
        },
        createSignedUrl: (path: string) =>
          Promise.resolve({ data: { signedUrl: `https://signed/${path}` }, error: null }),
      }),
    },
  },
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-sam' } }),
  useProfile: () => ({ data: profile() }),
}))
vi.mock('@/features/gyms', () => ({
  useGyms: () => ({ data: [] }),
}))

// Staff by default: what a manager may take away is its own test below.
const profile = vi.fn<() => Row>()

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
  messageRows.mockReturnValue([])
  profile.mockReturnValue({
    id: 'user-sam',
    full_name: 'Sam Ruiz',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [
      { role: 'staff', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
    ],
  })
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

const message = (overrides: Row = {}): Row => ({
  id: 'message-1',
  channel_id: 'channel-nord',
  body: 'Wall 4 is taped off',
  mentions: [],
  created_at: '2026-09-03T09:00:00Z',
  edited_at: null,
  deleted_at: null,
  created_by: 'user-mette',
  author: { full_name: 'Mette Holm', email: 'mette@gymops.test' },
  message_attachments: [],
  ...overrides,
})

const openChannel = () => renderChat('/chat/channel-nord', '/chat/:channelId')

describe('the message list', () => {
  it('reads oldest at the bottom, with who said it', async () => {
    messageRows.mockReturnValue([
      message({ id: 'message-2', body: 'Thanks', created_at: '2026-09-03T09:05:00Z' }),
      message(),
    ])
    openChannel()

    const rows = await screen.findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Wall 4 is taped off')
    expect(rows[0]).toHaveTextContent('Mette Holm')
    expect(rows[1]).toHaveTextContent('Thanks')
  })

  it('renders the light markdown, and nothing else', async () => {
    messageRows.mockReturnValue([
      message({ body: '**Wall 4** is `taped` https://gymops.test/guides' }),
    ])
    openChannel()

    expect((await screen.findByText('Wall 4')).tagName).toBe('STRONG')
    expect(screen.getByText('taped').tagName).toBe('CODE')
    expect(
      screen.getByRole('link', { name: 'https://gymops.test/guides' }),
    ).toHaveAttribute('href', 'https://gymops.test/guides')
  })

  it('says a deleted message is gone rather than showing an empty line', async () => {
    messageRows.mockReturnValue([
      message({ body: '', deleted_at: '2026-09-03T10:00:00Z' }),
    ])
    openChannel()

    expect(await screen.findByText('This message was deleted.')).toBeInTheDocument()
  })

  it('offers older messages only when a full page came back, and pages by cursor', async () => {
    // A page arrives newest-first, as PostgREST returns it; the cursor for the
    // next one is therefore its last row.
    const page = Array.from({ length: 30 }, (_, index) =>
      message({
        id: `message-${index}`,
        created_at: `2026-09-03T09:${String(29 - index).padStart(2, '0')}:00Z`,
      }),
    )
    messageRows.mockImplementation((cursor) =>
      cursor ? [message({ id: 'older' })] : page,
    )
    openChannel()

    await userEvent.click(await screen.findByRole('button', { name: 'Load older' }))

    // Both halves of the keyset: older than that timestamp, or the same
    // timestamp with a lower id — a tie must not fall between two pages.
    await waitFor(() =>
      expect(messageRows).toHaveBeenCalledWith(
        'created_at.lt."2026-09-03T09:00:00Z",and(created_at.eq."2026-09-03T09:00:00Z",id.lt.message-29)',
      ),
    )
    expect(await screen.findAllByRole('listitem')).toHaveLength(31)
  })

  it('marks the channel read when it is opened', async () => {
    openChannel()

    await waitFor(() => expect(updated).toHaveBeenCalled())
    const [table, values] = updated.mock.calls[0] as [string, { last_read_at: string }]
    expect(table).toBe('channel_members')
    expect(typeof values.last_read_at).toBe('string')
  })
})

describe('editing and deleting', () => {
  it('lets somebody rewrite their own message', async () => {
    messageRows.mockReturnValue([message({ created_by: 'user-sam' })])
    openChannel()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const box = screen.getByRole('textbox', { name: 'Edit the message' })
    await userEvent.clear(box)
    await userEvent.type(box, 'Wall 4 is open again')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updated).toHaveBeenCalledWith('messages', { body: 'Wall 4 is open again' }),
    )
  })

  it('deletes by stamping deleted_at, which is what the trigger acts on', async () => {
    messageRows.mockReturnValue([message({ created_by: 'user-sam' })])
    openChannel()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(updated.mock.calls.some(([table]) => table === 'messages')).toBe(true),
    )
    const [, values] = updated.mock.calls.find(([table]) => table === 'messages') as [
      string,
      { deleted_at: string },
    ]
    expect(typeof values.deleted_at).toBe('string')
  })

  it('offers staff neither on a colleague’s message', async () => {
    messageRows.mockReturnValue([message()])
    openChannel()

    expect(await screen.findByText('Wall 4 is taped off')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('offers a manager the delete, in their own gym’s channel', async () => {
    profile.mockReturnValue({
      id: 'user-sam',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [
        { role: 'manager', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
      ],
    })
    messageRows.mockReturnValue([message()])
    openChannel()

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument()
    // Somebody else's words stay theirs, moderator or not.
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })
})

describe('the composer', () => {
  it('sends what was typed, on Enter', async () => {
    openChannel()

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Write a message' }),
      'Wall 4 is open{Enter}',
    )

    await waitFor(() =>
      expect(inserted).toHaveBeenCalledWith('messages', {
        channel_id: 'channel-nord',
        body: 'Wall 4 is open',
        mentions: [],
      }),
    )
  })

  it('starts a line on shift+Enter instead of sending', async () => {
    openChannel()

    const box = await screen.findByRole('textbox', { name: 'Write a message' })
    await userEvent.type(box, 'One{Shift>}{Enter}{/Shift}Two')

    expect(box).toHaveValue('One\nTwo')
    expect(inserted).not.toHaveBeenCalled()
  })

  it('mentions a colleague by name, and sends the person rather than the string', async () => {
    memberRows.mockReturnValue([
      {
        channel_id: 'channel-nord',
        user_id: 'user-mette',
        profiles: { full_name: 'Mette Holm', email: 'mette@gymops.test' },
      },
    ])
    openChannel()

    const box = await screen.findByRole('textbox', { name: 'Write a message' })
    await userEvent.type(box, 'Ping @Met')

    const option = await screen.findByRole('option', { name: 'Mette Holm' })
    await userEvent.click(option)
    expect(box).toHaveValue('Ping @Mette Holm ')

    await userEvent.type(box, '{Enter}')
    await waitFor(() =>
      expect(inserted).toHaveBeenCalledWith('messages', {
        channel_id: 'channel-nord',
        body: 'Ping @Mette Holm',
        mentions: ['user-mette'],
      }),
    )
  })

  it('says somebody is typing while they type', async () => {
    openChannel()

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Write a message' }),
      'W',
    )

    await waitFor(() => expect(tracked).toHaveBeenCalled())
    const [state] = tracked.mock.calls[0] as [{ name: string; typing_until: string }]
    expect(state.name).toBe('Sam Ruiz')
    expect(new Date(state.typing_until).getTime()).toBeGreaterThan(Date.now())
  })

  it('carries a file into the chat bucket, and records it against the message', async () => {
    openChannel()

    await screen.findByRole('textbox', { name: 'Write a message' })

    const file = new File(['topo'], 'wall4.png', { type: 'image/png' })
    await userEvent.upload(screen.getByTestId('chat-files'), file)
    expect(await screen.findByText('wall4.png')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(uploaded).toHaveBeenCalled())
    const [bucket, path] = uploaded.mock.calls[0] as [string, string]
    expect(bucket).toBe('chat')
    // The channel first: the storage policies resolve the permission from it.
    expect(path.startsWith('channel-nord/')).toBe(true)
    expect(path.endsWith('.png')).toBe(true)
    expect(inserted).toHaveBeenCalledWith(
      'message_attachments',
      expect.objectContaining({ message_id: 'message-new', path }),
    )
  })
})

describe('attachments on a message', () => {
  it('shows an image, and links anything else by name', async () => {
    messageRows.mockReturnValue([
      message({
        message_attachments: [
          {
            id: 'a1',
            path: 'channel-nord/topo.png',
            mime_type: 'image/png',
            size_bytes: 10,
          },
          {
            id: 'a2',
            path: 'channel-nord/rota.pdf',
            mime_type: 'application/pdf',
            size_bytes: 20,
          },
        ],
      }),
    ])
    openChannel()

    expect(await screen.findByRole('img', { name: 'Attachment' })).toHaveAttribute(
      'src',
      'https://signed/channel-nord/topo.png',
    )
    expect(screen.getByRole('link', { name: /rota.pdf/ })).toHaveAttribute(
      'href',
      'https://signed/channel-nord/rota.pdf',
    )
  })
})

describe('muting a channel', () => {
  it('silences it from the channel it is open in', async () => {
    openChannel()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Mute this channel' }),
    )

    await waitFor(() =>
      expect(
        updated.mock.calls.some(
          ([table, values]) =>
            table === 'channel_members' && (values as { muted?: boolean }).muted === true,
        ),
      ).toBe(true),
    )
  })

  it('offers to unmute one that is already silenced', async () => {
    channelRows.mockReturnValue([
      channel({
        channel_members: [{ muted: true, last_read_at: '2026-09-03T08:00:00Z' }],
      }),
    ])
    openChannel()

    const button = await screen.findByRole('button', { name: 'Unmute this channel' })
    expect(button).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(button)
    await waitFor(() =>
      expect(
        updated.mock.calls.some(
          ([table, values]) =>
            table === 'channel_members' &&
            (values as { muted?: boolean }).muted === false,
        ),
      ).toBe(true),
    )
  })
})
