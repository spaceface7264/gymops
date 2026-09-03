/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * P7C-01: the theme is light only and carries the brand. These read the
 * stylesheet as text because jsdom does not resolve Tailwind; what matters is
 * that the tokens exist with the decided values and the dark block is gone.
 *
 * Reads via fileURLToPath + path.join rather than `new URL('./index.css',
 * import.meta.url)`: Vite's static asset-URL analysis rewrites that exact
 * pattern at transform time, so under the jsdom test environment it resolves
 * to `http://localhost:3000/src/index.css` instead of a real file path.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'index.css'),
  'utf8',
)

describe('theme', () => {
  it('uses the icon violet as primary and ring', () => {
    expect(css).toMatch(/--primary:\s*#863bff/)
    expect(css).toMatch(/--ring:\s*#863bff/)
  })

  it('has no dark mode', () => {
    expect(css).not.toContain('.dark')
    expect(css).not.toContain('@custom-variant dark')
  })

  it('declares Inter as the sans stack', () => {
    expect(css).toMatch(/--font-sans:\s*'Inter Variable'/)
  })

  it('exposes the five status tones', () => {
    for (const tone of ['success', 'warning', 'info', 'danger', 'new']) {
      expect(css).toContain(`--tone-${tone}-bg`)
      expect(css).toContain(`--tone-${tone}-fg`)
      expect(css).toContain(`--tone-${tone}-dot`)
    }
  })
})
