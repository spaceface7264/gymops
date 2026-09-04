import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GymsPanel, toSlug } from '@/features/admin'
import { AdminPage, RequireSuperadmin } from '@/routes/admin-page'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const gymRows = vi.fn<() => Promise<{ data: Row[]; error: null }>>()
const insert = vi.fn<(values: Row) => Promise<{ error: null }>>()
const update = vi.fn<(values: Row) => Promise<{ error: null }>>()
const profile = vi.fn<() => Row>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => gymRows() }),
      insert: (values: Row) => insert(values),
      update: (values: Row) => ({ eq: () => update(values) }),
    }),
  },
}))

vi.mock('@/features/auth', () => ({
  useProfile: () => ({ data: profile() }),
}))

const nord = {
  id: 'gym-nord',
  name: 'Copenhagen Nord',
  slug: 'kbh-nord',
  city: 'Copenhagen',
  timezone: 'Europe/Copenhagen',
  active: true,
}
const closed = { ...nord, id: 'gym-old', name: 'Amager', slug: 'amager', active: false }

beforeEach(() => {
  vi.clearAllMocks()
  gymRows.mockResolvedValue({ data: [closed, nord], error: null })
  insert.mockResolvedValue({ error: null })
  update.mockResolvedValue({ error: null })
  profile.mockReturnValue({ id: 'user-1', is_admin: true, is_superadmin: true })
})

describe('toSlug', () => {
  it('spells the Danish letters out instead of dropping them', () => {
    expect(toSlug('Aalborg Øst')).toBe('aalborg-oest')
    expect(toSlug('Næstved')).toBe('naestved')
    expect(toSlug('Århus C')).toBe('aarhus-c')
  })

  it('strips accents and collapses everything else to single dashes', () => {
    expect(toSlug('  Café  Nord!! ')).toBe('cafe-nord')
  })
})

describe('GymsPanel', () => {
  it('lists every gym, deactivated ones included', async () => {
    renderWithProviders(<GymsPanel />)

    expect(await screen.findByText('Copenhagen Nord')).toBeInTheDocument()
    expect(screen.getByText('Amager')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('creates a gym and derives the slug from the name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GymsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New gym' }))
    await user.type(screen.getByLabelText('Name'), 'Aarhus Vest')
    expect(screen.getByLabelText('Slug')).toHaveValue('aarhus-vest')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith({
        name: 'Aarhus Vest',
        slug: 'aarhus-vest',
        city: null,
        timezone: 'Europe/Copenhagen',
      }),
    )
  })

  it('opens the edit dialog on the gym that was clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GymsPanel />)

    const row = (await screen.findByText('Copenhagen Nord')).closest('tr')
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Edit' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Copenhagen Nord')
    expect(screen.getByLabelText('City')).toHaveValue('Copenhagen')
  })

  it('deactivates an active gym and reactivates a closed one', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GymsPanel />)

    const active = (await screen.findByText('Copenhagen Nord')).closest('tr')
    await user.click(
      within(active as HTMLElement).getByRole('button', { name: 'Deactivate' }),
    )
    await waitFor(() => expect(update).toHaveBeenCalledWith({ active: false }))

    const inactive = screen.getByText('Amager').closest('tr')
    await user.click(
      within(inactive as HTMLElement).getByRole('button', { name: 'Reactivate' }),
    )
    await waitFor(() => expect(update).toHaveBeenCalledWith({ active: true }))
  })

  it('reports a failed save instead of closing the dialog', async () => {
    const user = userEvent.setup()
    insert.mockResolvedValue({ error: { message: 'duplicate slug' } as unknown as null })
    renderWithProviders(<GymsPanel />)

    await user.click(await screen.findByRole('button', { name: 'New gym' }))
    await user.type(screen.getByLabelText('Name'), 'Aarhus Vest')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
  })
})

describe('AdminPage', () => {
  it('sends anyone who opens /admin to the user list', async () => {
    renderWithProviders(<AdminPage />, {
      path: '/admin',
      routes: [{ path: '/admin/users', element: <p>users section</p> }],
    })

    expect(await screen.findByText('users section')).toBeInTheDocument()
  })

  it('offers a superadmin the gyms section', async () => {
    renderWithProviders(<AdminPage />, { path: '/admin/users' })

    expect(await screen.findByRole('tab', { name: 'Gyms' })).toBeInTheDocument()
  })

  it('hides gym management from an admin who is not a superadmin', async () => {
    profile.mockReturnValue({ id: 'user-1', is_admin: true, is_superadmin: false })
    renderWithProviders(<AdminPage />, { path: '/admin/users' })

    expect(await screen.findByRole('tab', { name: 'Users' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Gyms' })).not.toBeInTheDocument()
  })

  it('offers a superadmin the assistant’s usage (P8-06)', async () => {
    renderWithProviders(<AdminPage />, { path: '/admin/users' })

    expect(
      await screen.findByRole('tab', { name: 'Assistant usage' }),
    ).toBeInTheDocument()
  })

  it('hides the assistant’s usage from an admin who is not a superadmin', async () => {
    profile.mockReturnValue({ id: 'user-1', is_admin: true, is_superadmin: false })
    renderWithProviders(<AdminPage />, { path: '/admin/users' })

    expect(await screen.findByRole('tab', { name: 'Users' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Assistant usage' })).not.toBeInTheDocument()
  })
})

describe('RequireSuperadmin', () => {
  it('sends an admin who guesses the URL back to the home page', async () => {
    profile.mockReturnValue({ id: 'user-1', is_admin: true, is_superadmin: false })
    renderWithProviders(
      <RequireSuperadmin>
        <GymsPanel />
      </RequireSuperadmin>,
      { path: '/admin/gyms', routes: [{ path: '/', element: <p>home</p> }] },
    )

    expect(await screen.findByText('home')).toBeInTheDocument()
  })

  it('lets a superadmin through', async () => {
    renderWithProviders(
      <RequireSuperadmin>
        <GymsPanel />
      </RequireSuperadmin>,
      { path: '/admin/gyms', routes: [{ path: '/', element: <p>home</p> }] },
    )

    expect(await screen.findByText('Copenhagen Nord')).toBeInTheDocument()
  })
})
