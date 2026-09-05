import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatPage } from '@/features/chat'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const channelRows = vi.fn<() => Row[]>()
const memberRows = vi.fn<() => Row[]>()
const overviewRows = vi.fn<() => Row[]>()
const profileRows = vi.fn<() => Row[]>()
const startedDm = vi.fn<(args: Row) => void>()
const messageRows = vi.fn<(cursor: string | null) => Row[]>()
const updated = vi.fn<(table: string, values: Row) => void>()
const inserted = vi.fn<(table: string, values: Row) => void>()
const deleted = vi.fn<(table: string, filters: [string, unknown][]) => void>()
const uploaded = vi.fn<(bucket: string, path: string) => void>()
const tracked = vi.fn<(state: Row) => void>()
const invoked = vi.fn<(name: string, options: Row) => Promise<Row>>()
// What the next insert answers, and what the socket says when it is joined.
const failing = { insert: false }
// A gate an insert waits at, so the pending line can be looked at.
const slow = { insert: null as Promise<void> | null }
const socket = { status: 'SUBSCRIBED' }

function builder(table: string) {
  let cursor: string | null = null
  let deleting = false
  const filters: [string, unknown][] = []

  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push([column, value])
      return chain
    },
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
    delete: () => {
      deleting = true
      return chain
    },
    single: async () => {
      if (slow.insert) await slow.insert
      return failing.insert
        ? { data: null, error: { message: 'insert failed' } }
        : { data: { id: `${table}-new` }, error: null }
    },
    then: (resolve: (value: unknown) => unknown) => {
      if (deleting) deleted(table, filters)
      return Promise.resolve({ data: rowsFor(table, cursor), error: null }).then(resolve)
    },
  }
  return chain
}

function rowsFor(table: string, cursor: string | null): Row[] {
  if (table === 'channels') return channelRows()
  if (table === 'messages') return messageRows(cursor)
  if (table === 'profiles') return profileRows()
  return memberRows()
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (name: string, args: Row) => {
      if (name === 'start_dm') {
        startedDm(args)
        return Promise.resolve({ data: 'channel-dm-new', error: null })
      }
      return Promise.resolve({ data: overviewRows(), error: null })
    },
    // The live sync and the typing presence (P6-04, P6-05).
    channel: () => {
      const subscription = {
        on: () => subscription,
        subscribe: (report?: (status: string) => void) => {
          report?.(socket.status)
          return subscription
        },
        track: (state: Row) => {
          tracked(state)
          return Promise.resolve('ok')
        },
        presenceState: () => ({}),
      }
      return subscription
    },
    removeChannel: vi.fn(),
    // The assistant (P8-05) is asked through its Edge Function.
    functions: { invoke: (name: string, options: Row) => invoked(name, options) },
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
  // `user_id` is what tells "the channels I am in" from "the ones I could
  // join" (P6-07); the membership flags are P6-03's.
  channel_members: [
    { user_id: 'user-sam', muted: false, last_read_at: '2026-09-03T08:00:00Z' },
  ],
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
  failing.insert = false
  slow.insert = null
  socket.status = 'SUBSCRIBED'
  sessionStorage.clear()
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
  profileRows.mockReturnValue([])
  overviewRows.mockReturnValue([activity()])
  invoked.mockResolvedValue({ data: { message_id: 'messages-reply' }, error: null })
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
    const dms = screen.getByRole('region', { name: 'Conversations' })
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
    expect(within(link).getByText('Muted')).toBeInTheDocument()
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
    // Named by host and path; the address itself is the href and the title.
    const link = screen.getByRole('link', { name: 'gymops.test/guides' })
    expect(link).toHaveAttribute('href', 'https://gymops.test/guides')
    expect(link).toHaveAttribute('title', 'https://gymops.test/guides')
  })

  it('cuts the day into headings, and names somebody once for lines said together', async () => {
    const today = new Date()
    const at = (minutes: number) =>
      new Date(today.getTime() - minutes * 60_000).toISOString()
    messageRows.mockReturnValue([
      message({ id: 'message-3', body: 'Third', created_at: at(1) }),
      message({ id: 'message-2', body: 'Second', created_at: at(2) }),
      // Far enough back to be a date in every timezone CI runs in, not
      // "Yesterday".
      message({ id: 'message-1', body: 'First', created_at: '2026-08-20T09:00:00Z' }),
    ])
    openChannel()

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /August/ })).toBeInTheDocument()
    // Two lines by Mette a minute apart show her name once; the second
    // keeps it for a screen reader only.
    const rows = screen.getAllByRole('listitem')
    expect(rows[1]).toHaveTextContent('Mette Holm')
    expect(rows[1]?.querySelector('.sr-only')).toBeNull()
    expect(rows[2]?.querySelector('.sr-only')).toHaveTextContent('Mette Holm')
    expect(rows[2]).toHaveTextContent('Third')
  })

  it('draws the New line before the first line said since it was last read', async () => {
    messageRows.mockReturnValue([
      message({ id: 'message-2', body: 'After', created_at: '2026-09-03T09:00:00Z' }),
      message({ id: 'message-1', body: 'Before', created_at: '2026-09-03T07:00:00Z' }),
    ])
    openChannel()

    const marker = await screen.findByRole('separator', { name: 'New' })
    expect(marker.nextElementSibling).toHaveTextContent('After')
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

describe('mentions and files in the stream', () => {
  it('sets a picked name in the accent and says so, and leaves a typed @ plain', async () => {
    memberRows.mockReturnValue([
      {
        channel_id: 'channel-nord',
        user_id: 'user-sam',
        profiles: { full_name: 'Sam Ruiz', email: 'sam@gymops.test' },
      },
    ])
    messageRows.mockReturnValue([
      message({ id: 'message-2', body: '@Nobody can you look?', mentions: [] }),
      message({ body: '@Sam Ruiz can you look?', mentions: ['user-sam'] }),
    ])
    openChannel()

    const named = await screen.findByText('@Sam Ruiz')
    expect(named).toHaveClass('text-accent-foreground')
    expect(screen.getByText(/Mentions you/)).toBeInTheDocument()
    expect(screen.queryByText('@Nobody')).not.toBeInTheDocument()
  })

  it('names a file as it was called, not by its path', async () => {
    messageRows.mockReturnValue([
      message({
        message_attachments: [
          {
            id: 'att-1',
            path: 'channel-nord/3f9a0c2e.pdf',
            file_name: 'Closing handover.pdf',
            mime_type: 'application/pdf',
            size_bytes: 1024,
          },
        ],
      }),
    ])
    openChannel()

    expect(
      await screen.findByRole('link', { name: 'Closing handover.pdf' }),
    ).toBeInTheDocument()
  })
})

describe('a direct message', () => {
  it('reads as bubbles, the other person on the left with a name and yours on the right', async () => {
    channelRows.mockReturnValue([
      channel({ id: 'channel-dm', kind: 'dm', gym_id: null, name: null }),
    ])
    memberRows.mockReturnValue([
      {
        channel_id: 'channel-dm',
        user_id: 'user-mette',
        profiles: { full_name: 'Mette Holm', email: 'mette@gymops.test' },
      },
    ])
    messageRows.mockReturnValue([
      message({
        id: 'message-2',
        body: 'Sunday works',
        created_by: 'user-sam',
        created_at: '2026-09-03T09:20:00Z',
      }),
      message({ body: 'Swap Saturday?', channel_id: 'channel-dm' }),
    ])
    renderChat('/chat/channel-dm', '/chat/:channelId')

    const theirs = (await screen.findByText('Swap Saturday?')).closest(
      '[data-slot=message]',
    )
    expect(theirs).toHaveAttribute('data-align', 'start')
    expect(theirs).toHaveTextContent('Mette Holm')

    const mine = screen.getByText('Sunday works').closest('[data-slot=message]')
    expect(mine).toHaveAttribute('data-align', 'end')
    // The side says who; "You" is there for a screen reader only.
    expect(mine?.querySelector('.sr-only')).toHaveTextContent('You')
    expect(mine?.querySelector('[data-slot=bubble]')).toHaveAttribute(
      'data-variant',
      'tinted',
    )
  })
})

describe('who said it', () => {
  it("names the reader's own bubble and a continued one for a screen reader only", async () => {
    messageRows.mockReturnValue([
      message({
        id: 'message-2',
        body: 'Second',
        created_by: 'user-sam',
        created_at: '2026-09-03T09:01:00Z',
      }),
      message({
        id: 'message-1',
        body: 'First',
        created_by: 'user-sam',
        created_at: '2026-09-03T09:00:00Z',
      }),
    ])
    openChannel()

    const rows = await screen.findAllByRole('listitem')
    // "You" is in the tree for both, invisible on screen.
    expect(rows[0]).toHaveTextContent('You')
    expect(rows[1]).toHaveTextContent('You')
    expect(rows[0]?.querySelector('.sr-only')).toHaveTextContent('You')
  })

  it('reveals Delete on a tap of the bubble', async () => {
    messageRows.mockReturnValue([message({ created_by: 'user-sam' })])
    openChannel()

    const remove = await screen.findByRole('button', { name: 'Delete' })
    expect(remove).toHaveClass('opacity-0')
    await userEvent.click(screen.getByText('Wall 4 is taped off'))
    expect(remove).toHaveClass('opacity-100')
  })
})

describe('deleting', () => {
  it('deletes by stamping deleted_at, which is what the trigger acts on', async () => {
    messageRows.mockReturnValue([message({ created_by: 'user-sam' })])
    openChannel()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    // Deleting asks first (P7D-03).
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(updated.mock.calls.some(([table]) => table === 'messages')).toBe(true),
    )
    const [, values] = updated.mock.calls.find(([table]) => table === 'messages') as [
      string,
      { deleted_at: string },
    ]
    expect(typeof values.deleted_at).toBe('string')
  })

  it('offers staff nothing on a colleague’s message, and no edit on their own', async () => {
    messageRows.mockReturnValue([
      message({ id: 'message-mine', body: 'On it', created_by: 'user-sam' }),
      message(),
    ])
    openChannel()

    expect(await screen.findByText('Wall 4 is taped off')).toBeInTheDocument()
    // One Delete, on the own line; a message is said once and deleted, never rewritten.
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
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

  it('starts a line on Enter on a touch screen, and sends from the button', async () => {
    // jsdom has no `matchMedia`; a phone answers "no fine pointer".
    const matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })
    window.matchMedia = matchMedia
    try {
      openChannel()

      const box = await screen.findByRole('textbox', { name: 'Write a message' })
      await userEvent.type(box, 'One{Enter}Two')
      expect(matchMedia).toHaveBeenCalledWith('(pointer: fine)')
      expect(box).toHaveValue('One\nTwo')
      expect(inserted).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      await waitFor(() =>
        expect(inserted).toHaveBeenCalledWith('messages', {
          channel_id: 'channel-nord',
          body: 'One\nTwo',
          mentions: [],
        }),
      )
    } finally {
      // @ts-expect-error -- back to jsdom's nothing, not a stub.
      delete window.matchMedia
    }
  })

  it('shows the line at once while it goes up, and empties the box for the next one', async () => {
    let release = () => {}
    slow.insert = new Promise<void>((resolve) => {
      release = resolve
    })
    openChannel()

    const box = await screen.findByRole('textbox', { name: 'Write a message' })
    await userEvent.type(box, 'Wall 4 is open{Enter}')

    // In the list already, marked as on its way, with nothing to delete yet.
    const row = await screen.findByRole('listitem')
    expect(row).toHaveTextContent('Wall 4 is open')
    expect(row).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    expect(box).toHaveValue('')
    await userEvent.type(box, 'And the crate is back')
    release()
    await waitFor(() => expect(inserted).toHaveBeenCalled())
    expect(box).toHaveValue('And the crate is back')
  })

  it('keeps a half-written message when somebody looks at another channel', async () => {
    channelRows.mockReturnValue([
      channel(),
      channel({ id: 'channel-company', kind: 'company', gym_id: null, name: 'Company' }),
    ])
    openChannel()

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Write a message' }),
      'Half a',
    )
    await userEvent.click(screen.getByRole('link', { name: /Company/ }))
    await screen.findByRole('heading', { name: 'Company' })
    expect(screen.getByRole('textbox', { name: 'Write a message' })).toHaveValue('')

    await userEvent.click(screen.getByRole('link', { name: /Copenhagen Nord/ }))
    await screen.findByRole('heading', { name: 'Copenhagen Nord' })
    expect(screen.getByRole('textbox', { name: 'Write a message' })).toHaveValue('Half a')
  })

  it('leaves out a file over 10 MB and says so', async () => {
    openChannel()
    await screen.findByRole('textbox', { name: 'Write a message' })

    const heavy = new File(['x'], 'reset.mov', { type: 'video/quicktime' })
    Object.defineProperty(heavy, 'size', { value: 11 * 1024 * 1024 })
    await userEvent.upload(screen.getByTestId('chat-files'), heavy)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'reset.mov is over 10 MB and was left out.',
    )
    expect(screen.queryByText('reset.mov')).not.toBeInTheDocument()
  })

  it('keeps a line that could not be sent in the stream, marked, with a way to try again', async () => {
    failing.insert = true
    openChannel()

    const box = await screen.findByRole('textbox', { name: 'Write a message' })
    await userEvent.type(box, 'Wall 4 is open{Enter}')

    // The line stays where the sender saw it appear, and says what happened.
    const row = await screen.findByRole('listitem')
    expect(await within(row).findByRole('alert')).toHaveTextContent('Not sent')
    expect(row).toHaveTextContent('Wall 4 is open')
    expect(box).toHaveValue('')
    expect(within(row).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    failing.insert = false
    await userEvent.click(within(row).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(inserted).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('says so when the socket is not there', async () => {
    socket.status = 'CHANNEL_ERROR'
    openChannel()

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Not connected. New messages arrive when you reload.',
    )
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

  it('says somebody is typing while they type, once per window', async () => {
    openChannel()

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Write a message' }),
      'Wall',
    )

    await waitFor(() => expect(tracked).toHaveBeenCalled())
    // Four keystrokes, one `track()`: a burst of them is what makes Realtime
    // close the channel for exceeding the presence rate limit.
    expect(tracked).toHaveBeenCalledTimes(1)
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
    // The file went up before the message was inserted: nothing is said
    // with its attachment missing.
    expect(uploaded.mock.invocationCallOrder[0]).toBeLessThan(
      inserted.mock.invocationCallOrder[0]!,
    )
    expect(inserted).toHaveBeenCalledWith('message_attachments', [
      expect.objectContaining({
        message_id: 'messages-new',
        path,
        file_name: 'wall4.png',
      }),
    ])
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

    await userEvent.click(await screen.findByRole('button', { name: 'Channel' }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Mute this channel' }),
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

    // The header says so before the menu is opened.
    expect(await screen.findByRole('heading', { name: /Muted/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Channel' }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Unmute this channel' }),
    )
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

describe('starting a conversation', () => {
  const person = (id: string, name: string): Row => ({
    id,
    full_name: name,
    email: `${name.toLowerCase().replace(' ', '.')}@gymops.test`,
  })

  it('opens the conversation with the people picked and goes to it', async () => {
    profileRows.mockReturnValue([
      person('user-mette', 'Mette Holm'),
      person('user-jonas', 'Jonas Berg'),
    ])
    renderWithProviders(<ChatPage />, {
      path: '/chat',
      initialEntries: ['/chat'],
      routes: [{ path: '/chat/:channelId', element: <p>the conversation</p> }],
    })

    await userEvent.click(await screen.findByRole('button', { name: 'New conversation' }))
    await userEvent.click(await screen.findByLabelText('Mette Holm'))
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    // The channel is the database's to find or create; the client only names
    // the people, and follows the id it is given.
    await waitFor(() =>
      expect(startedDm).toHaveBeenCalledWith({ target_ids: ['user-mette'] }),
    )
    expect(await screen.findByText('the conversation')).toBeInTheDocument()
  })

  it('does not offer to message yourself', async () => {
    profileRows.mockReturnValue([
      person('user-sam', 'Sam Ruiz'),
      person('user-mette', 'Mette Holm'),
    ])
    renderChat()

    await userEvent.click(await screen.findByRole('button', { name: 'New conversation' }))

    expect(await screen.findByLabelText('Mette Holm')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sam Ruiz')).not.toBeInTheDocument()
  })
})

describe('custom channels', () => {
  const asManager = () =>
    profile.mockReturnValue({
      id: 'user-sam',
      full_name: 'Sam Ruiz',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [
        { role: 'manager', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
      ],
    })

  it('offers the channel button to a manager and not to staff', async () => {
    renderChat()
    expect(
      await screen.findByRole('button', { name: 'Find a channel' }),
    ).toBeInTheDocument()
    // Staff by default: creating a channel is `can_publish_content()` (§2.1).
    expect(screen.queryByRole('button', { name: 'New channel' })).not.toBeInTheDocument()

    asManager()
    renderChat()
    expect(
      await screen.findAllByRole('button', { name: 'New channel' }),
    ).not.toHaveLength(0)
  })

  it('creates the channel in the chosen scope and seats whoever made it', async () => {
    asManager()
    renderWithProviders(<ChatPage />, {
      path: '/chat',
      initialEntries: ['/chat'],
      routes: [{ path: '/chat/:channelId', element: <p>the new channel</p> }],
    })

    await userEvent.click(await screen.findByRole('button', { name: 'New channel' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Route setting')
    await userEvent.click(screen.getByLabelText(/Private channel/))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(inserted).toHaveBeenCalledWith(
        'channels',
        expect.objectContaining({
          kind: 'custom',
          name: 'Route setting',
          gym_id: 'gym-nord',
          is_private: true,
        }),
      ),
    )
    // The channel exists and nobody is in it: the creator is its first member.
    expect(inserted).toHaveBeenCalledWith('channel_members', {
      channel_id: 'channels-new',
      user_id: 'user-sam',
    })
    expect(await screen.findByText('the new channel')).toBeInTheDocument()
  })

  it('joins one from the browse list', async () => {
    channelRows.mockReturnValue([
      channel(),
      channel({
        id: 'channel-setting',
        kind: 'custom',
        name: 'Route setting',
        description: null,
        channel_members: [],
      }),
    ])
    renderChat()

    await userEvent.click(await screen.findByRole('button', { name: 'Find a channel' }))
    // The one this person is already in is not offered again.
    const rows = await screen.findAllByRole('button', { name: 'Join' })
    expect(rows).toHaveLength(1)

    await userEvent.click(rows[0]!)
    await waitFor(() =>
      expect(inserted).toHaveBeenCalledWith('channel_members', {
        channel_id: 'channel-setting',
        user_id: 'user-sam',
      }),
    )
  })

  it('lets a member leave, and only a manager take somebody out', async () => {
    channelRows.mockReturnValue([
      channel({ id: 'channel-setting', kind: 'custom', name: 'Route setting' }),
    ])
    memberRows.mockReturnValue([
      {
        channel_id: 'channel-setting',
        user_id: 'user-mette',
        profiles: { full_name: 'Mette Holm', email: 'mette@gymops.test' },
      },
    ])
    renderChat('/chat/channel-setting', '/chat/:channelId')

    await userEvent.click(await screen.findByRole('button', { name: 'Channel' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Members' }))
    expect(await screen.findByText('Mette Holm')).toBeInTheDocument()
    // Staff read the list; they do not seat or unseat anybody.
    expect(
      screen.queryByRole('button', { name: 'Remove Mette Holm' }),
    ).not.toBeInTheDocument()
    // Escape rather than the Close button: the vendored dialog ships one of
    // its own, and two buttons of that name is the known gap, not this test's.
    await userEvent.keyboard('{Escape}')

    await userEvent.click(screen.getByRole('button', { name: 'Channel' }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Leave this channel' }),
    )
    // Leaving asks first (P7D-03).
    const leaveDialog = await screen.findByRole('alertdialog')
    await userEvent.click(
      within(leaveDialog).getByRole('button', { name: 'Leave this channel' }),
    )
    await waitFor(() =>
      expect(deleted).toHaveBeenCalledWith('channel_members', [
        ['channel_id', 'channel-setting'],
        ['user_id', 'user-sam'],
      ]),
    )
  })

  it('renames one, without offering to move or unhide it', async () => {
    asManager()
    channelRows.mockReturnValue([
      channel({ id: 'channel-setting', kind: 'custom', name: 'Route setting' }),
    ])
    renderChat('/chat/channel-setting', '/chat/:channelId')

    await userEvent.click(await screen.findByRole('button', { name: 'Channel' }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Channel settings' }),
    )
    // The scope and the privacy are what the people in it joined (P6-07).
    expect(screen.queryByLabelText('Who it belongs to')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Private channel/)).not.toBeInTheDocument()

    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Route setting & strip')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updated).toHaveBeenCalledWith('channels', {
        name: 'Route setting & strip',
        description: null,
      }),
    )
  })
})

describe('asking the assistant', () => {
  const write = async () => screen.findByRole('textbox', { name: 'Write a message' })

  it('offers @assistant in the mention list, without treating it as a person', async () => {
    openChannel()

    const box = await write()
    await userEvent.type(box, '@ass')
    await userEvent.click(await screen.findByRole('option', { name: /@assistant/ }))
    expect(box).toHaveValue('@assistant ')

    await userEvent.type(box, 'chalk?{Enter}')
    await waitFor(() =>
      expect(inserted).toHaveBeenCalledWith('messages', {
        channel_id: 'channel-nord',
        body: '@assistant chalk?',
        mentions: [],
      }),
    )
  })

  it('asks the function to answer once the mention is sent, and says so meanwhile', async () => {
    let finish!: (value: Row) => void
    invoked.mockReturnValue(new Promise<Row>((resolve) => (finish = resolve)))
    openChannel()

    await userEvent.type(await write(), '@assistant chalk?{Enter}')

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith('assistant', {
        body: {
          surface: 'channel',
          channel_id: 'channel-nord',
          message_id: 'messages-new',
        },
      }),
    )
    expect(screen.getByText('The assistant is answering…')).toBeInTheDocument()

    finish({ data: { message_id: 'messages-reply' }, error: null })
    await waitFor(() =>
      expect(screen.queryByText('The assistant is answering…')).not.toBeInTheDocument(),
    )
  })

  it('leaves the function alone for an ordinary message', async () => {
    openChannel()

    await userEvent.type(await write(), 'Wall 4 is open{Enter}')

    await waitFor(() => expect(inserted).toHaveBeenCalled())
    expect(invoked).not.toHaveBeenCalled()
  })

  it('says when the day’s limit is reached', async () => {
    invoked.mockResolvedValue({
      data: null,
      error: { context: { json: () => Promise.resolve({ error: 'cap_reached' }) } },
    })
    openChannel()

    await userEvent.type(await write(), '@assistant chalk?{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You have reached today’s limit for the assistant.',
    )
  })

  it('shows a reply as the assistant’s: nobody edits it, a manager can delete it', async () => {
    profile.mockReturnValue({
      id: 'user-sam',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [
        { role: 'manager', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
      ],
    })
    messageRows.mockReturnValue([
      message({
        id: 'message-a',
        body: 'Liquid chalk only.',
        created_by: null,
        author: null,
        from_assistant: true,
      }),
    ])
    openChannel()

    const row = await screen.findByRole('listitem')
    expect(row).toHaveTextContent('Assistant')
    expect(row).not.toHaveTextContent('someone')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
