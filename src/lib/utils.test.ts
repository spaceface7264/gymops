import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('drops falsy conditional classes', () => {
    const isHidden = false
    expect(cn('p-2', isHidden && 'hidden', 'text-sm')).toBe('p-2 text-sm')
  })

  it('lets later tailwind classes win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
