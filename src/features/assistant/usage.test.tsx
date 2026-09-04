import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistantUsagePanel, summariseUsage, type UsageRow } from '@/features/assistant'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const usageRows = vi.fn<() => Row[]>()
const setting = vi.fn<() => Row>()
const updated =
  vi.fn<(table: string, values: Row, filters: [string, unknown][]) => void>()

function builder(table: string) {
  const filters: [string, unknown][] = []
  let values: Row | null = null

  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push([column, value])
      return chain
    },
    gte: () => chain,
    order: () => chain,
    update: (next: Row) => {
      values = next
      return chain
    },
    single: () => Promise.resolve({ data: setting(), error: null }),
    then: (resolve: (value: unknown) => unknown) => {
      if (values) {
        updated(table, values, filters)
        return Promise.resolve({ data: null, error: null }).then(resolve)
      }
      return Promise.resolve({ data: usageRows(), error: null }).then(resolve)
    },
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => builder(table) },
}))

const usage = (overrides: Row = {}): Row => ({
  user_id: 'user-anna',
  surface: 'ask',
  input_tokens: 1000,
  output_tokens: 200,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 800,
  created_at: '2026-09-04T10:00:00Z',
  user: { full_name: 'Anna Ask', email: 'anna@gymops.test' },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  setting.mockReturnValue({ value: 50 })
  usageRows.mockReturnValue([])
})

describe('summariseUsage', () => {
  it('folds one person’s calls into one line and sums the tokens', () => {
    const lines = summariseUsage([
      usage(),
      usage({ input_tokens: 500, output_tokens: 100, cache_read_input_tokens: 0 }),
      usage({
        user_id: 'user-bo',
        surface: 'channel',
        user: { full_name: null, email: 'bo@gymops.test' },
      }),
    ] as UsageRow[])

    expect(lines).toEqual([
      {
        userId: 'user-anna',
        name: 'Anna Ask',
        calls: 2,
        inputTokens: 1500,
        outputTokens: 300,
        cacheReadTokens: 800,
      },
      {
        userId: 'user-bo',
        name: 'bo@gymops.test',
        calls: 1,
        inputTokens: 1000,
        outputTokens: 200,
        cacheReadTokens: 800,
      },
    ])
  })
})

describe('AssistantUsagePanel', () => {
  it('shows the cap and saves a new one against the setting row', async () => {
    renderWithProviders(<AssistantUsagePanel />)

    const cap = await screen.findByLabelText('Questions per person per day')
    expect(cap).toHaveValue(50)

    await userEvent.clear(cap)
    await userEvent.type(cap, '20')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updated).toHaveBeenCalledWith('app_settings', { value: 20 }, [
        ['key', 'assistant_daily_cap'],
      ]),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
  })

  it('lists who asked, most often first, with a total line', async () => {
    usageRows.mockReturnValue([
      usage({ user_id: 'user-bo', user: { full_name: 'Bo Boulder', email: 'bo@x' } }),
      usage(),
      usage({ input_tokens: 500, output_tokens: 100, cache_read_input_tokens: 0 }),
    ])
    renderWithProviders(<AssistantUsagePanel />)

    const anna = (await screen.findByText('Anna Ask')).closest('tr') as HTMLElement
    expect(within(anna).getByText('2')).toBeInTheDocument()
    expect(within(anna).getByText('1,500')).toBeInTheDocument()

    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Anna Ask')
    expect(rows[2]).toHaveTextContent('Bo Boulder')
    expect(rows[3]).toHaveTextContent('Total')
    expect(rows[3]).toHaveTextContent('3')
    expect(rows[3]).toHaveTextContent('2,500')
  })

  it('says so when nobody has asked', async () => {
    renderWithProviders(<AssistantUsagePanel />)

    expect(
      await screen.findByText('Nobody has asked the assistant in the last 30 days.'),
    ).toBeInTheDocument()
  })
})
