import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, CardHeader, CardTitle } from './card'

describe('CardTitle', () => {
  it('renders a level-2 heading by default so screens have landmarks', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Open incidents</CardTitle>
        </CardHeader>
      </Card>,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Open incidents' }),
    ).toBeInTheDocument()
  })

  it('takes another level where the card sits under a page title', () => {
    render(<CardTitle as="h3">Week</CardTitle>)
    expect(screen.getByRole('heading', { level: 3, name: 'Week' })).toBeInTheDocument()
  })
})
