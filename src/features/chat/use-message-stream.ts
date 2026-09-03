import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { chatKeys } from './queries'

/**
 * The channel without a reload. One private topic per channel
 * (`chat:<channel id>`, authorised by `can_listen_to_chat()`), and the event
 * only says something changed — the list refetches rather than being patched,
 * as on the checklist screen (P4-04) and the notification badge (P5-04). An
 * edit and a delete are both UPDATEs, so both are covered.
 */
export function useMessageStream(channelId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${channelId}`, { config: { private: true } })
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
          // The badge on every other channel row is counted server-side.
          void queryClient.invalidateQueries({ queryKey: chatKeys.overview })
        },
      )
      .subscribe()

    return () => void supabase.removeChannel(channel)
  }, [channelId, queryClient])
}
