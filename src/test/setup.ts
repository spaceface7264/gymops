import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * `src/lib/supabase.ts` refuses to build a client without these, which is the
 * right behaviour in the app and the wrong one in a test run: a fresh clone —
 * and every CI runner — has no `.env.local`, so importing anything that
 * reaches the client threw before a single assertion ran. Tests mock the
 * client itself; these values only have to exist.
 */
vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key')

/**
 * P5-05: the push opt-in reads this to decide whether the build can subscribe
 * at all. Left to the machine's own environment, the tests passed on a
 * developer's `.env.local` and failed on CI, which has none. It has to be
 * valid base64url, because the opt-in decodes it into an application server
 * key before it subscribes.
 */
vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'dGVzdC12YXBpZC1rZXk')

/**
 * ProseMirror (the editor behind Tiptap, P3-01) measures the selection after
 * every transaction, and jsdom implements no `Range` measurement at all: without
 * these stubs, typing into an editor throws instead of failing an assertion.
 * Layout is not what these tests check.
 */
const emptyRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
} as DOMRect

const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList

Object.defineProperty(Range.prototype, 'getClientRects', {
  configurable: true,
  value: noRects,
})
Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: () => emptyRect,
})

// Clicking inside an editor makes ProseMirror map the pointer to a document
// position, which jsdom cannot answer either.
Object.defineProperty(Document.prototype, 'elementFromPoint', {
  configurable: true,
  value: () => null,
})

/**
 * Radix Select (and every other primitive built on its popper) drives its
 * trigger with the Pointer Capture API and scrolls the chosen item into view.
 * jsdom implements neither, so opening a Select threw before the click landed.
 * These follow the same rule as the Range stubs above: the tests check what the
 * control does, not where the browser paints it.
 */
Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
})
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  configurable: true,
  value: () => {},
})
Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
  configurable: true,
  value: () => {},
})
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: () => {},
})

afterEach(() => {
  cleanup()
})
