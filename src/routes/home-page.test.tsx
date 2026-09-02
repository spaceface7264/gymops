import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomePage } from '@/routes/home-page'
import { renderWithProviders } from '@/test/render'

describe('HomePage', () => {
  it('renders inside the app providers', () => {
    renderWithProviders(<HomePage />)
    expect(screen.getByText('GymOps')).toBeInTheDocument()
  })
})
