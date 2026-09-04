import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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

/** `functions.invoke` keeps the body out of the error; the code is in its context. */
export async function readProblem(error: unknown): Promise<AssistantProblem> {
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context
  if (!context?.json) return 'unknown'

  const body: unknown = await context.json().catch(() => null)
  const code = (body as { error?: unknown } | null)?.error
  return (typeof code === 'string' && problems[code]) || 'unknown'
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
