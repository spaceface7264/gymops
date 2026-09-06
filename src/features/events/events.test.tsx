import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventsPage } from '@/features/events'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const insert = vi.fn<(table: string, values: Row) => void>()
const update = vi.fn<(table: string, values: Row) => void>()
const filters = vi.fn<(method: string, args: unknown[]) => void>()
const profile = vi.fn<() => Row>()
const gymScope = vi.fn<() => Row>()

function builder(table: string) {
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      filters(method, args)
      return chain
    }

  const chain: Record<string, unknown> = {
    select: () => chain,
    single: () => Promise.resolve({ data: { id: 'event-new' }, error: null }),
    eq: record('eq'),
    gte: record('gte'),
    lte: record('lte'),
    lt: record('lt'),
    is: record('is'),
    or: record('or'),
    order: () => chain,
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
      delete: () => builder(table),
    }),
  },
}))

vi.mock('@/features/auth', () => ({
  useProfile: () => ({ data: profile() }),
  useAuth: () => ({ user: { id: 'user-sam' } }),
}))
vi.mock('@/features/gyms', () => ({
  useGymScope: () => gymScope(),
  useGyms: () => ({
    data: [
      { id: 'gym-nord', name: 'Copenhagen Nord' },
      { id: 'gym-aarhus', name: 'Aarhus C' },
    ],
  }),
}))

const event = (overrides: Row = {}): Row => ({
  id: 'event-1',
  event_type: 'community',
  title: 'Bouldering league',
  description: 'Three nights of qualifiers.',
  link: null,
  starts_on: '2026-09-10',
  start_time: '19:00:00',
  ends_on: null,
  end_time: '21:00:00',
  last_on: '2026-09-10',
  event_gyms: [{ gym_id: 'gym-nord', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } }],
  ...overrides,
})

const asStaff = () =>
  profile.mockReturnValue({
    id: 'user-sam',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [{ role: 'staff', gyms: { id: 'gym-nord' } }],
  })

const asManager = () =>
  profile.mockReturnValue({
    id: 'user-sam',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [{ role: 'manager', gyms: { id: 'gym-nord' } }],
  })

const asAdmin = () =>
  profile.mockReturnValue({
    id: 'user-sam',
    is_admin: true,
    is_superadmin: false,
    gym_memberships: [],
  })

beforeEach(() => {
  vi.clearAllMocks()
  tableRows.mockImplementation((table) => (table === 'events' ? [event()] : []))
  gymScope.mockReturnValue({ gymId: 'gym-nord' })
  asStaff()
})

describe('who may add an event', () => {
  it('offers nothing to staff', async () => {
    renderWithProviders(<EventsPage />, { path: '/events' })

    await screen.findByText('Bouldering league')
    expect(screen.queryByRole('button', { name: 'New event' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument()
  })

  // The whole point of this module's RLS: managers publish their own gym's news
  // and guides, but the calendar is run centrally.
  it('offers nothing to a manager either', async () => {
    asManager()
    renderWithProviders(<EventsPage />, { path: '/events' })

    await screen.findByText('Bouldering league')
    expect(screen.queryByRole('button', { name: 'New event' })).not.toBeInTheDocument()
  })

  it('offers it to an admin', async () => {
    asAdmin()
    renderWithProviders(<EventsPage />, { path: '/events' })

    await screen.findByText('Bouldering league')
    expect(screen.getByRole('button', { name: 'New event' })).toBeInTheDocument()
  })
})

describe('the list', () => {
  it('asks for what is still running and reads the gym plus company-wide', async () => {
    renderWithProviders(<EventsPage />, { path: '/events' })

    await screen.findByText('Bouldering league')
    expect(filters).toHaveBeenCalledWith('is', ['deleted_at', null])
    expect(filters.mock.calls.some(([method]) => method === 'gte')).toBe(true)
  })

  it('shows a single date with its times, and where it is on', async () => {
    renderWithProviders(<EventsPage />, { path: '/events' })

    const card = (await screen.findByText('Bouldering league')).closest('div')!
    expect(within(card).getByText(/Sep 10, 2026, 19:00–21:00/)).toBeInTheDocument()
    expect(within(card).getByText('Community')).toBeInTheDocument()
    expect(within(card).getByText('Copenhagen Nord')).toBeInTheDocument()
  })

  it('shows a range as a range', async () => {
    tableRows.mockReturnValue([
      event({
        start_time: null,
        end_time: null,
        ends_on: '2026-09-12',
        last_on: '2026-09-12',
      }),
    ])
    renderWithProviders(<EventsPage />, { path: '/events' })

    expect(await screen.findByText(/Sep 10 – Sep 12, 2026/)).toBeInTheDocument()
  })

  it('hands an outward link nothing it can use', async () => {
    tableRows.mockReturnValue([event({ link: 'https://example.com/league?utm=long' })])
    renderWithProviders(<EventsPage />, { path: '/events' })

    const link = await screen.findByRole('link', { name: /example\.com/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow')
  })

  it('switches to what is over', async () => {
    renderWithProviders(<EventsPage />, { path: '/events' })

    await screen.findByText('Bouldering league')
    await userEvent.click(screen.getByRole('button', { name: 'Earlier' }))
    await waitFor(() =>
      expect(filters.mock.calls.some(([method]) => method === 'lt')).toBe(true),
    )
  })
})

describe('the calendar', () => {
  it('places a three-day event on each of its days', async () => {
    tableRows.mockReturnValue([
      event({
        start_time: null,
        end_time: null,
        ends_on: '2026-09-12',
        last_on: '2026-09-12',
      }),
    ])
    renderWithProviders(<EventsPage />, {
      path: '/events',
      initialEntries: ['/events?view=calendar&month=2026-09'],
    })

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Bouldering league' })).toHaveLength(
        3,
      ),
    )
  })

  it('asks for everything overlapping the month', async () => {
    renderWithProviders(<EventsPage />, {
      path: '/events',
      initialEntries: ['/events?view=calendar&month=2026-09'],
    })

    await waitFor(() =>
      expect(filters).toHaveBeenCalledWith('gte', ['last_on', '2026-09-01']),
    )
    expect(filters).toHaveBeenCalledWith('lte', ['starts_on', '2026-09-30'])
  })
})

describe('the form', () => {
  it('says what is missing before it lets the event be saved', async () => {
    asAdmin()
    renderWithProviders(<EventsPage />, { path: '/events' })

    await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
    // An untouched form says nothing (P7M-07); the first keystroke turns the hints on.
    const touched = await screen.findByLabelText('Link')
    await userEvent.type(touched, 'x')
    await userEvent.clear(touched)
    expect(await screen.findByText('Give the event a title.')).toBeInTheDocument()
    expect(screen.getByText('Give the event a start date.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('refuses a link that is not http(s)', async () => {
    asAdmin()
    renderWithProviders(<EventsPage />, { path: '/events' })

    await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
    await userEvent.type(await screen.findByLabelText('Link'), 'javascript:alert(1)')

    expect(
      await screen.findByText('A link must start with http:// or https://.'),
    ).toBeInTheDocument()
  })

  it('saves an empty link and an empty end as null, not as blanks', async () => {
    asAdmin()
    renderWithProviders(<EventsPage />, { path: '/events' })

    await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
    await userEvent.type(await screen.findByLabelText('Title'), 'Members evening')
    await userEvent.type(screen.getByLabelText('Start date'), '2026-10-01')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith(
        'events',
        expect.objectContaining({
          title: 'Members evening',
          starts_on: '2026-10-01',
          ends_on: null,
          end_time: null,
          link: null,
        }),
      ),
    )
  })
})

describe('an event at several gyms', () => {
  it('names both gyms it runs at', async () => {
    tableRows.mockReturnValue([
      event({
        event_gyms: [
          { gym_id: 'gym-nord', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
          { gym_id: 'gym-aarhus', gyms: { id: 'gym-aarhus', name: 'Aarhus C' } },
        ],
      }),
    ])
    renderWithProviders(<EventsPage />, { path: '/events' })

    const card = (await screen.findByText('Bouldering league')).closest('div')!
    expect(within(card).getByText('Copenhagen Nord')).toBeInTheDocument()
    expect(within(card).getByText('Aarhus C')).toBeInTheDocument()
  })

  it('counts them once there are too many to name', async () => {
    tableRows.mockReturnValue([
      event({
        event_gyms: ['gym-nord', 'gym-aarhus', 'gym-odense'].map((id) => ({
          gym_id: id,
          gyms: { id, name: id },
        })),
      }),
    ])
    renderWithProviders(<EventsPage />, { path: '/events' })

    expect(await screen.findByText('3 gyms')).toBeInTheDocument()
  })

  it('reads a company-wide event in every gym', async () => {
    tableRows.mockReturnValue([event({ event_gyms: [] })])
    renderWithProviders(<EventsPage />, { path: '/events' })

    expect(await screen.findByText('Company-wide')).toBeInTheDocument()
  })

  it("leaves another gym's event out of this gym", async () => {
    tableRows.mockReturnValue([
      event({
        event_gyms: [
          { gym_id: 'gym-aarhus', gyms: { id: 'gym-aarhus', name: 'Aarhus C' } },
        ],
      }),
    ])
    renderWithProviders(<EventsPage />, { path: '/events' })

    expect(await screen.findByText('Nothing is coming up here.')).toBeInTheDocument()
  })

  it('writes one scope row per gym picked, and no copies of the event', async () => {
    asAdmin()
    renderWithProviders(<EventsPage />, { path: '/events' })

    await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
    await userEvent.type(await screen.findByLabelText('Title'), 'League night')
    await userEvent.type(screen.getByLabelText('Start date'), '2026-10-01')
    await userEvent.click(screen.getByRole('button', { name: 'Aarhus C' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith('event_gyms', [
        { event_id: 'event-new', gym_id: 'gym-nord' },
        { event_id: 'event-new', gym_id: 'gym-aarhus' },
      ]),
    )
    expect(insert.mock.calls.filter(([table]) => table === 'events')).toHaveLength(1)
  })

  it('clears the gyms when the event goes company-wide', async () => {
    asAdmin()
    renderWithProviders(<EventsPage />, { path: '/events' })

    await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
    await userEvent.type(await screen.findByLabelText('Title'), 'Everywhere')
    await userEvent.type(screen.getByLabelText('Start date'), '2026-10-01')
    await userEvent.click(screen.getByRole('button', { name: 'Company-wide' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(insert.mock.calls.some(([table]) => table === 'events')).toBe(true),
    )
    expect(insert.mock.calls.some(([table]) => table === 'event_gyms')).toBe(false)
  })
})
