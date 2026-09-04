import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './checkbox'

describe('Checkbox', () => {
  it('toggles and reports the new state', async () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox aria-label="Done" onCheckedChange={onCheckedChange} />)
    const box = screen.getByRole('checkbox', { name: 'Done' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(box)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(box).toHaveAttribute('aria-checked', 'true')
  })

  it('has a padded hit area and no dark-mode or shadow classes', () => {
    render(<Checkbox aria-label="Done" />)
    const box = screen.getByRole('checkbox')
    expect(box.className).toContain('before:-inset-3')
    expect(box.className).not.toMatch(/dark:|shadow-xs/)
  })

  it('does not toggle when disabled', async () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox aria-label="Done" disabled onCheckedChange={onCheckedChange} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
