import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  AssistantError,
  askStream,
  assistantKeys,
  parseSources,
  toProblem,
  type AssistantProblem,
  type Source,
} from './queries'
import { parseSse } from './sse'

export type AskStatus = 'idle' | 'streaming' | 'done' | 'error'

type AskState = {
  status: AskStatus
  text: string
  sources: Source[]
  problem: AssistantProblem | null
  /** The stored reply, once `done` names it; the thread swaps the live bubble for it. */
  messageId: string | null
}

type AskAction =
  | { type: 'start' }
  | { type: 'delta'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'done'; messageId: string }
  | { type: 'error'; problem: AssistantProblem }
  | { type: 'reset' }

const initial: AskState = {
  status: 'idle',
  text: '',
  sources: [],
  problem: null,
  messageId: null,
}

function reduce(state: AskState, action: AskAction): AskState {
  switch (action.type) {
    case 'start':
      return { ...initial, status: 'streaming' }
    case 'delta':
      return { ...state, text: state.text + action.text }
    case 'sources':
      return { ...state, sources: action.sources }
    case 'done':
      return { ...state, status: 'done', messageId: action.messageId }
    case 'error':
      return { ...state, status: 'error', problem: action.problem }
    case 'reset':
      return initial
  }
}

/**
 * One question at a time, answered as it streams. `ask` resolves with the
 * conversation the answer landed in — a new one when none was given — and the
 * queries behind the page are refreshed on `done`, so the stored turns replace
 * the live ones. Leaving the page, or `stop`, aborts the read; the function
 * finishes and stores the answer regardless.
 */
export function useAsk() {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(reduce, initial)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const ask = useCallback(
    async (
      question: string,
      conversationId?: string,
    ): Promise<{ conversationId: string } | null> => {
      controller.current?.abort()
      const aborter = new AbortController()
      controller.current = aborter
      dispatch({ type: 'start' })

      let landed: string | null = null
      try {
        const stream = await askStream({
          question,
          conversationId,
          signal: aborter.signal,
        })
        const reader = stream.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parsed = parseSse(buffer)
          buffer = parsed.rest

          for (const frame of parsed.events) {
            const data: unknown = JSON.parse(frame.data)
            const payload = data as Record<string, unknown>
            const text = (key: string) =>
              typeof payload[key] === 'string' ? payload[key] : ''
            if (frame.event === 'delta') {
              dispatch({ type: 'delta', text: text('text') })
            } else if (frame.event === 'sources') {
              dispatch({ type: 'sources', sources: parseSources(payload.sources) })
            } else if (frame.event === 'done') {
              landed = text('conversation_id')
              dispatch({ type: 'done', messageId: text('message_id') })
            } else if (frame.event === 'error') {
              throw new AssistantError(toProblem(payload.error))
            }
          }
        }

        if (!landed) throw new AssistantError('unknown')
      } catch (error) {
        if (aborter.signal.aborted) {
          dispatch({ type: 'reset' })
          return null
        }
        dispatch({
          type: 'error',
          problem: error instanceof AssistantError ? error.problem : 'unknown',
        })
        return null
      } finally {
        void queryClient.invalidateQueries({ queryKey: assistantKeys.conversations })
        void queryClient.invalidateQueries({ queryKey: assistantKeys.quota })
        if (landed) {
          void queryClient.invalidateQueries({ queryKey: assistantKeys.messages(landed) })
        }
      }

      return { conversationId: landed }
    },
    [queryClient],
  )

  const stop = useCallback(() => controller.current?.abort(), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return { ...state, ask, stop, reset }
}
