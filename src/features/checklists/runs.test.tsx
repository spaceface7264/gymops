import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChecklistRunsPage, localDate } from '@/features/checklists'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const update = vi.fn<(table: string, values: Row) => void>()
const profile = vi.fn<() => Row>()
const channel = vi.fn<(topic: string, options: Row) => void>()
const gymScope = vi.fn<() => Row>()
let realtimeHandler: (() => void) | undefined

function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
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
      update: (values: Row) => {
        update(table, values)
        return builder(table)
      },
    }),
    channel: (topic: string, options: Row) => {
      channel(topic, options)
      const subscription = {
        on: (_event: string, _filter: Row, handler: () => void) => {
          realtimeHandler = handler
          return subscription
        },
        subscribe: () => subscription,
      }
      return subscription
    },
    removeChannel: vi.fn(),
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

const today = localDate('Europe/Copenhagen', new Date('2026-09-02T09:00:00Z'))

const run = {
  id: 'run-1',
  template_id: 'template-1',
  gym_id: 'gym-nord',
  run_date: today,
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord', timezone: 'Europe/Copenhagen' },
  checklist_templates: { name: 'Morning opening', kind: 'opening' },
  checklist_run_items: [
    {
      id: 'item-door',
      position: 1,
      label: 'Unlock the front door',
      required: true,
      done_at: '2026-09-02T05:10:00Z',
      done_by: 'user-2',
      note: null,
      profiles: { id: 'user-2', full_name: 'Mette Manager' },
    },
    {
      id: 'item-chalk',
      position: 2,
      label: 'Empty the chalk buckets',
      required: true,
      done_at: null,
      done_by: null,
      note: null,
      profiles: null,
    },
    {
      id: 'item-plants',
      position: 3,
      label: 'Water the plants',
      required: false,
      done_at: null,
      done_by: null,
      note: 'Left dry over the weekend',
      profiles: null,
    },
  ],
}

const asStaffOfNord = () =>
  profile.mockReturnValue({
    id: 'user-1',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [
      { role: 'staff', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
    ],
  })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-02T09:00:00Z'))
  vi.clearAllMocks()
  realtimeHandler = undefined
  tableRows.mockImplementation((table) => (table === 'checklist_runs' ? [run] : []))
  gymScope.mockReturnValue({ gymId: 'gym-nord' })
  asStaffOfNord()
})

afterEach(() => vi.useRealTimers())

describe('the local date', () => {
  it('is the gym’s date, not the device’s', () => {
    // 23:30 UTC on the 2nd is already the 3rd in Copenhagen, and still the 2nd
    // in New York.
    const at = new Date('2026-09-02T23:30:00Z')
    expect(localDate('Europe/Copenhagen', at)).toBe('2026-09-03')
    expect(localDate('America/New_York', at)).toBe('2026-09-02')
  })
})

describe("today's runs", () => {
  it('shows the checklist, its progress and who ticked what', async () => {
    renderWithProviders(<ChecklistRunsPage />)

    expect(await screen.findByText('Morning opening')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    expect(screen.getByText(/Done by Mette Manager/)).toBeInTheDocument()
    expect(screen.getByText('Optional')).toBeInTheDocument()
    expect(screen.queryByText('Complete')).not.toBeInTheDocument()
  })

  it('drops a run dated to another day in the gym’s own zone', async () => {
    tableRows.mockImplementation((table) =>
      table === 'checklist_runs' ? [{ ...run, run_date: '2026-09-01' }] : [],
    )
    renderWithProviders(<ChecklistRunsPage />)

    expect(await screen.findByText(/Nothing is scheduled/)).toBeInTheDocument()
  })

  it('ticks an item off, leaving who and when to the database', async () => {
    renderWithProviders(<ChecklistRunsPage />)

    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Empty the chalk buckets' }),
    )

    // Only `done_at` goes over the wire: `done_by` is stamped from the
    // session by a trigger, and a client cannot claim someone else ticked.
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const [table, values] = update.mock.calls[0] as [string, { done_at: string }]
    expect(table).toBe('checklist_run_items')
    expect(Object.keys(values)).toEqual(['done_at'])
    expect(values.done_at).toContain('2026-09-02T09:00:00')
  })

  it('saves a note when the field is left, and only if it changed', async () => {
    renderWithProviders(<ChecklistRunsPage />)

    const note = await screen.findByLabelText('Note on Empty the chalk buckets')
    await userEvent.type(note, 'Bucket by the cave is cracked')
    await userEvent.tab()

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('checklist_run_items', {
        note: 'Bucket by the cave is cracked',
      }),
    )

    update.mockClear()
    const untouched = screen.getByLabelText('Note on Water the plants')
    await userEvent.click(untouched)
    await userEvent.tab()
    expect(update).not.toHaveBeenCalled()
  })

  it('is read-only for someone who does not work at that gym', async () => {
    profile.mockReturnValue({
      id: 'user-1',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'staff', gyms: { id: 'gym-aarhus', name: 'Aarhus C' } }],
    })
    renderWithProviders(<ChecklistRunsPage />)

    expect(await screen.findByText(/Only this gym's team/)).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Empty the chalk buckets' }),
    ).toBeDisabled()
  })

  it('marks a run complete once every required item is ticked', async () => {
    tableRows.mockImplementation((table) =>
      table === 'checklist_runs'
        ? [
            {
              ...run,
              checklist_run_items: run.checklist_run_items.map((item) =>
                item.required ? { ...item, done_at: '2026-09-02T05:10:00Z' } : item,
              ),
            },
          ]
        : [],
    )
    renderWithProviders(<ChecklistRunsPage />)

    expect(await screen.findByText('Complete')).toBeInTheDocument()
    expect(screen.getByText('2 of 2 done')).toBeInTheDocument()
  })

  it('listens on the gym’s own private channel and refetches on a change', async () => {
    renderWithProviders(<ChecklistRunsPage />)
    await screen.findByText('Morning opening')

    expect(channel).toHaveBeenCalledWith('checklists:gym-nord', {
      config: { private: true },
    })

    tableRows.mockImplementation((table) =>
      table === 'checklist_runs'
        ? [
            {
              ...run,
              checklist_run_items: run.checklist_run_items.map((item) =>
                item.id === 'item-chalk'
                  ? { ...item, done_at: '2026-09-02T09:05:00Z' }
                  : item,
              ),
            },
          ]
        : [],
    )
    realtimeHandler?.()

    expect(await screen.findByText('2 of 2 done')).toBeInTheDocument()
  })

  it('uses the "all gyms" channel when an admin looks at every gym', async () => {
    gymScope.mockReturnValue({ gymId: null })
    profile.mockReturnValue({
      id: 'user-1',
      is_admin: true,
      is_superadmin: false,
      gym_memberships: [],
    })
    renderWithProviders(<ChecklistRunsPage />)

    await screen.findByText('Morning opening')
    expect(channel).toHaveBeenCalledWith('checklists:all', {
      config: { private: true },
    })
    expect(screen.getByText('Copenhagen Nord')).toBeInTheDocument()
  })
})
