import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type NotificationRow = Database['public']['Tables']['notifications']['Row']
type PrefRow = Database['public']['Tables']['notification_prefs']['Row']

export type NotificationType = Database['public']['Enums']['notification_type']

/** The enum's own order, which is the order the preferences screen lists. */
export const notificationTypes: NotificationType[] = [
  'incident_reported',
  'incident_status_changed',
  'ack_reminder',
  'invite',
  'chat_mention',
  'chat_dm',
  'chat_reply',
  'chat_reaction',
]

export type NotificationChannel = 'in_app' | 'email' | 'push'

export const notificationChannels: NotificationChannel[] = ['in_app', 'email', 'push']

export type Notification = Pick<
  NotificationRow,
  'id' | 'type' | 'title' | 'body' | 'url' | 'gym_id' | 'data' | 'created_at' | 'read_at'
>

export type NotificationPref = Pick<PrefRow, 'type' | 'in_app' | 'email' | 'push'>

/** No row means every channel is on — the same default `notification_pref()`
 *  applies in the database (P5-01), so the screen and the sender agree. */
export const defaultPref = (type: NotificationType): NotificationPref => ({
  type,
  in_app: true,
  email: true,
  push: true,
})

const notificationColumns =
  'id, type, title, body, url, gym_id, data, created_at, read_at'

/** How far back the inbox reads. Older than this and it is history, not news. */
const INBOX_DAYS = 30

export const notificationKeys = {
  all: ['notifications'] as const,
  inbox: ['notifications', 'inbox'] as const,
  prefs: ['notifications', 'prefs'] as const,
}

const since = () => new Date(Date.now() - INBOX_DAYS * 24 * 60 * 60 * 1000).toISOString()

/** The last 30 days of this person's inbox. RLS already limits it to them. */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.inbox,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(notificationColumns)
        .gte('created_at', since())
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data
    },
  })
}

/**
 * The badge. A count rather than the list, so the shell does not carry the
 * whole inbox on every screen, and unbounded by date — something unread from
 * six weeks ago is still unread.
 */
export function useUnreadCount() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...notificationKeys.all, 'unread'],
    enabled: Boolean(user),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)

      if (error) throw error
      return count ?? 0
    },
  })
}

function useInboxWrite<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

/** `read_at` is the only column the guard lets a recipient move (P5-01). */
export function useMarkRead() {
  return useInboxWrite(async ({ id, read }: { id: string; read: boolean }) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: read ? new Date().toISOString() : null })
      .eq('id', id)

    if (error) throw error
  })
}

export function useMarkAllRead() {
  return useInboxWrite(async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)

    if (error) throw error
  })
}

/** Only the types this person has actually changed; the rest are defaults. */
export async function fetchNotificationPrefs(): Promise<NotificationPref[]> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('type, in_app, email, push')

  if (error) throw error
  return data
}

export function useNotificationPrefs() {
  return useQuery({ queryKey: notificationKeys.prefs, queryFn: fetchNotificationPrefs })
}

/**
 * Writes the whole row for one type, defaults included: the table is sparse,
 * so the first change to any channel has to materialise the other two.
 */
export function useSetNotificationPref() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (pref: NotificationPref) => {
      if (!user) throw new Error('not signed in')

      const { error } = await supabase
        .from('notification_prefs')
        .upsert({ user_id: user.id, ...pref }, { onConflict: 'user_id,type' })

      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.prefs }),
  })
}
