import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InviteDialog } from '@/features/admin'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const invoke =
  vi.fn<
    (
      name: string,
      options: { body: Row },
    ) => Promise<{ data: Row | null; error: unknown }>
  >()

vi.mock('@/features/gyms', () => ({ useGymScope: () => ({ gymId: gymScope() }) }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (name: string, options: { body: Row }) => invoke(name, options),
    },
  },
}))

const gymScope = vi.fn<() => string | null>()

const nord = { id: 'gym-nord', name: 'Copenhagen Nord' } as Row
const odense = { id: 'gym-odense', name: 'Odense' } as Row

function open(props: Partial<Parameters<typeof InviteDialog>[0]> = {}) {
  return renderWithProviders(
    <InviteDialog
      gyms={[nord, odense] as never}
      canMakeManagers
      canMakeAdmins={false}
      open
      onOpenChange={() => {}}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  invoke.mockResolvedValue({ data: { userId: 'user-new' }, error: null })
  gymScope.mockReturnValue(null)
})

describe('InviteDialog', () => {
  it('sends the gym and role the inviter chose', async () => {
    const user = userEvent.setup()
    open()

    await user.type(screen.getByLabelText('Work email'), 'ny@gymops.test')
    await user.type(screen.getByLabelText('Full name'), 'Ny Person')
    await user.selectOptions(screen.getByLabelText('Role'), 'manager')
    await user.selectOptions(screen.getByLabelText('Gym'), 'gym-odense')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('invite', {
        body: {
          email: 'ny@gymops.test',
          fullName: 'Ny Person',
          asAdmin: false,
          gymId: 'gym-odense',
          role: 'manager',
        },
      }),
    )
  })

  it('starts on the gym the switcher is showing', () => {
    gymScope.mockReturnValue('gym-odense')
    open()

    expect(screen.getByLabelText('Gym')).toHaveValue('gym-odense')
  })

  it('offers a manager staff only, and no company-wide admin', () => {
    open({ canMakeManagers: false })

    const role = screen.getByLabelText('Role')
    expect(role).toHaveValue('staff')
    expect(role).toHaveTextContent('Staff')
    expect(role).not.toHaveTextContent('Manager')
    expect(role).not.toHaveTextContent('Admin')
  })

  it('drops the gym when a superadmin invites a company-wide admin', async () => {
    const user = userEvent.setup()
    open({ canMakeAdmins: true })

    await user.type(screen.getByLabelText('Work email'), 'chef@gymops.test')
    await user.selectOptions(screen.getByLabelText('Role'), 'admin')
    expect(screen.queryByLabelText('Gym')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send invite' }))

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('invite', {
        body: { email: 'chef@gymops.test', fullName: '', asAdmin: true },
      }),
    )
  })

  it('says which invites the function refused and why', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: { json: () => Promise.resolve({ error: 'already_a_user' }) } },
    })
    const user = userEvent.setup()
    open()

    await user.type(screen.getByLabelText('Work email'), 'staff@gymops.test')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already belongs')
  })
})
