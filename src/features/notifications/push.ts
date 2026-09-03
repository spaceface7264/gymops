import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { supabase } from '@/lib/supabase'

/**
 * P5-05 — web push, per browser.
 *
 * A subscription belongs to one browser on one device, not to the account, so
 * everything here reads `navigator` first and the table second: the row exists
 * to tell `notify` where to send (P5-03), and the browser is the authority on
 * whether it is still valid.
 */

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

/** Push needs a service worker, the Push API and the Notification API. iOS has
 *  all three only once the app has been added to the Home Screen. */
export const pushSupported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window

export const pushConfigured = () => vapidPublicKey.length > 0

/** VAPID keys travel as base64url; `applicationServerKey` wants the bytes. */
function applicationServerKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export const pushKeys = {
  subscription: ['notifications', 'push-subscription'] as const,
}

export type PushState = {
  /** Whether this browser is subscribed right now. */
  subscribed: boolean
  /** `default`, `granted` or `denied` — `denied` cannot be undone from here. */
  permission: NotificationPermission
}

export function usePushState() {
  return useQuery<PushState>({
    queryKey: pushKeys.subscription,
    enabled: pushSupported(),
    queryFn: async () => {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      return { subscribed: subscription !== null, permission: Notification.permission }
    },
  })
}

const subscriptionRow = (subscription: PushSubscription, userId: string) => {
  const json = subscription.toJSON()
  return {
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    user_agent: navigator.userAgent,
  }
}

/**
 * Asks for the permission and records the subscription. Must be called from a
 * user gesture: browsers refuse a permission prompt that nobody asked for, and
 * iOS refuses it outright outside an installed app.
 */
export function useEnablePush() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('not signed in')
      if (!pushConfigured()) throw new Error('no vapid key')

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error(permission)

      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(vapidPublicKey),
        }))

      // The endpoint is the key: the same browser re-subscribing after a
      // permission reset replaces its own row rather than adding a second.
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(subscriptionRow(subscription, user.id), { onConflict: 'endpoint' })

      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pushKeys.subscription }),
  })
}

/** Turning it off on this device: the browser forgets, and so does the table. */
export function useDisablePush() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return

      await subscription.unsubscribe()

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint)

      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pushKeys.subscription }),
  })
}
