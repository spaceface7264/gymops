import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentSearch } from '@/features/content'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>
const rpc = vi.fn<(fn: string, args: Row) => Promise<{ data: Row[]; error: null }>>()

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (fn: string, args: Row) => rpc(fn, args) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({
    data: [
      {
        kind: 'guide',
        id: 'guide-1',
        title: 'Evacuation',
        body_text: 'Gather everyone by the front door.',
        status: 'draft',
        gym_name: 'Copenhagen Nord',
        rank: 0.6,
      },
      {
        kind: 'news',
        id: 'post-1',
        title: 'New chalk policy',
        body_text: 'From Monday only liquid chalk is allowed in the whole gym.',
        status: 'published',
        gym_name: null,
        rank: 0.3,
      },
    ],
    error: null,
  })
})

describe('ContentSearch', () => {
  it('waits for a real search term before asking the database', async () => {
    renderWithProviders(<ContentSearch />)

    await userEvent.type(screen.getByLabelText('Search news and guides'), 'c')

    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('searches both news and guides with a websearch query on the simple config', async () => {
    renderWithProviders(<ContentSearch />)

    await userEvent.type(screen.getByLabelText('Search news and guides'), 'chalk')

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('content_search', { query: 'chalk' })
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

  it('lists results in the order the database ranked them', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentSearch />)
    await user.type(screen.getByRole('searchbox'), 'door')
    const list = await screen.findByRole('list', { name: 'Search results' })
    const items = await within(list).findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Evacuation')
    expect(items[1]).toHaveTextContent('New chalk policy')
  })
})
