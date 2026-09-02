import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ChecklistTemplateEditorPage,
  ChecklistTemplatesPage,
  summariseWeekdays,
  weekdayNames,
} from '@/features/checklists'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const insert = vi.fn<(table: string, values: Row | Row[]) => void>()
const update = vi.fn<(table: string, values: Row) => void>()
const upsert = vi.fn<(table: string, values: Row[]) => void>()
const removed = vi.fn<(table: string, ids: string[]) => void>()
const profile = vi.fn<() => Row>()

function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: (_column: string, ids: string[]) => {
      removed(table, ids)
      return chain
    },
    order: () => chain,
    single: () => Promise.resolve({ data: tableRows(table)[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: tableRows(table), error: null }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => builder(table),
      // Inserting a template reads its new id back; inserting items is awaited
      // as it is.
      insert: (values: Row | Row[]) => {
        insert(table, values)
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'template-new' }, error: null }),
          }),
          then: builder(table).then,
        }
      },
      update: (values: Row) => {
        update(table, values)
        return builder(table)
      },
      upsert: (values: Row[]) => {
        upsert(table, values)
        return Promise.resolve({ error: null })
      },
      delete: () => builder(table),
    }),
  },
}))

vi.mock('@/features/auth', () => ({
  useProfile: () => ({ data: profile() }),
  useAuth: () => ({ user: { id: 'user-1' } }),
}))
vi.mock('@/features/gyms', () => ({
  useGymScope: () => ({ gymId: 'gym-nord' }),
  useGyms: () => ({
    data: [
      { id: 'gym-nord', name: 'Copenhagen Nord', slug: 'nord' },
      { id: 'gym-aarhus', name: 'Aarhus C', slug: 'aarhus' },
    ],
  }),
}))

const companyTemplate = {
  id: 'template-company',
  gym_id: null,
  kind: 'opening',
  name: 'Company opening',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  active: true,
  created_at: '2026-09-02T08:00:00Z',
  updated_at: '2026-09-02T08:00:00Z',
  gyms: null,
  checklist_template_items: [
    { id: 'item-door', position: 1, label: 'Unlock the front door', required: true },
    { id: 'item-plants', position: 2, label: 'Water the plants', required: false },
  ],
}

const gymTemplate = {
  id: 'template-nord',
  gym_id: 'gym-nord',
  kind: 'closing',
  name: 'Nord closing',
  weekdays: [1, 3, 5],
  active: false,
  created_at: '2026-09-02T08:00:00Z',
  updated_at: '2026-09-02T08:00:00Z',
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord' },
  checklist_template_items: [
    { id: 'item-chalk', position: 1, label: 'Empty the chalk buckets', required: true },
  ],
}

const asAdmin = () =>
  profile.mockReturnValue({
    id: 'user-1',
    is_admin: true,
    is_superadmin: false,
    gym_memberships: [],
  })

const asManagerOfNord = () =>
  profile.mockReturnValue({
    id: 'user-1',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [
      { role: 'manager', gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } },
    ],
  })

beforeEach(() => {
  vi.clearAllMocks()
  tableRows.mockImplementation((table) =>
    table === 'checklist_templates' ? [companyTemplate, gymTemplate] : [],
  )
  asAdmin()
})

describe('the weekday helper', () => {
  it("names the weekdays Monday first, in the reader's language", () => {
    expect(weekdayNames('en')[0]).toBe('Mon')
    expect(weekdayNames('en')[6]).toBe('Sun')
    expect(weekdayNames('da')[0]?.toLowerCase()).toContain('man')
  })

  it('summarises a partial week in ISO order and a full week as nothing', () => {
    expect(summariseWeekdays([5, 1, 3], 'en')).toBe('Mon, Wed, Fri')
    expect(summariseWeekdays([1, 2, 3, 4, 5, 6, 7], 'en')).toBeNull()
  })
})

describe('the template list', () => {
  it('shows each template with its scope, kind, schedule and size', async () => {
    renderWithProviders(<ChecklistTemplatesPage />)

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0] as HTMLElement).getByText('Company-wide')).toBeInTheDocument()
    expect(
      within(rows[0] as HTMLElement).getByText(/Every day · 2 items/),
    ).toBeInTheDocument()
    expect(
      within(rows[1] as HTMLElement).getByText('Copenhagen Nord'),
    ).toBeInTheDocument()
    expect(
      within(rows[1] as HTMLElement).getByText(/Mon, Wed, Fri · 1 item/),
    ).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Inactive')).toBeInTheDocument()
  })

  it('offers editing only where the viewer may publish', async () => {
    asManagerOfNord()
    renderWithProviders(<ChecklistTemplatesPage />)

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0] as HTMLElement).queryByText('Edit')).not.toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Edit')).toBeInTheDocument()
  })

  it('hides the new-checklist button from staff', async () => {
    profile.mockReturnValue({
      id: 'user-1',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'staff', gyms: { id: 'gym-nord', name: 'Nord' } }],
    })
    renderWithProviders(<ChecklistTemplatesPage />)

    await screen.findAllByRole('listitem')
    expect(screen.queryByRole('link', { name: /New checklist/ })).not.toBeInTheDocument()
  })

  it('deactivates a template rather than deleting it', async () => {
    renderWithProviders(<ChecklistTemplatesPage />)

    const rows = await screen.findAllByRole('listitem')
    await userEvent.click(
      within(rows[0] as HTMLElement).getByRole('button', { name: 'Deactivate' }),
    )

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('checklist_templates', { active: false }),
    )
  })
})

describe('the template editor', () => {
  it('creates a template, then its items in the order they are listed', async () => {
    renderWithProviders(<ChecklistTemplateEditorPage />, {
      path: '/checklists/templates/new',
    })

    await userEvent.type(screen.getByLabelText('Name'), 'Weekend opening')
    await userEvent.type(screen.getByLabelText('Item 1'), 'Unlock the front door')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    await userEvent.type(screen.getByLabelText('Item 2'), 'Water the plants')
    await userEvent.click(screen.getAllByLabelText('Required')[1] as HTMLElement)
    // Saturday and Sunday only.
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await userEvent.click(screen.getByLabelText(day))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith('checklist_templates', {
        gym_id: 'gym-nord',
        kind: 'opening',
        name: 'Weekend opening',
        weekdays: [6, 7],
        active: true,
      }),
    )
    expect(insert).toHaveBeenCalledWith('checklist_template_items', [
      {
        template_id: 'template-new',
        position: 1,
        label: 'Unlock the front door',
        required: true,
      },
      {
        template_id: 'template-new',
        position: 2,
        label: 'Water the plants',
        required: false,
      },
    ])
  })

  it('says what is still missing instead of just greying the button out', async () => {
    renderWithProviders(<ChecklistTemplateEditorPage />, {
      path: '/checklists/templates/new',
    })

    // The one thing an author is most likely to leave for last.
    await userEvent.type(screen.getByLabelText('Item 1'), 'Unlock the front door')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText('Give the checklist a name.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Name'), 'Weekend opening')
    expect(screen.queryByText('Give the checklist a name.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await userEvent.click(screen.getByLabelText(day))
    }
    expect(screen.getByText(/at least one day/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('will not save a checklist with no items — it would generate nothing', async () => {
    renderWithProviders(<ChecklistTemplateEditorPage />, {
      path: '/checklists/templates/new',
    })

    await userEvent.type(screen.getByLabelText('Name'), 'Empty draft')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText(/at least one item/)).toBeInTheDocument()
  })

  it('keeps the ids of items it edits, renumbers the ones it moves, and drops the rest', async () => {
    tableRows.mockImplementation((table) =>
      table === 'checklist_templates'
        ? [companyTemplate]
        : table === 'checklist_template_items'
          ? [{ id: 'item-door' }, { id: 'item-plants' }, { id: 'item-gone' }]
          : [],
    )
    renderWithProviders(<ChecklistTemplateEditorPage />, {
      path: '/checklists/templates/:templateId/edit',
      initialEntries: ['/checklists/templates/template-company/edit'],
    })

    // The second item moves above the first; the first item's own button is disabled.
    const moveUp = await screen.findAllByRole('button', { name: 'Move up' })
    await userEvent.click(moveUp[1] as HTMLElement)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith('checklist_template_items', [
        {
          id: 'item-plants',
          template_id: 'template-company',
          position: 1,
          label: 'Water the plants',
          required: false,
        },
        {
          id: 'item-door',
          template_id: 'template-company',
          position: 2,
          label: 'Unlock the front door',
          required: true,
        },
      ]),
    )
    expect(removed).toHaveBeenCalledWith('checklist_template_items', ['item-gone'])
    expect(insert).not.toHaveBeenCalledWith('checklist_template_items', expect.anything())
  })
})
