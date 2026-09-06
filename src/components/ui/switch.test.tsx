import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Switch } from './switch'

it('has a 44 px hit area around the 17 px track', () => {
  render(<Switch aria-label="Push" />)
  // 17.25 px track + 14 px above and below (P7M-05); `-inset-y-3` was 41 px.
  expect(screen.getByRole('switch').className).toContain('before:-inset-y-[14px]')
})
