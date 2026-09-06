import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  InboxPage,
  NotificationBell,
  NotificationPreferencesPage,
  defaultPref,
  notificationChannels,
  notificationTypes,
} from '@/features/notifications'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const unreadCount = vi.fn<() => number>()
const update = vi.fn<(values: Row) => void>()
const upsert = vi.fn<(values: Row, options: Row) => void>()
const channel = vi.fn<(topic: string, options: Row) => void>()
let realtimeHandler: (() => void) | undefined

/** `expect.any` is typed `any`; named once so the assertions stay type-safe. */
const aTimestamp = expect.any(String) as string

function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: tableRows(table), error: null }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (_columns: string, options?: { head?: boolean }) =>
        options?.head
          ? { is: () => Promise.resolve({ count: unreadCount(), error: null }) }
          : builder(table),
      update: (values: Row) => {
        update(values)
        return builder(table)
      },
      upsert: (values: Row, options: Row) => {
        upsert(values, options)
        return Promise.resolve({ error: null })
      },
    }),
    channel: (topic: string, options: Row) => {
      channel(topic, options)
      const subscription = {
        on: (_event: string, _filter: Row, handler: () => void) => {
          realtimeHandler = handler
          return subscription
        },
        subscribe: () => subscription,
      }
      return subscription
    },
    removeChannel: vi.fn(),
  },
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const incident = {
  id: 'note-1',
  type: 'incident_reported',
  title: 'Fall from wall 4',
  body: 'Member landed badly, ice applied.',
  url: '/incidents/incident-1',
  gym_id: 'gym-nord',
  data: { severity: 'high' },
  created_at: '2026-09-02T08:00:00Z',
  read_at: null,
}

const reminder = {
  ...incident,
  id: 'note-2',
  type: 'ack_reminder',
  title: 'New belay policy',
  body: null,
  url: '/news/post-1',
  data: { kind: 'post' },
  created_at: '2026-09-01T08:00:00Z',
  read_at: '2026-09-01T09:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  realtimeHandler = undefined
  tableRows.mockReturnValue([])
  unreadCount.mockReturnValue(0)
})

describe('inbox', () => {
  it('lists what somebody has been told, newest first', async () => {
    tableRows.mockReturnValue([incident, reminder])
    renderWithProviders(<InboxPage />)

    expect(await screen.findByText('Fall from wall 4')).toBeInTheDocument()
    expect(screen.getByText('New belay policy')).toBeInTheDocument()
    // The type is the translated framing; the title is the author's own words.
    expect(screen.getByText(/New incident/)).toBeInTheDocument()
    expect(screen.getByText(/Still to confirm/)).toBeInTheDocument()
  })

  it('says so when nothing has happened', async () => {
    renderWithProviders(<InboxPage />)
    expect(await screen.findByText('Nothing has happened yet.')).toBeInTheDocument()
  })

  it('marks one read, and offers to undo it on the one already read', async () => {
    tableRows.mockReturnValue([incident, reminder])
    renderWithProviders(<InboxPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Mark read' }))
    await waitFor(() =>
      expect(update).toHaveBeenNthCalledWith(1, { read_at: aTimestamp }),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Mark unread' }))
    await waitFor(() => expect(update).toHaveBeenNthCalledWith(2, { read_at: null }))
  })

  it('opening one follows its link and reads it on the way', async () => {
    tableRows.mockReturnValue([incident])
    renderWithProviders(<InboxPage />, {
      routes: [{ path: '/incidents/:incidentId', element: <p>The incident</p> }],
    })

    await userEvent.click(
      await screen.findByRole('button', { name: /Open Fall from wall 4/ }),
    )

    expect(await screen.findByText('The incident')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ read_at: aTimestamp })
  })

  it('marks everything read in one go', async () => {
    tableRows.mockReturnValue([incident, reminder])
    renderWithProviders(<InboxPage />)

    const markAll = await screen.findByRole('button', { name: 'Mark all read' })
    await waitFor(() => expect(markAll).toBeEnabled())
    await userEvent.click(markAll)

    await waitFor(() => expect(update).toHaveBeenCalledWith({ read_at: aTimestamp }))
  })

  it('offers nothing to mark when everything has been read', async () => {
    tableRows.mockReturnValue([reminder])
    renderWithProviders(<InboxPage />)

    expect(await screen.findByText('New belay policy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled()
  })
})

describe('preferences', () => {
  it('shows every channel on for a type nobody has touched, reactions off', async () => {
    renderWithProviders(<NotificationPreferencesPage />)

    const switches = await screen.findAllByRole('switch')
    // Every type the enum carries, times the three channels — counted rather
    // than written down, so adding a type (P6-08 added two) is not a failure.
    expect(switches).toHaveLength(notificationTypes.length * notificationChannels.length)
    const off = switches.filter((box) => box.getAttribute('aria-checked') === 'false')
    // Reactions are opt-in (P7M-04): their three switches are the only ones off.
    expect(off).toHaveLength(notificationChannels.length)
  })

  it('writes the whole row when one channel is switched off', async () => {
    renderWithProviders(<NotificationPreferencesPage />)

    await userEvent.click(
      await screen.findByRole('switch', { name: 'Email for New incident' }),
    )

    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          type: 'incident_reported',
          in_app: true,
          email: false,
          push: true,
        },
        { onConflict: 'user_id,type' },
      ),
    )
  })

  it('starts from what is already stored', async () => {
    tableRows.mockReturnValue([
      { type: 'ack_reminder', in_app: true, email: false, push: false },
    ])
    renderWithProviders(<NotificationPreferencesPage />)

    const box = await screen.findByRole('switch', { name: 'Push for Still to confirm' })
    await waitFor(() => expect(box).not.toBeChecked())
    expect(screen.getByRole('switch', { name: 'Push for New incident' })).toBeChecked()
  })
})

describe('the badge', () => {
  it('counts what is unread and joins the right channel', async () => {
    unreadCount.mockReturnValue(3)
    renderWithProviders(<NotificationBell />)

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Notifications, 3 unread' })).toHaveAttribute(
      'href',
      '/notifications',
    )
    expect(channel).toHaveBeenCalledWith('notifications:user-1', {
      config: { private: true },
    })
  })

  it('stays out of the way when there is nothing unread', async () => {
    renderWithProviders(<NotificationBell />)

    expect(await screen.findByRole('link', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('picks up something that arrives while the screen is open', async () => {
    renderWithProviders(<NotificationBell />)
    await screen.findByRole('link', { name: 'Notifications' })

    unreadCount.mockReturnValue(1)
    realtimeHandler?.()

    expect(await screen.findByText('1')).toBeInTheDocument()
  })
})

describe('defaultPref', () => {
  it('is every channel on, except reactions, which are opt-in', () => {
    expect(defaultPref('chat_mention')).toMatchObject({
      in_app: true,
      email: true,
      push: true,
    })
    expect(defaultPref('chat_reaction')).toMatchObject({
      in_app: false,
      email: false,
      push: false,
    })
  })
})
