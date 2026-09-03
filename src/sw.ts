/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

/**
 * P5-05 — the service worker.
 *
 * Two jobs. It precaches the built assets, so the app opens on a phone with a
 * bad signal in the stairwell; and it receives web push, which is the only
 * reason this is hand-written rather than generated (spec §3): a generated
 * worker has no `push` or `notificationclick` handler.
 *
 * The payload is what `notify` sends (P5-03): a translated heading, the
 * entity's own title and body, and the path to open.
 */
declare const self: ServiceWorkerGlobalScope

type PushPayload = {
  heading?: string
  title?: string
  body?: string | null
  url?: string | null
  id?: string
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', (event) => {
  let payload: PushPayload
  try {
    payload = (event.data?.json() ?? {}) as PushPayload
  } catch {
    // A push with no readable payload still deserves to be shown: something
    // happened, and the inbox has the detail.
    payload = { body: event.data?.text() }
  }

  const heading = payload.heading ?? 'GymOps'

  event.waitUntil(
    self.registration.showNotification(heading, {
      body: [payload.title, payload.body].filter(Boolean).join(' — '),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // One notification per subject replaces the previous one about it
      // rather than stacking; the phone is in a pocket mid-shift.
      tag: payload.id,
      data: { url: payload.url ?? '/notifications' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string }).url ?? '/notifications'

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Bring the open app to the front and take it there, rather than
      // opening a second copy of the same screen.
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus()
          await client.navigate(target)
          return
        }
      }

      await self.clients.openWindow(target)
    })(),
  )
})
