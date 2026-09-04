// P8-03 — one answer: the model, its two tools, and the loop between them.
//
// Both tools call the SQL functions of P8-02 through the caller's own client,
// so what the model can search and read is exactly what the person asking
// could open themselves (spec §2.3). Everything read is recorded as a source;
// the citations on an answer are those records, not anything the model wrote.
//
// The SDK's tool runner drives the loop and streams each iteration; text is
// forwarded as it arrives and kept, so what the person watched and what is
// stored are the same string. Usage is summed across iterations into the
// object the caller passed, so a run that fails halfway still reports what it
// spent.
import Anthropic from '@anthropic-ai/sdk'
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../src/lib/database.types.ts'
import type { Source } from './lib.ts'
import {
  EFFORT,
  type Locale,
  MAX_BODY_CHARS,
  MAX_ITERATIONS,
  MAX_TOKENS,
  MODEL,
  SYSTEM_PROMPT,
  TEXT,
} from './prompt.ts'

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

export const emptyUsage = (): Usage => ({
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
})

function addUsage(total: Usage, seen: Anthropic.Beta.BetaUsage) {
  total.input_tokens += seen.input_tokens
  total.output_tokens += seen.output_tokens
  total.cache_creation_input_tokens += seen.cache_creation_input_tokens ?? 0
  total.cache_read_input_tokens += seen.cache_read_input_tokens ?? 0
}

export function makeTools(asUser: SupabaseClient<Database>, sources: Source[]) {
  const searchContent = betaTool({
    name: 'search_content',
    description:
      'Full-text search over the published guides and news this person may read. Returns up to ten hits with a short snippet. The content is written in Danish or English: search in the language it is likely written in, and try other words or the other language if nothing matches.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'A few search words' } },
      required: ['query'],
      additionalProperties: false,
    },
    run: async ({ query }) => {
      const { data, error } = await asUser.rpc('search_content', { query })
      // Returned rather than thrown: the model can say the search failed.
      if (error) return JSON.stringify({ error: 'search_failed' })
      return data.length > 0 ? JSON.stringify(data) : 'No published content matches.'
    },
  })

  const readContent = betaTool({
    name: 'read_content',
    description:
      'Read one published guide or news post in full, by the kind and id search_content returned.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['news', 'guide'] },
        id: { type: 'string' },
      },
      required: ['kind', 'id'],
      additionalProperties: false,
    },
    run: async ({ kind, id }) => {
      const { data, error } = await asUser.rpc('read_content', {
        target_kind: kind,
        target_id: id,
      })
      const row = data?.[0]
      if (error || !row) return 'Not found, or not something this person may read.'
      if (!sources.some((source) => source.id === id)) {
        sources.push({ kind, id, title: row.title })
      }
      return JSON.stringify({
        title: row.title,
        gym: row.gym_name,
        published_at: row.published_at,
        body: row.body_text.slice(0, MAX_BODY_CHARS),
      })
    },
  })

  return [searchContent, readContent]
}

export type AnswerOptions = {
  apiKey: string
  asUser: SupabaseClient<Database>
  messages: Anthropic.Beta.BetaMessageParam[]
  locale: Locale
  /** Summed into as the run goes, so a failed run still reports what it spent. */
  usage: Usage
  onDelta?: (text: string) => void
}

export async function answer(
  options: AnswerOptions,
): Promise<{ text: string; sources: Source[] }> {
  const { apiKey, asUser, messages, locale, usage, onDelta } = options
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 })
  const sources: Source[] = []
  let text = ''

  const emit = (piece: string) => {
    text += piece
    onDelta?.(piece)
  }

  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    max_iterations: MAX_ITERATIONS,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: makeTools(asUser, sources),
    messages,
    stream: true,
  })

  for await (const stream of runner) {
    let spoke = false
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        // A remark before a tool call and the answer after it are two paragraphs.
        if (!spoke && text) emit('\n\n')
        spoke = true
        emit(event.delta.text)
      }
    }

    const message = await stream.finalMessage()
    addUsage(usage, message.usage)

    if (message.stop_reason === 'refusal') {
      text = ''
      emit(TEXT[locale].refusal)
      break
    }
    if (message.stop_reason === 'max_tokens') {
      emit(`\n\n${TEXT[locale].cutShort}`)
      break
    }
  }

  return { text: text.trim(), sources }
}
