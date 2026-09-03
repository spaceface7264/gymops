import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import {
  desktopNotificationsGranted,
  isDesktop,
  showDesktopNotification,
} from '@/lib/platform'
import { supabase } from '@/lib/supabase'
import { fetchNotificationPrefs, notificationKeys, type Notification } from './queries'

/**
 * The badge without a reload. One private channel per person
 * (`notifications:<uid>`, authorised by `can_listen_to_notifications()`), and
 * an insert only says "something arrived" — the count and the list refetch
 * rather than being patched, as on the checklist screen (P4-04).
 *
 * On the desktop the same insert is also shown natively (P7-03), framed the
 * way the service worker frames a push (P5-05): the kind as the heading, the
 * row's own title and body underneath. The per-type *push* switch applies, so
 * the preferences screen means the same thing on every device.
 */
export function useNotificationStream() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user) return

    async function announce(row: Pick<Notification, 'type' | 'title' | 'body'>) {
      const prefs = await queryClient.fetchQuery({
        queryKey: notificationKeys.prefs,
        queryFn: fetchNotificationPrefs,
        staleTime: 60_000,
      })
      if (!(prefs.find((pref) => pref.type === row.type)?.push ?? true)) return
      if (!(await desktopNotificationsGranted())) return
      showDesktopNotification({
        title: t(`notifications.type.${row.type}`),
        body: [row.title, row.body].filter(Boolean).join(' — '),
      })
    }

    const channel = supabase
      .channel(`notifications:${user.id}`, { config: { private: true } })
      .on<Notification>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
          if (isDesktop() && payload.new.type) void announce(payload.new)
        },
      )
      .subscribe()

    return () => void supabase.removeChannel(channel)
  }, [user, queryClient, t])
}
