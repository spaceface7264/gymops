import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AskPage } from '@/features/assistant'
import { renderWithProviders } from '@/test/render'

type Row = Record<string, unknown>

const conversationRows = vi.fn<() => Row[]>()
const messageRows = vi.fn<() => Row[]>()
const quota = vi.fn<() => Row>()
const deleted = vi.fn<(table: string, filters: [string, unknown][]) => void>()
const fetched = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()

function builder(table: string) {
  let deleting = false
  const filters: [string, unknown][] = []

  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push([column, value])
      return chain
    },
    order: () => chain,
    limit: () => chain,
    delete: () => {
      deleting = true
      return chain
    },
    then: (resolve: (value: unknown) => unknown) => {
      if (deleting) deleted(table, filters)
      const data =
        table === 'assistant_conversations' ? conversationRows() : messageRows()
      return Promise.resolve({ data, error: null }).then(resolve)
    },
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: () => ({ single: () => Promise.resolve({ data: quota(), error: null }) }),
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { access_token: 'token-123' } },
          error: null,
        }),
    },
  },
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-sam' } }),
  useProfile: () => ({ data: { id: 'user-sam', is_admin: false, is_superadmin: false } }),
}))

const encoder = new TextEncoder()

/** What the function streams: one frame per entry, closed at the end. */
function streamOf(frames: string[], status = 200) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(stream, { status })
}

const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

const conversation = (overrides: Row = {}): Row => ({
  id: 'c1',
  title: 'Chalk?',
  updated_at: '2026-09-04T10:00:00Z',
  ...overrides,
})

const message = (overrides: Row = {}): Row => ({
  id: 'm1',
  role: 'user',
  body: 'What is the chalk policy?',
  sources: [],
  created_at: '2026-09-04T10:00:00Z',
  ...overrides,
})

/** Where the page went: the route the first answer navigates to. */
function Opened() {
  const { conversationId } = useParams()
  return <p>opened {conversationId}</p>
}

function renderAsk(path = '/ask', route = '/ask') {
  return renderWithProviders(<AskPage />, {
    path: route,
    initialEntries: [path],
    routes:
      route === '/ask' ? [{ path: '/ask/:conversationId', element: <Opened /> }] : [],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetched)
  conversationRows.mockReturnValue([])
  messageRows.mockReturnValue([])
  quota.mockReturnValue({ used: 3, cap: 50 })
  fetched.mockResolvedValue(
    streamOf([
      frame('delta', { text: 'Liquid ' }),
      frame('delta', { text: 'chalk only.' }),
      frame('sources', { sources: [{ kind: 'news', id: 'p1', title: 'Chalk policy' }] }),
      frame('done', { conversation_id: 'c-new', message_id: 'm-new', usage: {} }),
    ]),
  )
})

describe('the conversation list', () => {
  it('lists what has been asked, newest first as the query returns it', async () => {
    conversationRows.mockReturnValue([
      conversation({ id: 'c2', title: 'Opening hours' }),
      conversation(),
    ])
    renderAsk()

    const list = await screen.findByRole('list', { name: 'Conversations' })
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Opening hours')
    expect(items[1]).toHaveTextContent('Chalk?')
  })

  it('says so when nothing has been asked, and shows the day’s allowance', async () => {
    renderAsk()

    expect(await screen.findByText('Nothing asked yet.')).toBeInTheDocument()
    expect(screen.getByText('3 of 50 today')).toBeInTheDocument()
  })
})

describe('a conversation', () => {
  it('shows its turns, with the sources an answer was read from', async () => {
    conversationRows.mockReturnValue([conversation()])
    messageRows.mockReturnValue([
      message(),
      message({
        id: 'm2',
        role: 'assistant',
        body: 'Liquid chalk only.',
        sources: [{ kind: 'news', id: 'p1', title: 'Chalk policy' }],
        created_at: '2026-09-04T10:00:05Z',
      }),
    ])
    renderAsk('/ask/c1', '/ask/:conversationId')

    expect(await screen.findByText('What is the chalk policy?')).toBeInTheDocument()
    expect(screen.getByText('Liquid chalk only.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chalk policy' })).toHaveAttribute(
      'href',
      '/news/p1',
    )
  })

  it('deletes one from its own screen', async () => {
    conversationRows.mockReturnValue([conversation()])
    renderAsk('/ask/c1', '/ask/:conversationId')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete conversation' }),
    )

    await waitFor(() =>
      expect(deleted).toHaveBeenCalledWith('assistant_conversations', [['id', 'c1']]),
    )
  })
})

describe('asking', () => {
  it('posts the question with the session token, streams the answer, then opens the conversation', async () => {
    renderAsk()

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Ask a question' }),
      'Chalk policy?{Enter}',
    )

    await waitFor(() => expect(fetched).toHaveBeenCalled())
    const [url, init] = fetched.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:54321/functions/v1/assistant')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer token-123',
      apikey: 'test-publishable-key',
    })
    expect(JSON.parse(init.body as string)).toEqual({
      surface: 'ask',
      question: 'Chalk policy?',
    })

    expect(await screen.findByText('opened c-new')).toBeInTheDocument()
  })

  it('shows the answer as it arrives, with its sources', async () => {
    let release!: () => void
    const held = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frame('delta', { text: 'Liquid ' })))
        release = () => {
          controller.enqueue(encoder.encode(frame('delta', { text: 'chalk only.' })))
          controller.enqueue(
            encoder.encode(
              frame('sources', {
                sources: [{ kind: 'guide', id: 'g1', title: 'Chalk' }],
              }),
            ),
          )
          controller.enqueue(
            encoder.encode(
              frame('done', { conversation_id: 'c1', message_id: 'm-new', usage: {} }),
            ),
          )
          controller.close()
        }
      },
    })
    fetched.mockResolvedValue(new Response(held, { status: 200 }))
    conversationRows.mockReturnValue([conversation()])
    renderAsk('/ask/c1', '/ask/:conversationId')

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Ask a question' }),
      'Chalk policy?{Enter}',
    )

    expect(await screen.findByText('Liquid')).toBeInTheDocument()
    release()
    expect(await screen.findByText('Liquid chalk only.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chalk' })).toHaveAttribute(
      'href',
      '/guides/g1',
    )
    const [, init] = fetched.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({
      conversation_id: 'c1',
    })
  })

  it('says when the day’s limit is reached', async () => {
    fetched.mockResolvedValue(
      new Response(JSON.stringify({ error: 'cap_reached', used: 50, cap: 50 }), {
        status: 429,
      }),
    )
    renderAsk()

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Ask a question' }),
      'Chalk?{Enter}',
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You have reached today’s limit for the assistant.',
    )
  })

  it('reports a run that failed halfway, and lets the question be asked again', async () => {
    fetched.mockResolvedValue(
      streamOf([
        frame('delta', { text: 'Liq' }),
        frame('error', { error: 'upstream_error' }),
      ]),
    )
    renderAsk()

    const box = await screen.findByRole('textbox', { name: 'Ask a question' })
    await userEvent.type(box, 'Chalk?{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The assistant couldn't answer. Try again in a moment.",
    )
    expect(box).toBeEnabled()
  })
})
