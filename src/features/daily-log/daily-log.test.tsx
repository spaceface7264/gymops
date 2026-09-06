import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DailyLogPage, incidentDraft, parseTags } from '@/features/daily-log'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const insert = vi.fn<(table: string, values: Row) => void>()
const update = vi.fn<(table: string, values: Row) => void>()
const filters = vi.fn<(method: string, args: unknown[]) => void>()
const profile = vi.fn<() => Row>()
const gymScope = vi.fn<() => Row>()

function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: (...args: unknown[]) => {
      filters('eq', args)
      return chain
    },
    contains: (...args: unknown[]) => {
      filters('contains', args)
      return chain
    },
    is: () => chain,
    order: () => chain,
    limit: () => chain,
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
    }),
  },
}))

vi.mock('@/features/auth', () => ({
  useProfile: () => ({ data: profile() }),
  useAuth: () => ({ user: { id: 'user-sam' } }),
}))
vi.mock('@/features/gyms', () => ({
  useGymScope: () => gymScope(),
  useGyms: () => ({ data: [{ id: 'gym-nord', name: 'Copenhagen Nord', slug: 'nord' }] }),
}))

const entry = (overrides: Row = {}): Row => ({
  id: 'entry-1',
  gym_id: 'gym-nord',
  kind: 'handover',
  body: 'Wall 4 is taped off',
  tags: ['wall4'],
  created_at: '2026-09-02T15:00:00Z',
  updated_at: '2026-09-02T15:00:00Z',
  created_by: 'user-mette',
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord', timezone: 'Europe/Copenhagen' },
  author: { id: 'user-mette', full_name: 'Mette Manager' },
  ...overrides,
})

const asStaff = () =>
  profile.mockReturnValue({
    id: 'user-sam',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [
      { role: 'staff', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
    ],
  })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-02T16:00:00Z'))
  vi.clearAllMocks()
  tableRows.mockImplementation((table) =>
    table === 'daily_log_entries' ? [entry()] : [],
  )
  gymScope.mockReturnValue({ gymId: 'gym-nord' })
  asStaff()
})

afterEach(() => vi.useRealTimers())

describe('tags as typed', () => {
  it('splits on commas and drops the hash and the blanks', () => {
    expect(parseTags(' #Wall4, broken ,, ')).toEqual(['Wall4', 'broken'])
    expect(parseTags('')).toEqual([])
  })
})

// The composer's own hint list is a <ul> too, so the timeline is addressed by
// the date its entries are grouped under.
const timelineEntries = async (day = '2026-09-02') => {
  const list = await screen.findByRole('list', { name: day })
  const [first, ...rest] = within(list).getAllByRole('listitem')
  return [first as HTMLElement, ...rest] as const
}

describe('the daily log', () => {
  it('shows an entry with its kind, author, body and tags', async () => {
    renderWithProviders(<DailyLogPage />)

    const [card] = await timelineEntries()
    expect(within(card).getByText('Handover')).toBeInTheDocument()
    expect(within(card).getByText(/Mette Manager/)).toBeInTheDocument()
    expect(within(card).getByText('Wall 4 is taped off')).toBeInTheDocument()
    expect(within(card).getByText('#wall4')).toBeInTheDocument()
  })

  it('writes an entry into the gym in scope', async () => {
    renderWithProviders(<DailyLogPage />)

    await userEvent.type(
      await screen.findByLabelText('What happened'),
      'Front door lock is stiff',
    )
    await userEvent.type(screen.getByLabelText('Tags'), '#door, maintenance')
    await userEvent.click(screen.getByRole('button', { name: 'Add to the log' }))

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith('daily_log_entries', {
        gym_id: 'gym-nord',
        kind: 'note',
        body: 'Front door lock is stiff',
        tags: ['door', 'maintenance'],
      }),
    )
  })

  it('says what is missing instead of a dead button', async () => {
    renderWithProviders(<DailyLogPage />)

    const body = await screen.findByLabelText('What happened')
    expect(screen.queryByText(/Write what happened/)).not.toBeInTheDocument()
    // An untouched form says nothing (P7M-07); the first keystroke turns the hints on.
    await userEvent.type(body, 'x')
    await userEvent.clear(body)
    expect(screen.getByText(/Write what happened/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to the log' })).toBeDisabled()
  })

  it('asks the database for one kind, and for one tag', async () => {
    renderWithProviders(<DailyLogPage />)

    await timelineEntries()
    await userEvent.click(screen.getByRole('radio', { name: 'Issue' }))

    await waitFor(() => expect(filters).toHaveBeenCalledWith('eq', ['kind', 'issue']))

    await userEvent.selectOptions(screen.getByLabelText('Tag'), 'wall4')
    await waitFor(() =>
      expect(filters).toHaveBeenCalledWith('contains', ['tags', ['wall4']]),
    )
  })

  it('offers editing to the author only, and removal to a manager', async () => {
    renderWithProviders(<DailyLogPage />)

    // Sam did not write this one, and is not a manager here.
    const [card] = await timelineEntries()
    expect(within(card).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()

    cleanup()
    profile.mockReturnValue({
      id: 'user-sam',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [
        { role: 'manager', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
      ],
    })
    renderWithProviders(<DailyLogPage />)

    // A manager may take it off the timeline but not rewrite it, which is the
    // rule the trigger enforces server-side.
    const [managed] = await timelineEntries()
    expect(
      within(managed).queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument()
    await userEvent.click(within(managed).getByRole('button', { name: 'Remove' }))
    // Removing asks first (P7D-03).
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const [table, values] = update.mock.calls[0] as [string, { deleted_at: string }]
    expect(table).toBe('daily_log_entries')
    expect(Object.keys(values)).toEqual(['deleted_at'])
  })

  it('lets the author rewrite their own entry', async () => {
    tableRows.mockImplementation((table) =>
      table === 'daily_log_entries'
        ? [
            entry({
              created_by: 'user-sam',
              author: { id: 'user-sam', full_name: 'Sam Staff' },
            }),
          ]
        : [],
    )
    renderWithProviders(<DailyLogPage />)

    const [card] = await timelineEntries()
    const own = card
    await userEvent.click(within(own).getByRole('button', { name: 'Edit' }))
    const body = within(own).getByLabelText('What happened')
    await userEvent.clear(body)
    await userEvent.type(body, 'Wall 4 is open again')
    await userEvent.click(within(own).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('daily_log_entries', {
        kind: 'handover',
        body: 'Wall 4 is open again',
        tags: ['wall4'],
      }),
    )
  })

  it('will not offer the composer when no gym is in scope', async () => {
    gymScope.mockReturnValue({ gymId: null })
    renderWithProviders(<DailyLogPage />)

    expect(await screen.findByText(/Pick a gym/)).toBeInTheDocument()
    expect(screen.queryByLabelText('What happened')).not.toBeInTheDocument()
  })

  it('tells someone from another gym that the log is not theirs to write in', async () => {
    profile.mockReturnValue({
      id: 'user-sam',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'staff', gyms: { id: 'gym-aarhus', name: 'Aarhus C' } }],
    })
    renderWithProviders(<DailyLogPage />)

    expect(await screen.findByText(/Only this gym's team/)).toBeInTheDocument()
  })
})

describe('an issue becoming an incident', () => {
  it('takes the first line as the title and keeps the tags with the story', () => {
    expect(
      incidentDraft({ body: 'Hold broke on wall 4\nTaped it off.', tags: ['wall4'] }),
    ).toEqual({
      title: 'Hold broke on wall 4',
      body: 'Hold broke on wall 4\nTaped it off.\n\n#wall4',
    })
  })

  it('cuts a title that would not fit the list', () => {
    const { title } = incidentDraft({ body: 'x'.repeat(120), tags: [] })
    expect(title).toHaveLength(81)
    expect(title.endsWith('…')).toBe(true)
  })

  it('offers the conversion on an issue, to whoever may report there', async () => {
    tableRows.mockImplementation((table) =>
      table === 'daily_log_entries'
        ? [entry({ kind: 'issue', body: 'Hold broke on wall 4', tags: ['wall4'] })]
        : [],
    )
    renderWithProviders(<DailyLogPage />)

    const [card] = await timelineEntries()
    const link = within(card).getByRole('link', { name: 'Report as an incident' })
    expect(link).toHaveAttribute(
      'href',
      '/incidents/new?title=Hold+broke+on+wall+4&body=Hold+broke+on+wall+4%0A%0A%23wall4',
    )
  })

  it('leaves a handover alone', async () => {
    renderWithProviders(<DailyLogPage />)

    const [card] = await timelineEntries()
    expect(
      within(card).queryByRole('link', { name: 'Report as an incident' }),
    ).not.toBeInTheDocument()
  })

  it('does not offer it in a gym this person does not work in', async () => {
    profile.mockReturnValue({
      id: 'user-sam',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'staff', gyms: { id: 'gym-aarhus', name: 'Aarhus C' } }],
    })
    tableRows.mockImplementation((table) =>
      table === 'daily_log_entries' ? [entry({ kind: 'issue' })] : [],
    )
    renderWithProviders(<DailyLogPage />)

    const [card] = await timelineEntries()
    expect(
      within(card).queryByRole('link', { name: 'Report as an incident' }),
    ).not.toBeInTheDocument()
  })
})
