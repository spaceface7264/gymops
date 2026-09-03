import { afterEach, describe, expect, it, vi } from 'vitest'
import { isDesktop, onDeepLink } from './index'

// Tauri announces itself with a `window.isTauri` global before any script runs.
const globalWithTauri = globalThis as { isTauri?: boolean }

afterEach(() => {
  delete globalWithTauri.isTauri
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
