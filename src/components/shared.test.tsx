import { render, screen } from '@testing-library/react'
import { TriangleAlert } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { EmptyState, LoadingState, Logo, PageHeader, StatusBadge } from '@/components'
import { renderWithProviders } from '@/test/render'

describe('Logo', () => {
  it('draws the mark with the wordmark on request', () => {
    renderWithProviders(<Logo wordmark />)
    expect(screen.getByText('GymOps')).toBeInTheDocument()
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('PageHeader', () => {
  it('is the page title with room for one action', () => {
    render(
      <PageHeader
        title="Incidents"
        description="What is broken"
        action={<button>Report</button>}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Incidents' }),
    ).toBeInTheDocument()
    expect(screen.getByText('What is broken')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('says what is missing and offers the way forward', () => {
    render(
      <EmptyState
        icon={TriangleAlert}
        title="No incidents"
        body="Nothing open."
        action={<a href="/incidents/new">Report one</a>}
      />,
    )
    expect(screen.getByText('No incidents')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Report one' })).toBeInTheDocument()
  })
})

describe('LoadingState', () => {
  it('announces loading once and shows the requested skeleton rows', () => {
    renderWithProviders(<LoadingState rows={4} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(document.querySelectorAll('[data-slot=skeleton]')).toHaveLength(4)
  })
})

describe('StatusBadge', () => {
  it('colours by tone', () => {
    render(<StatusBadge tone="danger">Open · high</StatusBadge>)
    const badge = screen.getByText('Open · high')
    expect(badge.className).toContain('bg-tone-danger-bg')
    expect(badge.className).toContain('text-tone-danger-fg')
  })

  it('neutral is the quiet outline', () => {
    render(<StatusBadge tone="neutral">Aarhus C</StatusBadge>)
    expect(screen.getByText('Aarhus C').className).toContain('border-border')
  })
})
