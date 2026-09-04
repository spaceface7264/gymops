// P8-03 — the parts of the assistant function that need no network.
import Anthropic from '@anthropic-ai/sdk'
import { assertEquals } from '@std/assert'
import {
  CORS,
  json,
  MAX_QUESTION_CHARS,
  mentionsAssistant,
  parse,
  renderTranscript,
  replyBody,
  toProblem,
} from './lib.ts'
import { frame, heartbeat } from './sse.ts'

const decoder = new TextDecoder()
const id = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'

Deno.test('parse: an ask carries a trimmed question and an optional conversation', () => {
  assertEquals(parse({ surface: 'ask', question: '  chalk?  ' }), {
    surface: 'ask',
    question: 'chalk?',
    conversationId: undefined,
  })
  assertEquals(parse({ surface: 'ask', question: 'chalk?', conversation_id: id }), {
    surface: 'ask',
    question: 'chalk?',
    conversationId: id,
  })
})

Deno.test('parse: refuses an empty, an overlong, or a badly addressed ask', () => {
  assertEquals(parse({ surface: 'ask', question: '   ' }), null)
  assertEquals(
    parse({ surface: 'ask', question: 'x'.repeat(MAX_QUESTION_CHARS + 1) }),
    null,
  )
  assertEquals(
    parse({ surface: 'ask', question: 'chalk?', conversation_id: 'nope' }),
    null,
  )
})

Deno.test('parse: a channel request needs both ids as uuids', () => {
  assertEquals(parse({ surface: 'channel', channel_id: id, message_id: id }), {
    surface: 'channel',
    channelId: id,
    messageId: id,
  })
  assertEquals(parse({ surface: 'channel', channel_id: id, message_id: '1' }), null)
  assertEquals(parse({ surface: 'channel', channel_id: id }), null)
})

Deno.test('parse: anything else is not a request', () => {
  assertEquals(parse(null), null)
  assertEquals(parse('ask'), null)
  assertEquals(parse({ surface: 'other' }), null)
})

Deno.test('mentionsAssistant: the handle, in any case, as a whole word', () => {
  assertEquals(mentionsAssistant('@assistant what is the chalk policy?'), true)
  assertEquals(mentionsAssistant('Hey @Assistant, chalk?'), true)
  assertEquals(mentionsAssistant('@assistants meeting'), false)
  assertEquals(mentionsAssistant('assistant manager?'), false)
})

Deno.test('renderTranscript: names people, the assistant, and nobody by email', () => {
  const text = renderTranscript(
    [
      { body: 'Chalk?', from_assistant: false, author: { full_name: 'Anna Ask' } },
      { body: 'Liquid only.', from_assistant: true, author: null },
      {
        body: '@assistant since when?',
        from_assistant: false,
        author: { full_name: '  ' },
      },
    ],
    'da',
  )
  assertEquals(
    text,
    'Channel transcript, oldest first. The last line mentions you.\n\n' +
      'Anna Ask: Chalk?\nAssistent: Liquid only.\nKollega: @assistant since when?',
  )
})

Deno.test('replyBody: sources become bare URLs on their own lines', () => {
  const body = replyBody(
    'Liquid chalk only.',
    [
      { kind: 'news', id, title: 'Chalk policy' },
      { kind: 'guide', id: id.replace('0f0f0f0f-', '1f1f1f1f-'), title: 'Opening' },
    ],
    'https://ops.example/',
    'en',
  )
  assertEquals(
    body,
    'Liquid chalk only.\n\nSources:\n' +
      `- Chalk policy: https://ops.example/news/${id}\n` +
      `- Opening: https://ops.example/guides/${id.replace('0f0f0f0f-', '1f1f1f1f-')}`,
  )
  assertEquals(
    replyBody('Nothing found.', [], 'https://ops.example', 'en'),
    'Nothing found.',
  )
})

Deno.test('toProblem: rate limits and timeouts are "busy", other API errors "error"', () => {
  const headers = new Headers()
  assertEquals(
    toProblem(new Anthropic.RateLimitError(429, {}, 'slow down', headers)),
    { status: 503, code: 'upstream_busy' },
  )
  assertEquals(toProblem(new Anthropic.APIConnectionTimeoutError()), {
    status: 503,
    code: 'upstream_busy',
  })
  assertEquals(
    toProblem(new Anthropic.BadRequestError(400, {}, 'bad', headers)),
    { status: 502, code: 'upstream_error' },
  )
  assertEquals(toProblem(new Error('boom')), { status: 500, code: 'assistant_failed' })
})

Deno.test('json: every response carries the CORS headers', () => {
  const response = json({ ok: true }, 200)
  assertEquals(response.headers.get('access-control-allow-origin'), '*')
  assertEquals(response.headers.get('content-type'), 'application/json')
  assertEquals(Object.keys(CORS).length, 3)
})

Deno.test('sse: a frame is an event line, a data line, and a blank line', () => {
  assertEquals(
    decoder.decode(frame('delta', { text: 'x' })),
    'event: delta\ndata: {"text":"x"}\n\n',
  )
  assertEquals(decoder.decode(heartbeat()), ': ping\n\n')
})
