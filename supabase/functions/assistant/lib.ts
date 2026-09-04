// P8-03 — the parts of the assistant function that need no network: request
// parsing, the channel transcript, the reply body, and the error mapping.
// Kept apart from index.ts so they can be tested without starting the server.
import Anthropic from '@anthropic-ai/sdk'
import { type Locale, TEXT } from './prompt.ts'

export type AskRequest = {
  surface: 'ask'
  question: string
  conversationId?: string
}

export type ChannelRequest = {
  surface: 'channel'
  channelId: string
  messageId: string
}

export type AssistantRequest = AskRequest | ChannelRequest

export type Source = { kind: 'news' | 'guide'; id: string; title: string }

/** One line of the recent conversation, as the caller may read it. */
export type TranscriptRow = {
  body: string
  from_assistant: boolean
  author: { full_name: string | null } | null
}

export const MAX_QUESTION_CHARS = 4000

/** The desktop app's origin is `tauri://localhost`, so no fixed origin fits; the JWT is the gate. */
export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })

export const fail = (status: number, error: string) => json({ error }, status)

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parse(body: unknown): AssistantRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const input = body as Record<string, unknown>

  if (input.surface === 'ask') {
    const question = typeof input.question === 'string' ? input.question.trim() : ''
    if (!question || question.length > MAX_QUESTION_CHARS) return null
    const conversationId = input.conversation_id
    if (
      conversationId !== undefined &&
      !(typeof conversationId === 'string' && uuid.test(conversationId))
    ) {
      return null
    }
    return { surface: 'ask', question, conversationId }
  }

  if (input.surface === 'channel') {
    const { channel_id: channelId, message_id: messageId } = input
    if (typeof channelId !== 'string' || !uuid.test(channelId)) return null
    if (typeof messageId !== 'string' || !uuid.test(messageId)) return null
    return { surface: 'channel', channelId, messageId }
  }

  return null
}

/** The composer inserts `@assistant `; a hand-typed `@Assistant` counts too. */
export const mentionsAssistant = (body: string) => /@assistant\b/i.test(body)

/**
 * The last twenty lines of a channel as one user turn. Colleagues appear by
 * name only — no email, no id — and the assistant's own lines by its name in
 * the asker's language, so the model can tell its earlier answers apart.
 */
export function renderTranscript(rows: TranscriptRow[], locale: Locale): string {
  const text = TEXT[locale]
  const lines = rows.map((row) => {
    const name = row.from_assistant
      ? text.assistant
      : row.author?.full_name?.trim() || text.colleague
    return `${name}: ${row.body}`
  })
  return `Channel transcript, oldest first. The last line mentions you.\n\n${
    lines.join('\n')
  }`
}

/**
 * What goes into the channel: the answer, then the sources as bare URLs on
 * their own lines, which is the one kind of link ChatMarkdown turns into one.
 */
export function replyBody(
  answer: string,
  sources: Source[],
  siteUrl: string,
  locale: Locale,
) {
  if (sources.length === 0) return answer
  const base = siteUrl.replace(/\/$/, '')
  const lines = sources.map(
    (source) =>
      `- ${source.title}: ${base}/${
        source.kind === 'guide' ? 'guides' : 'news'
      }/${source.id}`,
  )
  return `${answer}\n\n${TEXT[locale].sources}:\n${lines.join('\n')}`
}

export type Problem = { status: number; code: string }

/** Anthropic's typed errors to the function's own codes, most specific first. */
export function toProblem(error: unknown): Problem {
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 503, code: 'upstream_busy' }
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 503, code: 'upstream_busy' }
  }
  if (error instanceof Anthropic.APIError) return { status: 502, code: 'upstream_error' }
  return { status: 500, code: 'assistant_failed' }
}
