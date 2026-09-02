import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCategoryTree,
  categoryWithDescendants,
  GuideAcknowledgement,
  GuideEditorPage,
  GuidesPage,
} from '@/features/guides'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const insert = vi.fn<(table: string, values: Row) => void>()
const update = vi.fn<(table: string, values: Row) => void>()
const upsert = vi.fn<(table: string, values: Row) => void>()
const profile = vi.fn<() => Row>()

function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    single: () => Promise.resolve({ data: tableRows(table)[0] ?? null, error: null }),
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
      insert: (values: Row) => {
        insert(table, values)
        return builder(table)
      },
      update: (values: Row) => {
        update(table, values)
        return builder(table)
      },
      upsert: (values: Row) => {
        upsert(table, values)
        return Promise.resolve({ error: null })
      },
      delete: () => builder(table),
    }),
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn() }) },
  },
}))

vi.mock('@/features/auth', () => ({
  useProfile: () => ({ data: profile() }),
  useAuth: () => ({ user: { id: 'user-1' } }),
}))
vi.mock('@/features/gyms', () => ({
  useGymScope: () => ({ gymId: 'gym-nord' }),
  useGyms: () => ({ data: [{ id: 'gym-nord', name: 'Copenhagen Nord', slug: 'nord' }] }),
}))

const categories = [
  { id: 'cat-handbook', gym_id: null, parent_id: null, name: 'Handbook', position: 0 },
  {
    id: 'cat-safety',
    gym_id: null,
    parent_id: 'cat-handbook',
    name: 'Safety',
    position: 0,
  },
  {
    id: 'cat-nord',
    gym_id: 'gym-nord',
    parent_id: null,
    name: 'Nord routines',
    position: 1,
  },
]

const guides = [
  {
    id: 'guide-1',
    gym_id: null,
    category_id: 'cat-safety',
    title: 'Evacuation',
    body: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Leave by the front.' }] },
      ],
    },
    status: 'published',
    published_at: '2026-09-01T08:00:00Z',
    requires_ack: true,
    version: 2,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
    gyms: null,
    guide_categories: { id: 'cat-safety', name: 'Safety' },
  },
  {
    id: 'guide-2',
    gym_id: 'gym-nord',
    category_id: 'cat-nord',
    title: 'Setting day',
    body: { type: 'doc', content: [] },
    status: 'draft',
    published_at: null,
    requires_ack: false,
    version: 1,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
    gyms: { id: 'gym-nord', name: 'Copenhagen Nord' },
    guide_categories: { id: 'cat-nord', name: 'Nord routines' },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  tableRows.mockImplementation((table) =>
    table === 'guide_categories' ? categories : table === 'guides' ? guides : [],
  )
  profile.mockReturnValue({
    id: 'user-1',
    is_admin: true,
    is_superadmin: false,
    gym_memberships: [],
  })
})

describe('the category tree', () => {
  it('nests categories under their parent, company and gym in one tree', () => {
    const tree = buildCategoryTree(categories)

    expect(tree.map((node) => node.name)).toEqual(['Handbook', 'Nord routines'])
    expect(tree[0]?.children.map((node) => node.name)).toEqual(['Safety'])
  })

  it('keeps a category whose parent the viewer cannot see', () => {
    const tree = buildCategoryTree([
      { id: 'orphan', gym_id: null, parent_id: 'hidden', name: 'Orphan', position: 0 },
    ])

    expect(tree.map((node) => node.name)).toEqual(['Orphan'])
  })

  it('selecting a category means the category and everything under it', () => {
    expect([...categoryWithDescendants(categories, 'cat-handbook')]).toEqual([
      'cat-handbook',
      'cat-safety',
    ])
  })
})

describe('GuidesPage', () => {
  it('lists every guide until a category is chosen, then only that branch', async () => {
    renderWithProviders(<GuidesPage />)

    expect(await screen.findByRole('link', { name: 'Evacuation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Setting day' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Handbook' }))

    // Evacuation sits in Safety, which is inside Handbook.
    expect(screen.getByRole('link', { name: 'Evacuation' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Setting day' })).not.toBeInTheDocument()
  })

  it('marks drafts, scope and the guides that must be confirmed', async () => {
    renderWithProviders(<GuidesPage />)

    const evacuation = (await screen.findByRole('link', { name: 'Evacuation' })).closest(
      'li',
    )
    const setting = screen.getByRole('link', { name: 'Setting day' }).closest('li')
    expect(within(evacuation!).getByText('Company-wide')).toBeInTheDocument()
    expect(within(evacuation!).getByText('Must be confirmed')).toBeInTheDocument()
    expect(within(setting!).getByText('Draft')).toBeInTheDocument()
  })

  it('gives staff a tree they can read but not reshape', async () => {
    profile.mockReturnValue({
      id: 'user-2',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [
        { role: 'staff', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
      ],
    })
    renderWithProviders(<GuidesPage />)

    expect(await screen.findByRole('button', { name: 'Handbook' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New guide' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New category' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Rename Handbook' }),
    ).not.toBeInTheDocument()
  })

  it('creates a category in the chosen scope', async () => {
    renderWithProviders(<GuidesPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Cleaning')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(insert).toHaveBeenCalled())
    expect(insert.mock.lastCall?.[0]).toBe('guide_categories')
    expect(insert.mock.lastCall?.[1]).toMatchObject({
      name: 'Cleaning',
      gym_id: null,
      parent_id: null,
    })
  })
})

describe('GuideEditorPage', () => {
  beforeEach(() => {
    tableRows.mockImplementation((table) =>
      table === 'guides'
        ? [guides[0] as Row]
        : table === 'guide_categories'
          ? categories
          : [],
    )
  })

  function renderEditor() {
    return renderWithProviders(<GuideEditorPage />, {
      path: '/guides/:guideId/edit',
      initialEntries: ['/guides/guide-1/edit'],
    })
  }

  it('says what a new guide is still missing rather than only greying out Save', async () => {
    renderWithProviders(<GuideEditorPage />, { path: '/guides/new' })

    expect(screen.getByText('Give the guide a title.')).toBeInTheDocument()
    expect(screen.getByText('Write something in the body.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Title'), 'Evacuation')
    expect(screen.queryByText('Give the guide a title.')).not.toBeInTheDocument()
  })

  it('leaves the version alone on an ordinary edit', async () => {
    renderEditor()

    // guide-1 is published, so the primary action is "Save".
    await userEvent.type(await screen.findByLabelText('Title'), ' plan')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.lastCall?.[1]).toMatchObject({ title: 'Evacuation plan' })
    expect(update.mock.lastCall?.[1]).not.toHaveProperty('version')
  })

  it('bumps the version when the change is called significant, so everyone confirms again', async () => {
    renderEditor()

    await userEvent.click(
      await screen.findByLabelText('Significant change — everyone must confirm again'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.lastCall?.[1]).toMatchObject({ version: 3 })
  })
})

describe('GuideAcknowledgement', () => {
  const guide = { id: 'guide-1', requires_ack: true, version: 2 }

  it('records the version that was confirmed', async () => {
    renderWithProviders(<GuideAcknowledgement guide={guide} />)

    await userEvent.click(await screen.findByRole('button', { name: 'I have read this' }))

    await waitFor(() => expect(upsert).toHaveBeenCalled())
    expect(upsert.mock.lastCall?.[1]).toMatchObject({
      guide_id: 'guide-1',
      user_id: 'user-1',
      version: 2,
    })
  })

  it('asks again once the guide has moved past the confirmed version', async () => {
    tableRows.mockImplementation((table) =>
      table === 'guide_acks'
        ? [{ version: 1, acknowledged_at: '2026-08-01T08:00:00Z' }]
        : [],
    )
    renderWithProviders(<GuideAcknowledgement guide={guide} />)

    expect(
      await screen.findByText('This guide has changed since you confirmed it.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Confirm the new version' }),
    ).toBeInTheDocument()
  })

  it('stays quiet when the confirmation is up to date', async () => {
    tableRows.mockImplementation((table) =>
      table === 'guide_acks'
        ? [{ version: 2, acknowledged_at: '2026-09-02T08:00:00Z' }]
        : [],
    )
    renderWithProviders(<GuideAcknowledgement guide={guide} />)

    expect(await screen.findByText(/Confirmed/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
