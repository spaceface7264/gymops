import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersPanel } from '@/features/admin'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const rows = vi.fn<() => Promise<{ data: Row[]; error: null }>>()
const gymRows = vi.fn<() => Promise<{ data: Row[]; error: null }>>()
const upsert = vi.fn<(values: Row, options: Row) => Promise<{ error: null }>>()
const remove = vi.fn<() => Promise<{ error: null }>>()
const update = vi.fn<(values: Row) => Promise<{ error: null }>>()
const eq = vi.fn<(column: string, value: unknown) => void>()
const profile = vi.fn<() => Row>()
const gymId = vi.fn<() => string | null>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => (table === 'gyms' ? gymRows() : rows()),
        eq: (column: string, value: unknown) => {
          eq(column, value)
          return { order: () => rows() }
        },
      }),
      update: (values: Row) => ({ eq: () => update(values) }),
      upsert: (values: Row, options: Row) => upsert(values, options),
      delete: () => ({ eq: () => ({ eq: () => remove() }) }),
    }),
  },
}))

vi.mock('@/features/auth', () => ({ useProfile: () => ({ data: profile() }) }))
vi.mock('@/features/gyms', () => ({ useGymScope: () => ({ gymId: gymId() }) }))

const nord = { id: 'gym-nord', name: 'Copenhagen Nord' }

const mette = {
  id: 'user-mette',
  email: 'manager@gymops.test',
  full_name: 'Mette Manager',
  is_admin: false,
  is_superadmin: false,
  active: true,
  gym_memberships: [{ role: 'manager', gyms: nord }],
}
const anders = {
  id: 'user-anders',
  email: 'admin@gymops.test',
  full_name: 'Anders Admin',
  is_admin: true,
  is_superadmin: false,
  active: true,
  gym_memberships: [],
}
const sam = {
  id: 'user-sam',
  email: 'staff@gymops.test',
  full_name: 'Sam Staff',
  is_admin: false,
  is_superadmin: false,
  active: false,
  gym_memberships: [{ role: 'staff', gyms: nord }],
}

beforeEach(() => {
  vi.clearAllMocks()
  rows.mockResolvedValue({ data: [anders, mette, sam], error: null })
  gymRows.mockResolvedValue({ data: [{ ...nord, active: true }], error: null })
  update.mockResolvedValue({ error: null })
  upsert.mockResolvedValue({ error: null })
  remove.mockResolvedValue({ error: null })
  profile.mockReturnValue({
    id: 'user-anders',
    is_admin: true,
    is_superadmin: false,
    gym_memberships: [],
  })
  gymId.mockReturnValue(null)
})

describe('UsersPanel', () => {
  it('badges the company-wide role rather than the gym roles', async () => {
    renderWithProviders(<UsersPanel />)

    const row = (await screen.findByText('Anders Admin')).closest('tr') as HTMLElement
    expect(within(row).getByText('Admin')).toBeInTheDocument()
  })

  it('badges one gym and role per membership', async () => {
    renderWithProviders(<UsersPanel />)

    const row = (await screen.findByText('Mette Manager')).closest('tr') as HTMLElement
    expect(within(row).getByText('Copenhagen Nord: Manager')).toBeInTheDocument()
  })

  it('narrows the list to the gym in the switcher', async () => {
    gymId.mockReturnValue('gym-nord')
    renderWithProviders(<UsersPanel />)

    await screen.findByText('Mette Manager')
    expect(eq).toHaveBeenCalledWith('gym_memberships.gym_id', 'gym-nord')
  })

  it('deactivates a user and reactivates one who is off', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPanel />)

    const active = (await screen.findByText('Mette Manager')).closest('tr') as HTMLElement
    await user.click(within(active).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith({ active: false }))

    const inactive = screen.getByText('Sam Staff').closest('tr') as HTMLElement
    await user.click(within(inactive).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith({ active: true }))
  })

  it('will not let you deactivate yourself, and says why', async () => {
    renderWithProviders(<UsersPanel />)

    const own = (await screen.findByText('Anders Admin')).closest('tr') as HTMLElement
    const button = within(own).getByRole('button', { name: 'Deactivate' })
    expect(button).toBeDisabled()
    // The reason is a tooltip on the wrapper (a disabled button hears no
    // pointer), reachable from the keyboard as well.
    await userEvent.hover(button.parentElement as HTMLElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'You cannot deactivate your own account.',
    )
  })

  it('says why inviting is unavailable when there is no gym to invite into', async () => {
    gymRows.mockResolvedValue({ data: [{ ...nord, active: false }], error: null })
    renderWithProviders(<UsersPanel />)

    expect(await screen.findByText(/nobody to invite/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled()
  })

  it('offers a manager no deactivate button at all', async () => {
    profile.mockReturnValue({
      id: 'user-mette',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'manager', gyms: nord }],
    })
    renderWithProviders(<UsersPanel />)

    await screen.findByText('Mette Manager')
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })
})

describe('RolesDialog', () => {
  it('offers an admin every gym and both roles, preselecting what the user holds', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPanel />)

    const row = (await screen.findByText('Mette Manager')).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Roles' }))

    // The trigger shows the label, not the value: the option list lives in a
    // portal and only exists while the select is open.
    const select = screen.getByLabelText('Copenhagen Nord')
    expect(select).toHaveTextContent('Manager')
    await user.click(select)
    expect(await screen.findByRole('option', { name: 'Manager' })).toBeInTheDocument()
  })

  it('lets a manager grant staff only', async () => {
    profile.mockReturnValue({
      id: 'user-mette',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'manager', gyms: nord }],
    })
    const user = userEvent.setup()
    renderWithProviders(<UsersPanel />)

    const row = (await screen.findByText('Sam Staff')).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Roles' }))

    await user.click(screen.getByLabelText('Copenhagen Nord'))
    // Waiting for an option that must exist proves the list is open before
    // asserting that another one is absent.
    expect(await screen.findByRole('option', { name: 'Staff' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Manager' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Company-wide admin')).not.toBeInTheDocument()
  })

  it('offers the admin flag to a superadmin only', async () => {
    profile.mockReturnValue({
      id: 'user-sofie',
      is_admin: true,
      is_superadmin: true,
      gym_memberships: [],
    })
    const user = userEvent.setup()
    renderWithProviders(<UsersPanel />)

    const row = (await screen.findByText('Mette Manager')).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Roles' }))

    expect(screen.getByLabelText('Company-wide admin')).not.toBeChecked()
  })

  it('shows the change it just made: the admin box follows the refetched row', async () => {
    profile.mockReturnValue({
      id: 'user-sofie',
      is_admin: true,
      is_superadmin: true,
      gym_memberships: [],
    })
    const user = userEvent.setup()
    renderWithProviders(<UsersPanel />)

    const row = (await screen.findByText('Mette Manager')).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Roles' }))
    expect(screen.getByLabelText('Company-wide admin')).not.toBeChecked()

    // The write succeeds and the list is refetched with Mette now an admin.
    rows.mockResolvedValue({
      data: [anders, { ...mette, is_admin: true }, sam],
      error: null,
    })
    await user.click(screen.getByLabelText('Company-wide admin'))

    await waitFor(() => expect(update).toHaveBeenCalledWith({ is_admin: true }))
    await waitFor(() => expect(screen.getByLabelText('Company-wide admin')).toBeChecked())
  })

  it('upserts the membership when a role is picked and removes it on "no role"', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPanel />)

    const row = (await screen.findByText('Sam Staff')).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Roles' }))

    await user.click(screen.getByLabelText('Copenhagen Nord'))
    await user.click(await screen.findByRole('option', { name: 'Manager' }))
    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        { user_id: 'user-sam', gym_id: 'gym-nord', role: 'manager' },
        { onConflict: 'user_id,gym_id' },
      ),
    )

    await user.click(screen.getByLabelText('Copenhagen Nord'))
    await user.click(await screen.findByRole('option', { name: 'No role' }))
    await waitFor(() => expect(remove).toHaveBeenCalled())
  })
})
