import { afterEach, describe, expect, it, vi } from 'vitest'
import { isDesktop, isInstalledWeb, onDeepLink } from './index'

// Tauri announces itself with a `window.isTauri` global before any script runs.
const globalWithTauri = globalThis as { isTauri?: boolean }

afterEach(() => {
  delete globalWithTauri.isTauri
  vi.unstubAllGlobals()
  delete (navigator as { standalone?: boolean }).standalone
})

describe('isDesktop', () => {
  it('is false in a browser', () => {
    expect(isDesktop()).toBe(false)
  })

  it('is true inside the Tauri webview', () => {
    globalWithTauri.isTauri = true
    expect(isDesktop()).toBe(true)
  })
})

describe('onDeepLink', () => {
  it('never fires on the web', () => {
    const handler = vi.fn()
    const stop = onDeepLink(handler)
    stop()
    expect(handler).not.toHaveBeenCalled()
  })
})

/** jsdom has no `matchMedia`; this one answers the standalone query only. */
function standalone(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' && matches,
    })),
  )
}

describe('isInstalledWeb (P9-10)', () => {
  it('is false in a browser tab', () => {
    standalone(false)
    expect(isInstalledWeb()).toBe(false)
  })

  it('is false when the browser cannot say', () => {
    expect(isInstalledWeb()).toBe(false)
  })

  it('is true once the app runs from the Home Screen', () => {
    standalone(true)
    expect(isInstalledWeb()).toBe(true)
  })

  it('reads the iOS flag when the media query says no', () => {
    standalone(false)
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    expect(isInstalledWeb()).toBe(true)
  })

  it('is never true in the desktop shell', () => {
    globalWithTauri.isTauri = true
    standalone(true)
    expect(isInstalledWeb()).toBe(false)
  })
})
