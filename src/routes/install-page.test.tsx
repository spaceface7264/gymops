import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InstallPage } from '@/routes/install-page'
import { renderWithProviders } from '@/test/render'

describe('the install guide', () => {
  it('covers the three ways somebody arrives, iPhone first', () => {
    renderWithProviders(<InstallPage />)

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(headings).toEqual([
      'iPhone and iPad (Safari)',
      'Android (Chrome)',
      'Windows and Mac',
    ])
  })

  it('says the thing nobody guesses: iPhone needs the Home Screen first', () => {
    renderWithProviders(<InstallPage />)

    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
    expect(screen.getByText(/Chrome on iPhone cannot install it/)).toBeInTheDocument()
  })
})
