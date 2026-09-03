import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { useDeepLinkAuth } from './use-deep-link-auth'

const handlers: ((url: string) => void)[] = []

vi.mock('@/lib/platform', () => ({
  isDesktop: () => true,
  onDeepLink: (handler: (url: string) => void) => {
    handlers.push(handler)
    return () => {}
  },
}))

function Listener() {
  useDeepLinkAuth()
  return <p>Somewhere in the app</p>
}

describe('useDeepLinkAuth', () => {
  it('sends an auth deep link to the callback screen', async () => {
    renderWithProviders(<Listener />, {
      routes: [{ path: '/auth/callback', element: <p>Callback screen</p> }],
    })
    expect(screen.getByText('Somewhere in the app')).toBeInTheDocument()

    handlers.at(-1)?.('gymops://auth/callback?code=abc')
    expect(await screen.findByText('Callback screen')).toBeInTheDocument()
  })

  it('leaves any other URL alone', () => {
    renderWithProviders(<Listener />, {
      routes: [{ path: '/auth/callback', element: <p>Callback screen</p> }],
    })
    handlers.at(-1)?.('gymops://something/else')
    expect(screen.getByText('Somewhere in the app')).toBeInTheDocument()
  })
})
