import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditPanel } from '@/features/admin'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const auditRows = vi.fn<() => Promise<{ data: Row[]; error: unknown }>>()
const userRows = vi.fn<() => Promise<{ data: Row[]; error: null }>>()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    // The audit query ends in .limit(), the user list in .order(); one shape
    // serves both.
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => auditRows(),
          then: (resolve: (value: unknown) => unknown) => userRows().then(resolve),
        }),
      }),
    }),
  },
}))

vi.mock('@/features/gyms', () => ({ useGymScope: () => ({ gymId: null }) }))

const sofie = {
  id: 'user-sofie',
  email: 'super@gymops.test',
  full_name: 'Sofie Superadmin',
}

beforeEach(() => {
  vi.clearAllMocks()
  userRows.mockResolvedValue({ data: [sofie], error: null })
  auditRows.mockResolvedValue({
    data: [
      {
        id: 2,
        actor_id: 'user-sofie',
        action: 'profile.privileges_changed',
        entity_type: 'profile',
        created_at: '2026-09-01T10:00:00Z',
        before: { is_admin: false, is_superadmin: false, active: true },
        after: { is_admin: true, is_superadmin: false, active: true },
      },
      {
        id: 1,
        actor_id: null,
        action: 'membership.role_changed',
        entity_type: 'gym_membership',
        created_at: '2026-09-01T09:00:00Z',
        before: { role: 'staff' },
        after: { role: 'manager' },
      },
    ],
    error: null,
  })
})

describe('AuditPanel', () => {
  it('names who made the change and what changed', async () => {
    renderWithProviders(<AuditPanel />)

    const row = (await screen.findByText('profile.privileges_changed')).closest(
      'tr',
    ) as HTMLElement
    expect(within(row).getByText('Sofie Superadmin')).toBeInTheDocument()
    expect(within(row).getByText(/is_admin: false → true/)).toBeInTheDocument()
  })

  it('reports only the field that moved', async () => {
    renderWithProviders(<AuditPanel />)

    const row = (await screen.findByText('membership.role_changed')).closest(
      'tr',
    ) as HTMLElement
    expect(within(row).getByText('role: "staff" → "manager"')).toBeInTheDocument()
    expect(within(row).getByText('System')).toBeInTheDocument()
  })

  it('says so when a non-superadmin gets nothing back', async () => {
    auditRows.mockResolvedValue({ data: [], error: null })
    renderWithProviders(<AuditPanel />)

    expect(await screen.findByText(/Nothing has been recorded/)).toBeInTheDocument()
  })
})
