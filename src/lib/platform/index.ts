import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrent } from '@tauri-apps/plugin-deep-link'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'

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
 * True when the web app runs from the Home Screen rather than a browser tab
 * (P9-10). The desktop shell is never "installed web": it has no Home Screen
 * to be added to. `display-mode: standalone` is the standard signal; the
 * `navigator.standalone` flag is what older iOS Safari sets instead.
 */
export function isInstalledWeb(): boolean {
  if (isDesktop()) return false
  const standalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return standalone || (navigator as { standalone?: boolean }).standalone === true
}

/**
 * Calls `handler` with every `gymops://` URL the desktop app is opened with —
 * the one it was launched by, and each one that arrives while it runs (P7-02).
 * On the web nothing ever arrives. Returns the unsubscribe.
 *
 * Not the plugin's `onOpenUrl`: that reads `getCurrent()` and only then
 * subscribes to the event, and on macOS a link that launches the app can land
 * in that gap and be lost. Subscribing first and reading `getCurrent()` after
 * closes it; a URL that then comes both ways is handled once.
 */
export function onDeepLink(handler: (url: string) => void): () => void {
  if (!isDesktop()) return () => {}

  let active = true
  let unlisten: (() => void) | undefined
  const seen = new Set<string>()
  const deliver = (urls: string[]) => {
    if (!active) return
    for (const url of urls) {
      if (seen.has(url)) continue
      seen.add(url)
      handler(url)
    }
  }

  void listen<string[]>('deep-link://new-url', (event) => deliver(event.payload)).then(
    (stop) => {
      if (!active) return stop()
      unlisten = stop
      return getCurrent().then((urls) => deliver(urls ?? []))
    },
  )

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

/**
 * The updater (P7-04). The feed is `latest.json` on the public releases
 * repository, signed with the key whose public half is in `tauri.conf.json`.
 * Returns what is waiting, or null; `install` downloads and installs it, and
 * the app has to be relaunched to run it.
 */
export type PendingUpdate = { version: string; install: () => Promise<void> }

export async function checkForUpdate(): Promise<PendingUpdate | null> {
  if (!isDesktop()) return null
  const update = await check()
  if (!update) return null
  return { version: update.version, install: () => update.downloadAndInstall() }
}

export function relaunchApp(): Promise<void> {
  return relaunch()
}
