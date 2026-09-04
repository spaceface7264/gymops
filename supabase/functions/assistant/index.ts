// P8-03 — the assistant: a question in, an answer out, over what the person
// asking may read (spec §2.3).
//
// Two surfaces. The Ask page posts `{ surface: 'ask', question, conversation_id? }`
// and gets the answer as a stream of server-sent events; a chat composer that
// just sent an @assistant message posts `{ surface: 'channel', channel_id,
// message_id }` and gets the id of the reply the function wrote into the
// channel. Either way the caller's own JWT is what the tools search and read
// with, so RLS decides what the model sees; the service role only records —
// the conversation, the reply, and one `assistant_usage` row per call, which
// is also what the daily cap counts (P8-01).
//
// Nothing here is optional the way notify's channels are: without
// `ANTHROPIC_API_KEY` the function says so (503) and the app shows it.
//
// Deployment and the secrets this depends on: PROJECT_STATE.md, "Hosted
// project cutover".
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../src/lib/database.types.ts'
import {
  type AskRequest,
  type ChannelRequest,
  CORS,
  fail,
  json,
  mentionsAssistant,
  parse,
  renderTranscript,
  replyBody,
  toProblem,
  type TranscriptRow,
} from './lib.ts'
import { type Locale, MODEL } from './prompt.ts'
import { answer, emptyUsage, type Usage } from './run.ts'
import { frame, heartbeat } from './sse.ts'

type Client = SupabaseClient<Database>
type Caller = { id: string; locale: Locale }

type Context = {
  caller: Caller
  /** The caller's own client: every read and every tool call, so RLS applies. */
  asUser: Client
  /** Records only. */
  service: Client
  apiKey: string
}

const env = (name: string) => Deno.env.get(name) ?? ''

const RECENT_MESSAGES = 20
const HISTORY_TURNS = 40
const HEARTBEAT_MS = 15_000

async function readCaller(service: Client, token: string): Promise<Caller | null> {
  const { data, error } = await service.auth.getUser(token)
  if (error || !data.user) return null

  const { data: profile } = await service
    .from('profiles')
    .select('id, active, locale')
    .eq('id', data.user.id)
    .single()
  if (!profile?.active) return null

  return { id: profile.id, locale: profile.locale === 'en' ? 'en' : 'da' }
}

/** The call is counted before the model is asked; what it cost is filled in after. */
async function reserveUsage(
  service: Client,
  row: {
    user_id: string
    surface: 'ask' | 'channel'
    conversation_id?: string
    channel_id?: string
  },
): Promise<string | null> {
  const { data } = await service
    .from('assistant_usage')
    .insert({ ...row, model: MODEL })
    .select('id')
    .single()
  return data?.id ?? null
}

async function recordUsage(service: Client, id: string, usage: Usage) {
  await service.from('assistant_usage').update(usage).eq('id', id)
}

async function ask(context: Context, request: AskRequest): Promise<Response> {
  const { caller, asUser, service, apiKey } = context

  let conversationId = request.conversationId
  if (conversationId) {
    const { data } = await asUser
      .from('assistant_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle()
    if (!data) return fail(404, 'conversation_not_found')
  } else {
    const { data } = await service
      .from('assistant_conversations')
      .insert({ user_id: caller.id, title: request.question.slice(0, 80) })
      .select('id')
      .single()
    if (!data) return fail(500, 'not_recorded')
    conversationId = data.id
  }

  const { data: history } = await asUser
    .from('assistant_messages')
    .select('role, body')
    .eq('conversation_id', conversationId)
    .order('created_at')
    .limit(HISTORY_TURNS)

  // The question is kept before the model is asked, so a failed run still
  // leaves the conversation as the person wrote it.
  const { error: questionError } = await service
    .from('assistant_messages')
    .insert({ conversation_id: conversationId, role: 'user', body: request.question })
  if (questionError) return fail(500, 'not_recorded')

  const usageId = await reserveUsage(service, {
    user_id: caller.id,
    surface: 'ask',
    conversation_id: conversationId,
  })
  if (!usageId) return fail(500, 'not_recorded')

  const messages = [
    ...(history ?? []).map((turn) => ({
      role: turn.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: turn.body,
    })),
    { role: 'user' as const, content: request.question },
  ]

  const usage = emptyUsage()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (bytes: Uint8Array) => {
        try {
          controller.enqueue(bytes)
        } catch {
          // The reader went away; the answer is still recorded below.
        }
      }
      const ping = setInterval(() => send(heartbeat()), HEARTBEAT_MS)

      try {
        const result = await answer({
          apiKey,
          asUser,
          messages,
          locale: caller.locale,
          usage,
          onDelta: (text) => send(frame('delta', { text })),
        })

        const { data: reply } = await service
          .from('assistant_messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            body: result.text,
            sources: result.sources,
          })
          .select('id')
          .single()
        await service
          .from('assistant_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
        await recordUsage(service, usageId, usage)

        if (!reply) {
          send(frame('error', { error: 'not_recorded' }))
          return
        }
        send(frame('sources', { sources: result.sources }))
        send(
          frame('done', { conversation_id: conversationId, message_id: reply.id, usage }),
        )
      } catch (error) {
        await recordUsage(service, usageId, usage)
        const problem = toProblem(error)
        console.error('assistant/ask', problem.code, error)
        send(frame('error', { error: problem.code }))
      } finally {
        clearInterval(ping)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    },
  })
}

async function channel(context: Context, request: ChannelRequest): Promise<Response> {
  const { caller, asUser, service, apiKey } = context

  const { data: message } = await asUser
    .from('messages')
    .select('id, body, created_by')
    .eq('id', request.messageId)
    .eq('channel_id', request.channelId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!message) return fail(404, 'message_not_found')
  if (message.created_by !== caller.id || !mentionsAssistant(message.body)) {
    return fail(400, 'not_a_mention')
  }

  const { data: recent } = await asUser
    .from('messages')
    .select('body, from_assistant, author:created_by(full_name)')
    .eq('channel_id', request.channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(RECENT_MESSAGES)
  const rows: TranscriptRow[] = (recent ?? []).reverse()

  const usageId = await reserveUsage(service, {
    user_id: caller.id,
    surface: 'channel',
    channel_id: request.channelId,
  })
  if (!usageId) return fail(500, 'not_recorded')

  const usage = emptyUsage()
  try {
    const result = await answer({
      apiKey,
      asUser,
      messages: [{ role: 'user', content: renderTranscript(rows, caller.locale) }],
      locale: caller.locale,
      usage,
    })
    await recordUsage(service, usageId, usage)

    const siteUrl = env('SITE_URL') || 'http://localhost:5173'
    const { data: reply } = await service
      .from('messages')
      .insert({
        channel_id: request.channelId,
        body: replyBody(result.text, result.sources, siteUrl, caller.locale),
        from_assistant: true,
        mentions: [],
      })
      .select('id')
      .single()
    if (!reply) return fail(500, 'not_recorded')

    return json({ message_id: reply.id }, 200)
  } catch (error) {
    await recordUsage(service, usageId, usage)
    const problem = toProblem(error)
    console.error('assistant/channel', problem.code, error)
    return fail(problem.status, problem.code)
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (request.method !== 'POST') return fail(405, 'method_not_allowed')

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return fail(401, 'unauthenticated')

  const url = env('SUPABASE_URL')
  const service = createClient<Database>(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  const caller = await readCaller(service, token)
  if (!caller) return fail(401, 'unauthenticated')

  const asUser = createClient<Database>(url, env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const input = parse(await request.json().catch(() => null))
  if (!input) return fail(400, 'invalid_request')

  const apiKey = env('ANTHROPIC_API_KEY')
  if (!apiKey) return fail(503, 'assistant_not_configured')

  const { data: quota } = await asUser.rpc('assistant_quota').single()
  if (!quota) return fail(500, 'quota_unavailable')
  if (quota.used >= quota.cap) {
    return json({ error: 'cap_reached', used: quota.used, cap: quota.cap }, 429)
  }

  const context: Context = { caller, asUser, service, apiKey }
  return input.surface === 'ask' ? ask(context, input) : channel(context, input)
})
