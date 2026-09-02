import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '@/routes/home-page'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const postRows = vi.fn<() => Row[]>()

function builder() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    or: () => chain,
    is: () => chain,
    order: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: postRows(), error: null }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: () => builder() } }))
// Staff: the checklist block below the news is for the people who run a gym,
// so these cases see the news alone.
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
  useProfile: () => ({
    data: { id: 'user-1', is_admin: false, is_superadmin: false, gym_memberships: [] },
  }),
}))
vi.mock('@/features/gyms', () => ({
  useGymScope: () => ({ gymId: 'gym-nord' }),
  useGyms: () => ({ data: [] }),
}))

const post = (overrides: Row): Row => ({
  id: 'post-1',
  gym_id: null,
  title: 'New chalk policy',
  body: { type: 'doc', content: [] },
  status: 'published',
  published_at: '2026-09-02T08:00:00Z',
  pinned: false,
  requires_ack: false,
  created_at: '2026-09-02T08:00:00Z',
  updated_at: '2026-09-02T08:00:00Z',
  gyms: null,
  post_reads: [],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HomePage', () => {
  it('lists what the reader has not seen, confirmations first', async () => {
    postRows.mockReturnValue([
      post({ id: 'post-unread', title: 'Setting day moved' }),
      post({
        id: 'post-ack',
        title: 'New chalk policy',
        requires_ack: true,
        post_reads: [{ read_at: '2026-09-02T09:00:00Z', acknowledged_at: null }],
      }),
    ])
    renderWithProviders(<HomePage />)

    const [first, second] = await screen.findAllByRole('listitem')
    expect(first).toHaveTextContent('Confirm')
    expect(first).toHaveTextContent('New chalk policy')
    expect(second).toHaveTextContent('Unread')
    expect(second).toHaveTextContent('Setting day moved')
  })

  it('drops a post that has been read, and one whose confirmation is in', async () => {
    postRows.mockReturnValue([
      post({
        id: 'post-read',
        post_reads: [{ read_at: '2026-09-02T09:00:00Z', acknowledged_at: null }],
      }),
      post({
        id: 'post-confirmed',
        requires_ack: true,
        post_reads: [
          { read_at: '2026-09-02T09:00:00Z', acknowledged_at: '2026-09-02T09:05:00Z' },
        ],
      }),
    ])
    renderWithProviders(<HomePage />)

    expect(
      await screen.findByText('Nothing new — you are up to date.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })
})
