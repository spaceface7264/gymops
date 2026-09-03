import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('is decorative: hidden from assistive tech and animated', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el.className).toContain('animate-pulse')
    expect(el.className).toContain('w-24')
  })
})
