import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewsFeed, PostDetailPage, PostEditorPage, postDate } from '@/features/news'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const feedRows = vi.fn<() => { data: Row[]; error: null }>()
const insert = vi.fn<(values: Row) => void>()
const update = vi.fn<(values: Row) => void>()
const profile = vi.fn<() => Row>()
const gymScope = vi.fn<() => { gymId: string | null }>()

/**
 * A stand-in for the PostgREST builder: every step returns itself, and awaiting
 * it — or calling `single()` — yields the rows the test set up.
 */
function builder(result: () => { data: unknown; error: null }) {
  const chain = {
    select: () => chain,
    is: () => chain,
    order: () => chain,
    or: () => chain,
    eq: () => chain,
    single: () => Promise.resolve({ data: (result().data as Row[])[0], error: null }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => builder(feedRows),
      insert: (values: Row) => {
        insert(values)
        return builder(() => ({ data: [{ id: 'new-post' }], error: null }))
      },
      update: (values: Row) => {
        update(values)
        return builder(() => ({ data: [], error: null }))
      },
      // The detail view records that the post was opened (P3-04).
      upsert: () => Promise.resolve({ error: null }),
    }),
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn() }) },
  },
}))

vi.mock('@/features/auth', () => ({
  useProfile: () => ({ data: profile() }),
  useAuth: () => ({ user: { id: 'user-1' } }),
}))
vi.mock('@/features/gyms', () => ({
  useGymScope: () => gymScope(),
  useGyms: () => ({ data: [{ id: 'gym-nord', name: 'Copenhagen Nord', slug: 'nord' }] }),
}))

const nordMembership = {
  role: 'manager',
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord', slug: 'nord' },
}

const companyPost = {
  id: 'post-1',
  gym_id: null,
  title: 'New chalk policy',
  body: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Only liquid chalk.' }] },
    ],
  },
  status: 'published',
  published_at: '2026-09-02T08:00:00Z',
  pinned: true,
  requires_ack: true,
  created_at: '2026-09-02T08:00:00Z',
  updated_at: '2026-09-02T08:00:00Z',
  gyms: null,
}

const gymDraft = {
  ...companyPost,
  id: 'post-2',
  gym_id: 'gym-nord',
  title: 'Setting day moved',
  status: 'draft',
  published_at: null,
  pinned: false,
  requires_ack: false,
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord' },
}

beforeEach(() => {
  vi.clearAllMocks()
  feedRows.mockReturnValue({ data: [companyPost, gymDraft], error: null })
  profile.mockReturnValue({
    id: 'user-1',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [nordMembership],
  })
  gymScope.mockReturnValue({ gymId: 'gym-nord' })
})

describe('postDate', () => {
  it('dates a published post by its publication and a draft by its last edit', () => {
    expect(
      postDate(
        {
          status: 'published',
          published_at: '2026-09-02T08:00:00Z',
          updated_at: '2026-08-01T08:00:00Z',
        },
        'en',
      ),
    ).toContain('Sep 2, 2026')
    expect(
      postDate(
        { status: 'draft', published_at: null, updated_at: '2026-08-30T10:00:00Z' },
        'en',
      ),
    ).toContain('Aug 30, 2026')
  })
})

describe('NewsFeed', () => {
  it('shows where a post applies, and marks drafts, pins and acknowledgements', async () => {
    renderWithProviders(<NewsFeed />)

    const [company, gym] = await screen.findAllByRole('listitem')
    expect(within(company!).getByText('Company-wide')).toBeInTheDocument()
    expect(within(company!).getByText('Pinned')).toBeInTheDocument()
    expect(within(company!).getByText('Must be acknowledged')).toBeInTheDocument()
    expect(within(company!).getByText('Only liquid chalk.')).toBeInTheDocument()
    expect(within(gym!).getByText('Draft')).toBeInTheDocument()
    expect(within(gym!).getByText('Copenhagen Nord')).toBeInTheDocument()
  })

  it('offers writing and pinning only where the viewer may publish', async () => {
    renderWithProviders(<NewsFeed />)

    const [company, gym] = await screen.findAllByRole('listitem')
    // A manager of Copenhagen Nord: their own gym's post, not the company one.
    expect(
      within(company!).queryByRole('button', { name: 'Unpin' }),
    ).not.toBeInTheDocument()
    expect(within(gym!).getByRole('button', { name: 'Pin' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New post' })).toBeInTheDocument()
  })

  it('gives staff a read-only feed', async () => {
    profile.mockReturnValue({
      id: 'user-2',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'staff', gyms: nordMembership.gyms }],
    })
    renderWithProviders(<NewsFeed />)

    await screen.findAllByRole('listitem')
    expect(screen.queryByRole('link', { name: 'New post' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pin' })).not.toBeInTheDocument()
  })

  it('pins a post from the feed', async () => {
    renderWithProviders(<NewsFeed />)

    await userEvent.click(await screen.findByRole('button', { name: 'Pin' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith({ pinned: true }))
  })
})

describe('PostEditorPage', () => {
  it('writes a draft into the gym the author manages', async () => {
    renderWithProviders(<PostEditorPage />, { path: '/news/new' })

    await userEvent.type(screen.getByLabelText('Headline'), 'Setting day moved')
    await userEvent.type(screen.getByLabelText('Body'), 'To Thursday.')
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }))

    await waitFor(() => expect(insert).toHaveBeenCalled())
    expect(insert.mock.lastCall?.[0]).toMatchObject({
      gym_id: 'gym-nord',
      title: 'Setting day moved',
      status: 'draft',
      requires_ack: false,
    })
  })

  it('publishes with the acknowledgement flag when asked', async () => {
    renderWithProviders(<PostEditorPage />, { path: '/news/new' })

    await userEvent.type(screen.getByLabelText('Headline'), 'New chalk policy')
    await userEvent.type(screen.getByLabelText('Body'), 'Only liquid chalk.')
    await userEvent.click(
      screen.getByLabelText('Require everyone to confirm they have read this'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(insert).toHaveBeenCalled())
    expect(insert.mock.lastCall?.[0]).toMatchObject({
      status: 'published',
      requires_ack: true,
    })
  })

  it('does not offer company-wide to a manager, only to an admin', async () => {
    const { unmount } = renderWithProviders(<PostEditorPage />, { path: '/news/new' })
    await userEvent.click(screen.getByLabelText('Applies to'))
    // An option that must be there, so the absence below is a real absence
    // rather than a list that has not opened yet.
    expect(
      await screen.findByRole('option', { name: 'Copenhagen Nord' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Company-wide' })).not.toBeInTheDocument()
    unmount()

    profile.mockReturnValue({
      id: 'user-3',
      is_admin: true,
      is_superadmin: false,
      gym_memberships: [],
    })
    renderWithProviders(<PostEditorPage />, { path: '/news/new' })
    await userEvent.click(screen.getByLabelText('Applies to'))
    expect(
      await screen.findByRole('option', { name: 'Company-wide' }),
    ).toBeInTheDocument()
  })

  it('waits for the profile before defaulting the scope, rather than posting company-wide', async () => {
    // The profile that decides where an author may publish arrives a render
    // after the form mounts. Driving this in Chrome is how the bug showed up:
    // the select said "Aarhus C" while the upload went to `company/`.
    profile.mockReturnValueOnce(undefined as unknown as Row)
    renderWithProviders(<PostEditorPage />, { path: '/news/new' })

    await userEvent.type(screen.getByLabelText('Headline'), 'Setting day moved')
    await userEvent.type(screen.getByLabelText('Body'), 'To Thursday.')
    await userEvent.click(screen.getByRole('button', { name: 'Save as draft' }))

    await waitFor(() => expect(insert).toHaveBeenCalled())
    expect(insert.mock.lastCall?.[0]).toMatchObject({ gym_id: 'gym-nord' })
  })

  it('refuses to save a post with no body, and says which part is missing', async () => {
    renderWithProviders(<PostEditorPage />, { path: '/news/new' })

    expect(screen.getByText('Give the post a title.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Headline'), 'Empty')

    expect(screen.queryByText('Give the post a title.')).not.toBeInTheDocument()
    expect(screen.getByText('Write something in the body.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('PostDetailPage', () => {
  beforeEach(() => {
    feedRows.mockReturnValue({ data: [gymDraft], error: null })
  })

  it('renders the post and its editing controls', async () => {
    renderWithProviders(<PostDetailPage />, {
      path: '/news/:postId',
      initialEntries: ['/news/post-2'],
    })

    expect(
      await screen.findByRole('heading', { name: 'Setting day moved' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Only liquid chalk.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
  })

  it('publishes from the detail view', async () => {
    renderWithProviders(<PostDetailPage />, {
      path: '/news/:postId',
      initialEntries: ['/news/post-2'],
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }))

    await waitFor(() => expect(update).toHaveBeenCalledWith({ status: 'published' }))
  })

  it('asks before deleting, and then only soft-deletes', async () => {
    renderWithProviders(<PostDetailPage />, {
      path: '/news/:postId',
      initialEntries: ['/news/post-2'],
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(update).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.lastCall?.[0]).toHaveProperty('deleted_at')
  })

  it('hides the editing controls from a reader who cannot publish there', async () => {
    profile.mockReturnValue({
      id: 'user-2',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'staff', gyms: nordMembership.gyms }],
    })
    renderWithProviders(<PostDetailPage />, {
      path: '/news/:postId',
      initialEntries: ['/news/post-2'],
    })

    expect(
      await screen.findByRole('heading', { name: 'Setting day moved' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
  })
})
