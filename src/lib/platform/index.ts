import { isTauri } from '@tauri-apps/api/core'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

/**
 * Where the app is running (P7-01). The web build and the desktop shell are
 * the same bundle; what differs — the service worker and web push on the web,
 * native notifications and deep links on the desktop — asks here rather than
 * probing for Tauri itself. This folder is the only place that may import
 * `@tauri-apps/*` (enforced in `eslint.config.js`).
 */
export function isDesktop(): boolean {
  return isTauri()
}

/**
 * Calls `handler` with every `gymops://` URL the desktop app is opened with —
 * the one it was launched by, and each one that arrives while it runs (P7-02).
 * On the web nothing ever arrives. Returns the unsubscribe.
 */
export function onDeepLink(handler: (url: string) => void): () => void {
  if (!isDesktop()) return () => {}

  let active = true
  let unlisten: (() => void) | undefined
  void onOpenUrl((urls) => {
    if (active) urls.forEach(handler)
  }).then((stop) => {
    if (active) unlisten = stop
    else stop()
  })

  return () => {
    active = false
    unlisten?.()
  }
}

/**
 * Native notifications (P7-03). The desktop has no service worker and no web
 * push; what `notify` would push at a phone, the app shows itself from the
 * Realtime stream. The OS owns the permission — once refused, it is turned
 * back on in system settings, not here.
 */
export type DesktopPermission = 'granted' | 'denied' | 'default'

export async function desktopNotificationsGranted(): Promise<boolean> {
  return isDesktop() && (await isPermissionGranted())
}

export async function requestDesktopNotifications(): Promise<DesktopPermission> {
  if (!isDesktop()) return 'denied'
  return requestPermission()
}

export function showDesktopNotification(options: { title: string; body: string }): void {
  sendNotification(options)
}
