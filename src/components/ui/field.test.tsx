import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from './input'
import { NativeSelect } from './native-select'
import { Textarea } from './textarea'

/**
 * iOS Safari zooms the page into any field whose font is under 16px, and the
 * app's body is 15px. Every text field is 16px at the primitive so no screen
 * has to remember it.
 */
describe('text fields are 16px', () => {
  it.each([
    ['Input', <Input aria-label="f" />],
    ['Textarea', <Textarea aria-label="f" />],
    ['NativeSelect', <NativeSelect aria-label="f" />],
  ])('%s', (_name, element) => {
    const { container } = render(element)
    expect(container.firstElementChild?.className).toMatch(/(^|\s)text-\[16px\](\s|$)/)
    expect(container.firstElementChild?.className).not.toMatch(/(^|\s)text-(sm|base)\b/)
  })
})
