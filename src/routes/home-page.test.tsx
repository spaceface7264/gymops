import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '@/routes/home-page'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const postRows = vi.fn<() => Row[]>()
const tableRows = vi.fn<(table: string) => Row[]>()

// Every card on the home page reads a different table, so the stub answers by
// table: rows meant for the news block must not turn up under the checklists.
function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    gte: () => chain,
    lte: () => chain,
    or: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: table === 'posts' ? postRows() : tableRows(table),
        error: null,
      }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => builder(table) },
}))
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

const run = (overrides: Row = {}): Row => ({
  id: 'run-1',
  gym_id: 'gym-nord',
  run_date: '2026-09-02',
  checklist_templates: { id: 'template-1', name: 'Morning open' },
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord', timezone: 'Europe/Copenhagen' },
  checklist_run_items: [
    { id: 'item-1', position: 1, label: 'Mats', required: true, done_at: null },
    { id: 'item-2', position: 2, label: 'Chalk', required: true, done_at: null },
  ],
  ...overrides,
})

const incident = (overrides: Row = {}): Row => ({
  id: 'incident-1',
  gym_id: 'gym-nord',
  kind: 'equipment',
  severity: 'low',
  status: 'open',
  title: 'Hold broke on wall 4',
  body: 'A crimp sheared off.',
  assignee_id: null,
  resolved_at: null,
  created_at: '2026-09-02T15:00:00Z',
  created_by: 'user-mette',
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord', timezone: 'Europe/Copenhagen' },
  reporter: { id: 'user-mette', full_name: 'Mette Manager' },
  assignee: null,
  ...overrides,
})

const logEntry = (overrides: Row = {}): Row => ({
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

/** One card on the page, addressed by its title (`CardTitle` is a div). */
const block = (title: string) =>
  screen.getByText(title).closest('[data-slot="card"]') as HTMLElement

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-02T16:00:00Z'))
  vi.clearAllMocks()
  postRows.mockReturnValue([])
  tableRows.mockReturnValue([])
})

afterEach(() => vi.useRealTimers())

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

    await screen.findByText('Setting day moved')
    const [first, second] = within(block('News for you')).getAllByRole('listitem')
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
    expect(within(block('News for you')).queryByRole('listitem')).not.toBeInTheDocument()
  })
})

describe('the rest of the home page (P4-10)', () => {
  it("puts today's unfinished checklists above the finished ones", async () => {
    tableRows.mockImplementation((table) =>
      table === 'checklist_runs'
        ? [
            run({
              id: 'run-done',
              checklist_templates: { id: 'template-2', name: 'Evening close' },
              checklist_run_items: [
                {
                  id: 'item-3',
                  position: 1,
                  label: 'Lights',
                  required: true,
                  done_at: '2026-09-02T15:00:00Z',
                },
              ],
            }),
            run(),
          ]
        : [],
    )
    renderWithProviders(<HomePage />)

    await screen.findByText('Morning open')
    const items = within(block("Today's checklists")).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Morning open')
    expect(items[0]).toHaveTextContent('0 of 2 done')
    expect(items[1]).toHaveTextContent('Evening close')
    expect(items[1]).toHaveTextContent('Complete')
  })

  it('leaves out a run dated to another gym’s day', async () => {
    tableRows.mockImplementation((table) =>
      table === 'checklist_runs' ? [run({ run_date: '2026-09-01' })] : [],
    )
    renderWithProviders(<HomePage />)

    expect(await screen.findByText('Nothing is scheduled for today.')).toBeInTheDocument()
  })

  it('lists the open incidents worst first, and links to each', async () => {
    tableRows.mockImplementation((table) =>
      table === 'incidents'
        ? [
            incident({ id: 'incident-low', title: 'Chalk bucket empty' }),
            incident({
              id: 'incident-high',
              severity: 'high',
              title: 'Hold broke on wall 4',
              assignee: { id: 'user-sam', full_name: 'Sam Staff' },
            }),
          ]
        : [],
    )
    renderWithProviders(<HomePage />)

    await screen.findByText('Hold broke on wall 4')
    const [worst, next] = within(block('Open incidents')).getAllByRole('listitem')
    expect(worst).toHaveTextContent('High')
    expect(worst).toHaveTextContent('Assigned to Sam Staff')
    expect(within(worst as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/incidents/incident-high',
    )
    expect(next).toHaveTextContent('Chalk bucket empty')
    expect(next).toHaveTextContent('Nobody yet')
  })

  it('caps the incident list and says how many there are', async () => {
    tableRows.mockImplementation((table) =>
      table === 'incidents'
        ? Array.from({ length: 7 }, (_row, index) =>
            incident({ id: `incident-${index}`, title: `Incident ${index}` }),
          )
        : [],
    )
    renderWithProviders(<HomePage />)

    await screen.findByText('Incident 0')
    const open = block('Open incidents')
    expect(within(open).getAllByRole('listitem')).toHaveLength(5)
    expect(
      within(open).getByRole('link', { name: 'All 7 open incidents' }),
    ).toBeInTheDocument()
  })

  it('shows the last thing written in the log', async () => {
    tableRows.mockImplementation((table) =>
      table === 'daily_log_entries' ? [logEntry()] : [],
    )
    renderWithProviders(<HomePage />)

    await screen.findByText('Wall 4 is taped off')
    const log = block('Latest in the log')
    expect(within(log).getByText('Handover')).toBeInTheDocument()
    expect(within(log).getByText(/Mette Manager/)).toBeInTheDocument()
    expect(within(log).getByRole('link', { name: 'The whole log' })).toHaveAttribute(
      'href',
      '/daily-log',
    )
  })

  it('says so when each block is empty', async () => {
    renderWithProviders(<HomePage />)

    expect(await screen.findByText('Nothing is scheduled for today.')).toBeInTheDocument()
    expect(
      within(block('Open incidents')).getByText('Nothing is open here.'),
    ).toBeInTheDocument()
    expect(
      within(block('Latest in the log')).getByText('Nothing has been logged here yet.'),
    ).toBeInTheDocument()
  })
})
