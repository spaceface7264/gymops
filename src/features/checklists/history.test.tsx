import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ChecklistHistoryCard,
  runOutcome,
  type ChecklistRun,
} from '@/features/checklists'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const profile = vi.fn<() => Row>()
const gymScope = vi.fn<() => Row>()

function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
    is: () => chain,
    order: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: tableRows(table), error: null }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => ({ select: () => builder(table) }) },
}))
vi.mock('@/features/auth', () => ({
  useProfile: () => ({ data: profile() }),
  useAuth: () => ({ user: { id: 'user-1' } }),
}))
vi.mock('@/features/gyms', () => ({
  useGymScope: () => gymScope(),
  useGyms: () => ({
    data: [
      { id: 'gym-nord', name: 'Copenhagen Nord', slug: 'nord' },
      { id: 'gym-aarhus', name: 'Aarhus C', slug: 'aarhus' },
    ],
  }),
}))

const item = (overrides: Row = {}): Row => ({
  id: 'item-1',
  position: 1,
  label: 'Unlock the front door',
  required: true,
  done_at: '2026-09-01T05:10:00Z',
  done_by: 'user-2',
  note: null,
  profiles: null,
  ...overrides,
})

const run = (overrides: Row): Row => ({
  id: 'run-1',
  template_id: 'template-1',
  gym_id: 'gym-nord',
  run_date: '2026-09-01',
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord', timezone: 'Europe/Copenhagen' },
  checklist_templates: { name: 'Morning opening', kind: 'opening' },
  checklist_run_items: [item()],
  ...overrides,
})

const asManager = () =>
  profile.mockReturnValue({
    id: 'user-1',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [
      { role: 'manager', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
    ],
  })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-02T09:00:00Z'))
  vi.clearAllMocks()
  gymScope.mockReturnValue({ gymId: 'gym-nord' })
  asManager()
})

afterEach(() => vi.useRealTimers())

describe('a run’s outcome', () => {
  const at = new Date('2026-09-02T09:00:00Z')
  const asRun = (row: Row) => row as unknown as ChecklistRun
  const unfinished = { checklist_run_items: [item({ done_at: null })] }

  it('is missed once the gym’s own day is over', () => {
    expect(runOutcome(asRun(run(unfinished)), at)).toBe('missed')
  })

  it('is still open on the day itself', () => {
    expect(runOutcome(asRun(run({ ...unfinished, run_date: '2026-09-02' })), at)).toBe(
      'open',
    )
  })

  it('is complete when only optional items are left', () => {
    const partly = run({
      checklist_run_items: [item(), item({ id: 'i2', required: false, done_at: null })],
    })
    expect(runOutcome(asRun(partly), at)).toBe('complete')
  })
})

describe('the checklist block on home', () => {
  it('counts the week and names what nobody finished', async () => {
    tableRows.mockImplementation((table) =>
      table === 'checklist_runs'
        ? [
            run({ id: 'run-done' }),
            run({
              id: 'run-missed',
              run_date: '2026-08-31',
              checklist_templates: { name: 'Evening closing', kind: 'closing' },
              checklist_run_items: [item({ done_at: null }), item({ id: 'i2' })],
            }),
          ]
        : [],
    )
    renderWithProviders(<ChecklistHistoryCard />)

    expect(
      await screen.findByText('1 of 2 checklists completed in the last 7 days.'),
    ).toBeInTheDocument()

    const missed = screen.getAllByRole('listitem')
    expect(missed).toHaveLength(1)
    expect(missed[0]).toHaveTextContent('Evening closing')
    expect(missed[0]).toHaveTextContent('1 of 2 done')
  })

  it('does not call today’s unfinished checklist missed', async () => {
    tableRows.mockImplementation((table) =>
      table === 'checklist_runs'
        ? [
            run({
              run_date: '2026-09-02',
              checklist_run_items: [item({ done_at: null })],
            }),
          ]
        : [],
    )
    renderWithProviders(<ChecklistHistoryCard />)

    expect(await screen.findByText(/Nothing was missed/)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('names the gym when a manager is looking at all of them', async () => {
    gymScope.mockReturnValue({ gymId: null })
    tableRows.mockImplementation((table) =>
      table === 'checklist_runs'
        ? [
            run({
              gym_id: 'gym-aarhus',
              gyms: { id: 'gym-aarhus', name: 'Aarhus C', timezone: 'Europe/Copenhagen' },
              checklist_run_items: [item({ done_at: null })],
            }),
          ]
        : [],
    )
    renderWithProviders(<ChecklistHistoryCard />)

    expect(await screen.findByRole('listitem')).toHaveTextContent('Aarhus C')
  })

  it('is not shown to staff at all', () => {
    profile.mockReturnValue({
      id: 'user-1',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'staff', gyms: { id: 'gym-nord', name: 'Nord' } }],
    })
    tableRows.mockImplementation(() => [])
    const { container } = renderWithProviders(<ChecklistHistoryCard />)

    expect(container).toBeEmptyDOMElement()
  })

  it('says so when the gym has no runs yet', async () => {
    tableRows.mockImplementation(() => [])
    renderWithProviders(<ChecklistHistoryCard />)

    expect(await screen.findByText(/No checklists have run here yet/)).toBeInTheDocument()
  })
})
