import { afterEach, describe, expect, it } from 'vitest'
import { isDesktop } from './index'

// Tauri announces itself with a `window.isTauri` global before any script runs.
const globalWithTauri = globalThis as { isTauri?: boolean }

describe('isDesktop', () => {
  afterEach(() => {
    delete globalWithTauri.isTauri
  })

  it('is false in a browser', () => {
    expect(isDesktop()).toBe(false)
  })

  it('is true inside the Tauri webview', () => {
    globalWithTauri.isTauri = true
    expect(isDesktop()).toBe(true)
  })
})
