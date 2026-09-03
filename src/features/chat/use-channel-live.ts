import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '@/features/auth'
import { supabase } from '@/lib/supabase'
import { chatKeys } from './queries'

/** How long a keystroke keeps somebody on the "typing" list. */
const typingSeconds = 4

type TypingState = { name: string; typing_until: string }

/**
 * Everything live about one channel, over the one private topic
 * (`chat:<channel id>`): the messages, and who is typing.
 *
 * Both halves share a channel because they share a topic — a second
 * subscription to the same name would be a second socket for the same
 * permission. Postgres changes only say *that* something changed and the list
 * refetches, as on the checklist screen (P4-04); presence carries the names
 * themselves, since a typing indicator is not worth a row anywhere.
 */
export function useChannelLive(channelId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [entries, setEntries] = useState<TypingState[]>([])
  const channel = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const live = supabase
      .channel(`chat:${channelId}`, {
        config: { private: true, presence: { key: user?.id ?? 'anonymous' } },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: chatKeys.messages(channelId) })
          // Every other channel's badge is counted server-side.
          void queryClient.invalidateQueries({ queryKey: chatKeys.overview })
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = live.presenceState<TypingState>()

        const now = Date.now()

        setEntries(
          Object.entries(state)
            .filter(([id]) => id !== user?.id)
            .flatMap(([, presences]) => presences)
            .filter((entry) => new Date(entry.typing_until).getTime() > now),
        )
      })
      .subscribe()

    channel.current = live

    return () => {
      channel.current = null
      void supabase.removeChannel(live)
    }
  }, [channelId, user?.id, queryClient])

  // Presence only arrives when somebody's state *changes*, and "stopped
  // typing" is the absence of a change: without this the indicator hangs on
  // the last keystroke's window until the next sync, which may be minutes
  // away. The expired entries are dropped here instead, and the timer stops
  // when there are none left.
  useEffect(() => {
    if (entries.length === 0) return

    const timer = setInterval(() => {
      setEntries((current) => {
        const now = Date.now()
        const kept = current.filter(
          (entry) => new Date(entry.typing_until).getTime() > now,
        )
        return kept.length === current.length ? current : kept
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [entries])

  // Only unexpired entries are ever in state, so this stays a plain read.
  const typing = entries.map((entry) => entry.name)

  /**
   * Says this person is typing for the next few seconds. A window rather than
   * an on/off pair: a browser that closes mid-sentence never sends the "off",
   * and the indicator would hang there for everybody else until they reload.
   */
  const startTyping = useCallback((name: string) => {
    void channel.current?.track({
      name,
      typing_until: new Date(Date.now() + typingSeconds * 1000).toISOString(),
    })
  }, [])

  return { typing, startTyping }
}
