import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  desktopNotificationsGranted,
  isDesktop,
  requestDesktopNotifications,
} from '@/lib/platform'

/**
 * P7-03 — native notifications, per computer. The desktop counterpart of
 * `push.ts`: the OS holds the permission, the app only asks and reads.
 */
export const desktopKeys = {
  permission: ['notifications', 'desktop-permission'] as const,
}

export function useDesktopNotificationState() {
  return useQuery({
    queryKey: desktopKeys.permission,
    enabled: isDesktop(),
    queryFn: desktopNotificationsGranted,
  })
}

/** Must run from a click: the OS prompt is only shown for a gesture. */
export function useEnableDesktopNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const permission = await requestDesktopNotifications()
      if (permission !== 'granted') throw new Error(permission)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: desktopKeys.permission }),
  })
}
