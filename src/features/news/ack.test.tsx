import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcknowledgeButton, AckReport, useTrackPostRead } from '@/features/news'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const upsert = vi.fn<(table: string, values: Row, options?: Row) => void>()

/** Table-aware stand-in for the PostgREST builder. */
function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () =>
      Promise.resolve({ data: tableRows(table)[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: tableRows(table), error: null }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => builder(table),
      upsert: (values: Row, options?: Row) => {
        upsert(table, values, options)
        return Promise.resolve({ error: null })
      },
    }),
  },
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
  useProfile: () => ({ data: { id: 'user-1', is_admin: true, gym_memberships: [] } }),
}))

const post = {
  id: 'post-1',
  gym_id: null,
  requires_ack: true,
  status: 'published' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  tableRows.mockReturnValue([])
})

describe('AcknowledgeButton', () => {
  it('asks for a confirmation and records it against the signed-in user', async () => {
    renderWithProviders(<AcknowledgeButton post={post} />)

    await userEvent.click(await screen.findByRole('button', { name: 'I have read this' }))

    await waitFor(() => expect(upsert).toHaveBeenCalled())
    const [table, values] = upsert.mock.lastCall ?? []
    expect(table).toBe('post_reads')
    expect(values).toMatchObject({ post_id: 'post-1', user_id: 'user-1' })
    expect(values).toHaveProperty('acknowledged_at')
  })

  it('shows when it was confirmed instead of asking again', async () => {
    tableRows.mockImplementation((table) =>
      table === 'post_reads'
        ? [{ read_at: '2026-09-02T08:00:00Z', acknowledged_at: '2026-09-02T09:30:00Z' }]
        : [],
    )
    renderWithProviders(<AcknowledgeButton post={post} />)

    expect(await screen.findByText(/Confirmed/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'I have read this' }),
    ).not.toBeInTheDocument()
  })

  it('stays out of the way on a post that needs no acknowledgement', () => {
    const { container } = renderWithProviders(
      <AcknowledgeButton post={{ ...post, requires_ack: false }} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})

describe('useTrackPostRead', () => {
  function Probe({ status }: { status: 'draft' | 'published' }) {
    useTrackPostRead({ id: 'post-1', status })
    return <p>probe</p>
  }

  it('records that a published post was opened, keeping the first read', async () => {
    renderWithProviders(<Probe status="published" />)

    await waitFor(() => expect(upsert).toHaveBeenCalled())
    expect(upsert.mock.lastCall?.[1]).toEqual({ post_id: 'post-1', user_id: 'user-1' })
    expect(upsert.mock.lastCall?.[2]).toEqual({ ignoreDuplicates: true })
  })

  it('does not record a draft as read', async () => {
    renderWithProviders(<Probe status="draft" />)

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('AckReport', () => {
  beforeEach(() => {
    tableRows.mockImplementation((table) =>
      table === 'gym_memberships'
        ? [
            {
              user_id: 'user-2',
              gyms: { name: 'Copenhagen Nord' },
              profiles: {
                id: 'user-2',
                full_name: 'Sam Staff',
                email: 's@x.test',
                active: true,
              },
            },
            {
              user_id: 'user-3',
              gyms: { name: 'Aarhus C' },
              profiles: {
                id: 'user-3',
                full_name: 'Mette Manager',
                email: 'm@x.test',
                active: true,
              },
            },
            {
              user_id: 'user-4',
              gyms: { name: 'Aarhus C' },
              profiles: {
                id: 'user-4',
                full_name: 'Gone Away',
                email: 'g@x.test',
                active: false,
              },
            },
          ]
        : [{ user_id: 'user-3', acknowledged_at: '2026-09-02T09:30:00Z' }],
    )
  })

  it('puts the people who have not confirmed first, and counts them', async () => {
    renderWithProviders(<AckReport post={post} />)

    expect(await screen.findByText('1 of 2 have confirmed.')).toBeInTheDocument()

    const [first, second] = screen.getAllByRole('listitem')
    expect(first).toHaveTextContent('Sam Staff')
    expect(first).toHaveTextContent('Not yet')
    expect(second).toHaveTextContent('Mette Manager')
  })

  it('leaves deactivated people out of the audience', async () => {
    renderWithProviders(<AckReport post={post} />)

    expect(await screen.findByText('Sam Staff')).toBeInTheDocument()
    expect(screen.queryByText('Gone Away')).not.toBeInTheDocument()
  })
})
