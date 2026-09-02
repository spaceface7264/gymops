import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/features/auth'
import { supabase } from '@/lib/supabase'
import { notificationKeys } from './queries'

/**
 * The badge without a reload. One private channel per person
 * (`notifications:<uid>`, authorised by `can_listen_to_notifications()`), and
 * an insert only says "something arrived" — the count and the list refetch
 * rather than being patched, as on the checklist screen (P4-04).
 */
export function useNotificationStream() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notifications:${user.id}`, { config: { private: true } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
      )
      .subscribe()

    return () => void supabase.removeChannel(channel)
  }, [user, queryClient])
}
