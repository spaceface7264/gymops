import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersPanel } from '@/features/admin'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const rows = vi.fn<() => Promise<{ data: Row[]; error: null }>>()
const update = vi.fn<(values: Row) => Promise<{ error: null }>>()
const eq = vi.fn<(column: string, value: unknown) => void>()
const profile = vi.fn<() => Row>()
const gymId = vi.fn<() => string | null>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => rows(),
        eq: (column: string, value: unknown) => {
          eq(column, value)
          return { order: () => rows() }
        },
      }),
      update: (values: Row) => ({ eq: () => update(values) }),
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
  update.mockResolvedValue({ error: null })
  profile.mockReturnValue({ id: 'user-anders', is_admin: true, is_superadmin: false })
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

  it('will not let you deactivate yourself', async () => {
    renderWithProviders(<UsersPanel />)

    const own = (await screen.findByText('Anders Admin')).closest('tr') as HTMLElement
    expect(within(own).getByRole('button', { name: 'Deactivate' })).toBeDisabled()
  })

  it('offers a manager no deactivate button at all', async () => {
    profile.mockReturnValue({ id: 'user-mette', is_admin: false, is_superadmin: false })
    renderWithProviders(<UsersPanel />)

    await screen.findByText('Mette Manager')
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })
})
