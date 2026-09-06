import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('is a pill at a 44px touch height by default', () => {
    render(<Button>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.className).toContain('rounded-full')
    expect(button.className).toContain('h-11')
  })

  it('carries no dark-mode classes', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button').className).not.toMatch(/dark:/)
  })
})

it('keeps a small button 44 px on a phone and dense from md up', () => {
  render(<Button size="sm">Roles</Button>)
  const className = screen.getByRole('button', { name: 'Roles' }).className
  expect(className).toContain('h-11')
  expect(className).toContain('md:h-9')
})
