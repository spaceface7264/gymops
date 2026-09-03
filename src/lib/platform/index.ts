import { isTauri } from '@tauri-apps/api/core'

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
