import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentSearch } from '@/features/content'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const textSearch = vi.fn<(column: string, query: string, options: Row) => void>()

function builder(table: string) {
  const chain = {
    select: () => chain,
    textSearch: (column: string, query: string, options: Row) => {
      textSearch(column, query, options)
      return chain
    },
    limit: () => Promise.resolve({ data: tableRows(table), error: null }),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => builder(table) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  tableRows.mockImplementation((table) =>
    table === 'posts'
      ? [
          {
            id: 'post-1',
            title: 'New chalk policy',
            body_text: 'From Monday only liquid chalk is allowed in the whole gym.',
            status: 'published',
            gyms: null,
          },
        ]
      : [
          {
            id: 'guide-1',
            title: 'Evacuation',
            body_text: 'Gather everyone by the front door.',
            status: 'draft',
            gyms: { name: 'Copenhagen Nord' },
          },
        ],
  )
})

describe('ContentSearch', () => {
  it('waits for a real search term before asking the database', async () => {
    renderWithProviders(<ContentSearch />)

    await userEvent.type(screen.getByLabelText('Search news and guides'), 'c')

    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(textSearch).not.toHaveBeenCalled()
  })

  it('searches both news and guides with a websearch query on the simple config', async () => {
    renderWithProviders(<ContentSearch />)

    await userEvent.type(screen.getByLabelText('Search news and guides'), 'chalk')

    await waitFor(() => expect(textSearch).toHaveBeenCalledTimes(2))
    expect(textSearch).toHaveBeenCalledWith('search_vector', 'chalk', {
      type: 'websearch',
      config: 'simple',
    })
  })

  it('labels each hit with its kind, its scope and whether it is a draft', async () => {
    renderWithProviders(<ContentSearch />)

    await userEvent.type(screen.getByLabelText('Search news and guides'), 'chalk')

    // The results list renders empty while the query is in flight, so wait for
    // the rows rather than for the list.
    const [evacuation, chalk] = await screen.findAllByRole('listitem')
    expect(within(evacuation!).getByText('Guide')).toBeInTheDocument()
    expect(within(evacuation!).getByText('Copenhagen Nord')).toBeInTheDocument()
    expect(within(evacuation!).getByText('Draft')).toBeInTheDocument()
    expect(within(chalk!).getByText('News')).toBeInTheDocument()
    expect(within(chalk!).getByText('Company-wide')).toBeInTheDocument()
  })

  it('links a hit to the module it lives in', async () => {
    renderWithProviders(<ContentSearch />)

    await userEvent.type(screen.getByLabelText('Search news and guides'), 'chalk')

    expect(await screen.findByRole('link', { name: 'New chalk policy' })).toHaveAttribute(
      'href',
      '/news/post-1',
    )
    expect(screen.getByRole('link', { name: 'Evacuation' })).toHaveAttribute(
      'href',
      '/guides/guide-1',
    )
  })

  it('shows the words around the match, not the top of the document', async () => {
    renderWithProviders(<ContentSearch />)

    await userEvent.type(screen.getByLabelText('Search news and guides'), 'liquid')

    expect(await screen.findByText(/…?From Monday only liquid chalk/)).toBeInTheDocument()
  })
})
