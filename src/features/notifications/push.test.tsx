import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PushOptIn } from '@/features/notifications'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const upsert = vi.fn<(values: Row, options: Row) => void>()
const remove = vi.fn<(endpoint: string) => void>()
const requestPermission = vi.fn<() => Promise<NotificationPermission>>()
const getSubscription = vi.fn<() => Promise<Row | null>>()
const subscribe = vi.fn<(options: Row) => Promise<Row>>()
const unsubscribe = vi.fn<() => Promise<boolean>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (values: Row, options: Row) => {
        upsert(values, options)
        return Promise.resolve({ error: null })
      },
      delete: () => ({
        eq: (_column: string, endpoint: string) => {
          remove(endpoint)
          return Promise.resolve({ error: null })
        },
      }),
    }),
  },
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const subscription = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ keys: { p256dh: 'key-material', auth: 'auth-secret' } }),
  unsubscribe,
}

/** jsdom has neither a service worker nor the Push API; this is the shape the
 *  browser hands us, cut down to what `push.ts` touches. */
function givePushApis(permission: NotificationPermission = 'default') {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription, subscribe },
      }),
    },
  })
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', { permission, requestPermission })
}

beforeEach(() => {
  vi.clearAllMocks()
  getSubscription.mockResolvedValue(null)
  subscribe.mockResolvedValue(subscription)
  unsubscribe.mockResolvedValue(true)
  requestPermission.mockResolvedValue('granted')
  givePushApis()
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('the push opt-in', () => {
  it('asks for the permission and records the subscription', async () => {
    renderWithProviders(<PushOptIn />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Turn on for this device' }),
    )

    await waitFor(() => expect(requestPermission).toHaveBeenCalled())
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    )
    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          endpoint: 'https://push.example/abc',
          p256dh: 'key-material',
          auth: 'auth-secret',
        }),
        { onConflict: 'endpoint' },
      ),
    )
  })

  it('records nothing when the permission is refused', async () => {
    requestPermission.mockResolvedValue('denied')
    renderWithProviders(<PushOptIn />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Turn on for this device' }),
    )

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(subscribe).not.toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('says so, and offers nothing, when the browser is blocking notifications', async () => {
    givePushApis('denied')
    renderWithProviders(<PushOptIn />)

    expect(
      await screen.findByText(/This browser is blocking notifications/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn on for this device' })).toBeDisabled()
  })

  it('turns it off in the browser and in the table', async () => {
    getSubscription.mockResolvedValue(subscription)
    renderWithProviders(<PushOptIn />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Turn off on this device' }),
    )

    await waitFor(() => expect(unsubscribe).toHaveBeenCalled())
    expect(remove).toHaveBeenCalledWith('https://push.example/abc')
  })

  it('points at the install guide where push cannot work at all', () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    renderWithProviders(<PushOptIn />)

    expect(screen.getByText(/This browser cannot receive push/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How to install it' })).toHaveAttribute(
      'href',
      '/install',
    )
  })
})
