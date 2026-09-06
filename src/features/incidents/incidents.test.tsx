import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IncidentDetailPage,
  IncidentFormPage,
  IncidentsPage,
  incidentPhotoPath,
} from '@/features/incidents'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const tableRows = vi.fn<(table: string) => Row[]>()
const insert = vi.fn<(table: string, values: Row) => void>()
const update = vi.fn<(table: string, values: Row) => void>()
const filters = vi.fn<(method: string, args: unknown[]) => void>()
const upload = vi.fn<(bucket: string, path: string) => void>()
const profile = vi.fn<() => Row>()
const gymScope = vi.fn<() => Row>()
const navigate = vi.fn<(to: string) => void>()

function builder(table: string) {
  const rows = () => tableRows(table)
  const chain = {
    select: () => chain,
    eq: (...args: unknown[]) => {
      filters('eq', args)
      return chain
    },
    neq: (...args: unknown[]) => {
      filters('neq', args)
      return chain
    },
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(resolve),
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => builder(table),
      insert: (values: Row) => {
        insert(table, values)
        return builder(table)
      },
      update: (values: Row) => {
        update(table, values)
        return builder(table)
      },
    }),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string) => {
          upload(bucket, path)
          return Promise.resolve({ error: null })
        },
        createSignedUrl: (path: string) =>
          Promise.resolve({ data: { signedUrl: `https://signed/${path}` }, error: null }),
      }),
    },
  },
}))

vi.mock('@/features/auth', () => ({
  useProfile: () => ({ data: profile() }),
  useAuth: () => ({ user: { id: 'user-sam' } }),
}))
vi.mock('@/features/gyms', () => ({
  useGymScope: () => gymScope(),
  useGyms: () => ({ data: [{ id: 'gym-nord', name: 'Copenhagen Nord' }] }),
}))
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNavigate: () => navigate,
}))

const incident = (overrides: Row = {}): Row => ({
  id: 'incident-1',
  gym_id: 'gym-nord',
  kind: 'equipment',
  severity: 'high',
  status: 'open',
  title: 'Hold broke on wall 4',
  body: 'A crimp sheared off mid-route.',
  assignee_id: null,
  resolved_at: null,
  created_at: '2026-09-02T15:00:00Z',
  created_by: 'user-mette',
  gyms: { id: 'gym-nord', name: 'Copenhagen Nord', timezone: 'Europe/Copenhagen' },
  reporter: { id: 'user-mette', full_name: 'Mette Manager' },
  assignee: null,
  ...overrides,
})

const membership = (role: string) =>
  profile.mockReturnValue({
    id: 'user-sam',
    is_admin: false,
    is_superadmin: false,
    gym_memberships: [{ role, gyms: { id: 'gym-nord', name: 'Copenhagen Nord' } }],
  })

beforeEach(() => {
  vi.clearAllMocks()
  tableRows.mockImplementation((table) => (table === 'incidents' ? [incident()] : []))
  gymScope.mockReturnValue({ gymId: 'gym-nord' })
  membership('staff')
})

describe('where a photograph is filed', () => {
  it('puts the gym first, so the storage policy can read it', () => {
    const path = incidentPhotoPath('gym-nord', 'incident-1', 'IMG_0042.JPEG')
    expect(path).toMatch(/^gym-nord\/incident-1\/[0-9a-f-]+\.jpeg$/)
  })

  it('falls back to jpg for a camera file with no extension', () => {
    expect(incidentPhotoPath('gym-nord', 'incident-1', 'image')).toMatch(/\.jpg$/)
  })
})

describe('the incident list', () => {
  it('opens on what is still unresolved', async () => {
    renderWithProviders(<IncidentsPage />)

    await screen.findByText('Hold broke on wall 4')
    expect(filters).toHaveBeenCalledWith('neq', ['status', 'resolved'])
    expect(screen.getByRole('radio', { name: 'Still open' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('shows the severity, the kind and who reported it', async () => {
    renderWithProviders(<IncidentsPage />)

    const card = (await screen.findByText('Hold broke on wall 4')).closest('a')!
    expect(within(card).getByText('High')).toBeInTheDocument()
    expect(within(card).getByText('Equipment')).toBeInTheDocument()
    expect(within(card).getByText(/Mette Manager/)).toBeInTheDocument()
  })

  it('asks the database for one status and one kind', async () => {
    renderWithProviders(<IncidentsPage />)

    await screen.findByText('Hold broke on wall 4')
    await userEvent.click(screen.getByRole('radio', { name: 'Resolved' }))
    await waitFor(() =>
      expect(filters).toHaveBeenCalledWith('eq', ['status', 'resolved']),
    )

    await userEvent.click(screen.getByRole('button', { name: /^Kind:/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Injury' }))
    await waitFor(() => expect(filters).toHaveBeenCalledWith('eq', ['kind', 'injury']))
  })

  it('offers reporting only to the gym in scope', async () => {
    renderWithProviders(<IncidentsPage />)
    expect(
      await screen.findByRole('link', { name: 'Report an incident' }),
    ).toBeInTheDocument()

    cleanup()
    // Copenhagen Nord is not this person's gym.
    profile.mockReturnValue({
      id: 'user-sam',
      is_admin: false,
      is_superadmin: false,
      gym_memberships: [{ role: 'staff', gyms: { id: 'gym-aarhus', name: 'Aarhus C' } }],
    })
    renderWithProviders(<IncidentsPage />)

    await screen.findByText('Hold broke on wall 4')
    expect(
      screen.queryByRole('link', { name: 'Report an incident' }),
    ).not.toBeInTheDocument()
  })
})

describe('reporting one', () => {
  it('files it in the gym in scope and opens what it filed', async () => {
    tableRows.mockImplementation((table) =>
      table === 'incidents' ? [{ id: 'incident-new' }] : [],
    )
    renderWithProviders(<IncidentFormPage />)

    await userEvent.type(screen.getByLabelText('Title'), '  Hold broke on wall 4  ')
    await userEvent.type(screen.getByLabelText('What happened'), 'A crimp sheared off.')
    await userEvent.click(screen.getByLabelText('Kind'))
    await userEvent.click(await screen.findByRole('option', { name: 'Equipment' }))
    await userEvent.click(screen.getByLabelText('Severity'))
    await userEvent.click(await screen.findByRole('option', { name: 'High' }))
    await userEvent.click(screen.getByRole('button', { name: 'Report it' }))

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith('incidents', {
        gym_id: 'gym-nord',
        kind: 'equipment',
        severity: 'high',
        title: 'Hold broke on wall 4',
        body: 'A crimp sheared off.',
      }),
    )
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/incidents/incident-new'))
  })

  it('uploads the photograph once the incident it belongs to exists', async () => {
    tableRows.mockImplementation((table) =>
      table === 'incidents' ? [{ id: 'incident-new' }] : [],
    )
    renderWithProviders(<IncidentFormPage />)

    const photo = new File(['x'], 'wall4.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByTestId('incident-camera'), photo)
    expect(screen.getByText('wall4.jpg')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Title'), 'Hold broke')
    await userEvent.type(screen.getByLabelText('What happened'), 'Sheared off.')
    await userEvent.click(screen.getByRole('button', { name: 'Report it' }))

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    const [bucket, path] = upload.mock.calls[0] as [string, string]
    expect(bucket).toBe('incidents')
    expect(path).toMatch(/^gym-nord\/incident-new\//)
    expect(insert).toHaveBeenCalledWith(
      'incident_attachments',
      expect.objectContaining({ incident_id: 'incident-new', path }),
    )
  })

  it('says what is missing instead of a dead button', async () => {
    renderWithProviders(<IncidentFormPage />)
    // An untouched form says nothing (P7M-07); the first keystroke turns the hints on.
    const touched = await screen.findByLabelText('Title')
    await userEvent.type(touched, 'x')
    await userEvent.clear(touched)

    expect(screen.getByText(/short title/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report it' })).toBeDisabled()
  })

  it('takes a pre-filled report from the query string', () => {
    renderWithProviders(<IncidentFormPage />, {
      path: '/incidents/new',
      initialEntries: ['/incidents/new?title=Wall%204&body=Taped%20off'],
    })

    expect(screen.getByLabelText('Title')).toHaveValue('Wall 4')
    expect(screen.getByLabelText('What happened')).toHaveValue('Taped off')
  })
})

const renderDetail = () =>
  renderWithProviders(<IncidentDetailPage />, {
    path: '/incidents/:incidentId',
    initialEntries: ['/incidents/incident-1'],
  })

describe('one incident', () => {
  it('keeps the status flow away from the person who reported it', async () => {
    renderDetail()

    await screen.findByRole('heading', { name: 'Hold broke on wall 4' })
    expect(screen.queryByLabelText('Assignee')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'In progress' })).not.toBeInTheDocument()
    // Staff still photograph and comment on it.
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Comment')).toBeInTheDocument()
  })

  it('lets a manager move the status and hand it to somebody', async () => {
    membership('manager')
    tableRows.mockImplementation((table) => {
      if (table === 'incidents') return [incident()]
      if (table === 'gym_memberships')
        return [
          {
            user_id: 'user-sam',
            profiles: { id: 'user-sam', full_name: 'Sam Staff', active: true },
          },
        ]
      return []
    })
    renderDetail()

    await userEvent.click(await screen.findByRole('radio', { name: 'In progress' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('incidents', { status: 'in_progress' }),
    )

    await userEvent.selectOptions(screen.getByLabelText('Assignee'), 'user-sam')
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('incidents', { assignee_id: 'user-sam' }),
    )
  })

  it('clears the assignee back to nobody', async () => {
    membership('manager')
    tableRows.mockImplementation((table) =>
      table === 'incidents'
        ? [
            incident({
              assignee_id: 'user-sam',
              assignee: { id: 'user-sam', full_name: 'Sam Staff' },
            }),
          ]
        : [],
    )
    renderDetail()

    await userEvent.selectOptions(await screen.findByLabelText('Assignee'), '')
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('incidents', { assignee_id: null }),
    )
  })

  it('shows the photographs through a signed URL', async () => {
    tableRows.mockImplementation((table) => {
      if (table === 'incidents') return [incident()]
      if (table === 'incident_attachments')
        return [
          {
            id: 'attachment-1',
            path: 'gym-nord/incident-1/photo.jpg',
            mime_type: 'image/jpeg',
            created_at: '2026-09-02T15:01:00Z',
          },
        ]
      return []
    })
    renderDetail()

    const photo = await screen.findByAltText('Incident photo')
    expect(photo).toHaveAttribute('src', 'https://signed/gym-nord/incident-1/photo.jpg')
  })

  it('adds a comment to the thread', async () => {
    tableRows.mockImplementation((table) => {
      if (table === 'incidents') return [incident()]
      if (table === 'incident_comments')
        return [
          {
            id: 'comment-1',
            body: 'Route setter has been told.',
            created_at: '2026-09-02T15:30:00Z',
            created_by: 'user-mette',
            author: { id: 'user-mette', full_name: 'Mette Manager' },
          },
        ]
      return []
    })
    renderDetail()

    expect(await screen.findByText('Route setter has been told.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Comment'), '  Hold replaced.  ')
    await userEvent.click(screen.getByRole('button', { name: 'Add comment' }))

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith('incident_comments', {
        incident_id: 'incident-1',
        body: 'Hold replaced.',
      }),
    )
  })
})
