import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesktopNotificationOptIn } from './desktop-notification-opt-in'
import { useNotificationStream } from './use-notification-stream'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const granted = vi.fn<() => Promise<boolean>>()
const request = vi.fn<() => Promise<string>>()
const show = vi.fn<(options: { title: string; body: string }) => void>()
const prefRows = vi.fn<() => Row[]>()
let realtimeHandler: ((payload: { new: Row }) => void) | undefined

vi.mock('@/lib/platform', () => ({
  isDesktop: () => true,
  desktopNotificationsGranted: () => granted(),
  requestDesktopNotifications: () => request(),
  showDesktopNotification: (options: { title: string; body: string }) => show(options),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => Promise.resolve({ data: prefRows(), error: null }),
    }),
    channel: () => {
      const subscription = {
        on: (_event: string, _filter: Row, handler: (payload: { new: Row }) => void) => {
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

function Stream() {
  useNotificationStream()
  return null
}

const incident = {
  type: 'incident_reported',
  title: 'Fall from wall 4',
  body: 'Member landed badly, ice applied.',
}

beforeEach(() => {
  vi.clearAllMocks()
  granted.mockResolvedValue(true)
  request.mockResolvedValue('granted')
  prefRows.mockReturnValue([])
})

describe('desktop notifications', () => {
  it('shows what arrives, framed by its kind', async () => {
    renderWithProviders(<Stream />)
    await waitFor(() => expect(realtimeHandler).toBeDefined())

    realtimeHandler?.({ new: incident })

    await waitFor(() =>
      expect(show).toHaveBeenCalledWith({
        title: 'New incident',
        body: 'Fall from wall 4 — Member landed badly, ice applied.',
      }),
    )
  })

  it('respects the push switch for that kind', async () => {
    prefRows.mockReturnValue([
      { type: 'incident_reported', in_app: true, email: true, push: false },
    ])
    renderWithProviders(<Stream />)
    await waitFor(() => expect(realtimeHandler).toBeDefined())

    realtimeHandler?.({ new: incident })

    await waitFor(() => expect(prefRows).toHaveBeenCalled())
    expect(show).not.toHaveBeenCalled()
  })

  it('stays quiet without the permission', async () => {
    granted.mockResolvedValue(false)
    renderWithProviders(<Stream />)
    await waitFor(() => expect(realtimeHandler).toBeDefined())

    realtimeHandler?.({ new: incident })

    await waitFor(() => expect(granted).toHaveBeenCalled())
    expect(show).not.toHaveBeenCalled()
  })
})

describe('DesktopNotificationOptIn', () => {
  it('asks the OS from the button and reports the answer', async () => {
    granted.mockResolvedValue(false)
    const user = userEvent.setup()
    renderWithProviders(<DesktopNotificationOptIn />)

    expect(
      await screen.findByText('This computer does not show notifications.'),
    ).toBeInTheDocument()
    granted.mockResolvedValue(true)
    await user.click(screen.getByRole('button', { name: 'Turn on for this device' }))

    expect(
      await screen.findByText('This computer shows notifications.'),
    ).toBeInTheDocument()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('says when the OS has refused', async () => {
    granted.mockResolvedValue(false)
    request.mockResolvedValue('denied')
    const user = userEvent.setup()
    renderWithProviders(<DesktopNotificationOptIn />)

    await user.click(
      await screen.findByRole('button', { name: 'Turn on for this device' }),
    )

    expect(
      await screen.findByText(/blocking notifications for GymOps/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn on for this device' })).toBeDisabled()
  })
})
