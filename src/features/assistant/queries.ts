import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type ConversationRow = Database['public']['Tables']['assistant_conversations']['Row']

/** What the `assistant` function refuses with; anything else is a bug or an outage. */
export type AssistantProblem =
  'cap_reached' | 'not_configured' | 'upstream_busy' | 'upstream_error' | 'unknown'

export class AssistantError extends Error {
  problem: AssistantProblem

  constructor(problem: AssistantProblem) {
    super(problem)
    this.name = 'AssistantError'
    this.problem = problem
  }
}

const problems: Record<string, AssistantProblem> = {
  cap_reached: 'cap_reached',
  assistant_not_configured: 'not_configured',
  upstream_busy: 'upstream_busy',
  upstream_error: 'upstream_error',
}

/** The function's own error code, as the app names it. */
export const toProblem = (code: unknown): AssistantProblem =>
  (typeof code === 'string' && problems[code]) || 'unknown'

/** `functions.invoke` keeps the body out of the error; the code is in its context. */
export async function readProblem(error: unknown): Promise<AssistantProblem> {
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context
  if (!context?.json) return 'unknown'

  const body: unknown = await context.json().catch(() => null)
  return toProblem((body as { error?: unknown } | null)?.error)
}

/** A published item an answer was read from; the link under the answer. */
export type Source = { kind: 'news' | 'guide'; id: string; title: string }

export type Conversation = Pick<ConversationRow, 'id' | 'title' | 'updated_at'>

export type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  body: string
  sources: Source[]
  created_at: string
}

export const assistantKeys = {
  all: ['assistant'] as const,
  conversations: ['assistant', 'conversations'] as const,
  messages: (conversationId: string) =>
    ['assistant', 'messages', conversationId] as const,
  quota: ['assistant', 'quota'] as const,
  settings: ['assistant', 'settings'] as const,
  usage: ['assistant', 'usage'] as const,
}

/** The jsonb column, checked rather than trusted: the function wrote it, but it is data. */
export function parseSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const source = item as Partial<Source> | null
    return source &&
      (source.kind === 'news' || source.kind === 'guide') &&
      typeof source.id === 'string' &&
      typeof source.title === 'string'
      ? [{ kind: source.kind, id: source.id, title: source.title }]
      : []
  })
}

/** This person's own conversations, latest activity first. */
export function useConversations() {
  return useQuery({
    queryKey: assistantKeys.conversations,
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

export function useConversationMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: assistantKeys.messages(conversationId ?? ''),
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<AssistantMessage[]> => {
      const { data, error } = await supabase
        .from('assistant_messages')
        .select('id, role, body, sources, created_at')
        .eq('conversation_id', conversationId ?? '')
        .order('created_at')

      if (error) throw error
      return data.map((row) => ({
        id: row.id,
        role: row.role === 'assistant' ? 'assistant' : 'user',
        body: row.body,
        sources: parseSources(row.sources),
        created_at: row.created_at,
      }))
    },
  })
}

/** Deleting is the one write the owner makes here; the messages go with it (cascade). */
export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('assistant_conversations')
        .delete()
        .eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: assistantKeys.conversations }),
  })
}

/** "12 of 50 today": `assistant_quota()`, the same count the function refuses on. */
export function useAssistantQuota() {
  return useQuery({
    queryKey: assistantKeys.quota,
    queryFn: async (): Promise<{ used: number; cap: number }> => {
      const { data, error } = await supabase.rpc('assistant_quota').single()
      if (error) throw error
      return data
    },
  })
}

/**
 * The question goes to the function with plain `fetch`: `functions.invoke`
 * waits for the whole body, and the answer is a stream. The session is read
 * first so a token about to expire is refreshed before the function pins it
 * for the run. A refusal before the stream opens is a JSON error and is
 * thrown; a stream is returned as-is for `useAsk` to read.
 */
export async function askStream(input: {
  question: string
  conversationId?: string
  signal: AbortSignal
}): Promise<ReadableStream<Uint8Array>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AssistantError('unknown')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        surface: 'ask',
        question: input.question,
        ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
      }),
      signal: input.signal,
    },
  )

  if (!response.ok || !response.body) {
    const body: unknown = await response.json().catch(() => null)
    throw new AssistantError(toProblem((body as { error?: unknown } | null)?.error))
  }

  return response.body
}

const capKey = 'assistant_daily_cap'
const defaultCap = 50

/** The daily cap as `app_settings` holds it; everyone may read it, a superadmin move it. */
export function useAssistantSettings() {
  return useQuery({
    queryKey: assistantKeys.settings,
    queryFn: async (): Promise<{ dailyCap: number }> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', capKey)
        .single()
      if (error) throw error
      const cap = Number(data.value)
      return { dailyCap: Number.isFinite(cap) && cap > 0 ? cap : defaultCap }
    },
  })
}

export function useSetDailyCap() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (dailyCap: number) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: dailyCap })
        .eq('key', capKey)
      if (error) throw error
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assistantKeys.settings }),
        queryClient.invalidateQueries({ queryKey: assistantKeys.quota }),
      ])
    },
  })
}

/** One call, as `assistant_usage` records it, with who made it. */
export type UsageRow = {
  user_id: string
  surface: string
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  created_at: string
  user: { full_name: string | null; email: string } | null
}

export type UsageLine = {
  userId: string
  name: string
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
}

/** One line per person, most calls first. */
export function summariseUsage(rows: UsageRow[]): UsageLine[] {
  const lines = new Map<string, UsageLine>()

  for (const row of rows) {
    const line = lines.get(row.user_id) ?? {
      userId: row.user_id,
      name: row.user?.full_name?.trim() || row.user?.email || row.user_id,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
    }
    line.calls += 1
    line.inputTokens += row.input_tokens
    line.outputTokens += row.output_tokens
    line.cacheReadTokens += row.cache_read_input_tokens
    lines.set(row.user_id, line)
  }

  return [...lines.values()].sort(
    (a, b) => b.calls - a.calls || a.name.localeCompare(b.name),
  )
}

export const usageWindowDays = 30

/**
 * Every call of the last thirty days. `assistant_usage_select` lets a
 * superadmin read them all and everyone else their own, so the same query
 * would serve a personal view; only the superadmin screen asks today.
 */
export function useAssistantUsage() {
  return useQuery({
    queryKey: assistantKeys.usage,
    queryFn: async (): Promise<UsageRow[]> => {
      const since = new Date(Date.now() - usageWindowDays * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from('assistant_usage')
        .select(
          'user_id, surface, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, created_at, user:user_id(full_name, email)',
        )
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/**
 * Once an @assistant message is in the channel, its sender asks the function
 * to answer it (P8-05). The sender's own JWT is what the function reads with,
 * so the reply knows only what the sender could open. The reply itself
 * arrives like any other message, through the channel's live subscription.
 */
export function useAssistantReply() {
  return useMutation<
    { messageId: string },
    AssistantError,
    { channelId: string; messageId: string }
  >({
    mutationFn: async ({ channelId, messageId }) => {
      const result = await supabase.functions.invoke<{ message_id: string }>(
        'assistant',
        {
          body: { surface: 'channel', channel_id: channelId, message_id: messageId },
        },
      )

      if (result.error) throw new AssistantError(await readProblem(result.error))
      if (!result.data) throw new AssistantError('unknown')
      return { messageId: result.data.message_id }
    },
  })
}
