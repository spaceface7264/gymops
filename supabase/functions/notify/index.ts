// P5-03 — the fan-out. One notification row in, a web push and an email out.
//
// A database webhook (`20260902...._notification_dispatch.sql`) posts every new
// `notifications` row here. Nothing else may call it: the request must carry
// the service role key, because the payload names a recipient and this function
// then acts on their behalf.
//
// Both channels are optional and each is decided by the recipient's own
// preferences (P5-01). Where a secret is missing — no VAPID pair, no Resend key
// — that channel is reported as `skipped` rather than failing the request, so
// the whole path can be exercised on the local stack, where neither exists.
//
// Deployment and the secrets this depends on: PROJECT_STATE.md, "Hosted
// project cutover".
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { Database } from '../../../src/lib/database.types.ts'

type Notification = Database['public']['Tables']['notifications']['Row']
type NotificationType = Database['public']['Enums']['notification_type']
type Locale = 'en' | 'da'

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Notification | null
}

/** What the notification *is*, in the recipient's language. The row itself
 *  carries the author's own words, which nobody translates (P5-02). */
const HEADINGS: Record<Locale, Record<NotificationType, string>> = {
  en: {
    incident_reported: 'New incident',
    incident_status_changed: 'Incident updated',
    ack_reminder: 'Still to confirm',
    invite: 'Invitation accepted',
  },
  da: {
    incident_reported: 'Ny hændelse',
    incident_status_changed: 'Hændelse opdateret',
    ack_reminder: 'Mangler bekræftelse',
    invite: 'Invitation accepteret',
  },
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const env = (name: string) => Deno.env.get(name) ?? ''

function parse(body: unknown): Notification | null {
  const payload = body as WebhookPayload | null
  if (!payload || payload.type !== 'INSERT' || payload.table !== 'notifications') {
    return null
  }
  const record = payload.record
  return record && record.id && record.user_id && record.type ? record : null
}

async function sendPush(
  service: ReturnType<typeof createClient<Database>>,
  notification: Notification,
  heading: string,
): Promise<number | 'skipped'> {
  const publicKey = env('VAPID_PUBLIC_KEY')
  const privateKey = env('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return 'skipped'

  const { data: subscriptions } = await service
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notification.user_id)

  if (!subscriptions?.length) return 0

  webpush.setVapidDetails(
    env('VAPID_SUBJECT') || 'mailto:ops@gymops.dk',
    publicKey,
    privateKey,
  )

  const payload = JSON.stringify({
    heading,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    id: notification.id,
  })

  let sent = 0
  const gone: string[] = []

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      )
      sent += 1
    } catch (error) {
      // 404/410 is the push service saying this browser is gone for good —
      // the subscription will never work again, so it goes.
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) gone.push(subscription.id)
      else console.error('push failed', subscription.id, status, String(error))
    }
  }

  if (gone.length) await service.from('push_subscriptions').delete().in('id', gone)
  if (sent) {
    await service
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .in(
        'id',
        subscriptions.filter((s) => !gone.includes(s.id)).map((s) => s.id),
      )
  }

  return sent
}

async function sendEmail(
  notification: Notification,
  heading: string,
  address: string,
): Promise<'sent' | 'skipped' | 'failed'> {
  const key = env('RESEND_API_KEY')
  if (!key) return 'skipped'

  const siteUrl = env('SITE_URL') || 'http://localhost:5173'
  const link = notification.url ? `${siteUrl}${notification.url}` : siteUrl
  const body = notification.body ? `<p>${escapeHtml(notification.body)}</p>` : ''

  // A channel that is down must not take the request with it: the inbox row
  // already exists, and a push may well have gone out a line earlier.
  try {
    const response = await fetch(
      `${env('RESEND_API_URL') || 'https://api.resend.com'}/emails`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: env('NOTIFY_FROM') || 'GymOps <notifications@gymops.dk>',
          to: [address],
          subject: `${heading}: ${notification.title}`,
          html: `<h2>${escapeHtml(heading)}</h2>` +
            `<p><strong>${escapeHtml(notification.title)}</strong></p>` +
            body +
            `<p><a href="${link}">${link}</a></p>`,
        }),
      },
    )

    if (response.ok) return 'sent'
    console.error('email failed', response.status, await response.text())
  } catch (error) {
    console.error('email failed', String(error))
  }

  return 'failed'
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ] ??
        character,
  )

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // The webhook is the only caller, and it carries the service role key. A
  // notification names somebody else's inbox, so nothing weaker will do.
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || token !== env('SUPABASE_SERVICE_ROLE_KEY')) {
    return json({ error: 'unauthenticated' }, 401)
  }

  const notification = parse(await request.json().catch(() => null))
  if (!notification) return json({ error: 'invalid_request' }, 400)

  const service = createClient<Database>(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false },
    },
  )

  const { data: recipient } = await service
    .from('profiles')
    .select('email, locale, active')
    .eq('id', notification.user_id)
    .single()

  if (!recipient?.active) return json({ push: 'skipped', email: 'skipped' }, 200)

  const { data: prefs } = await service
    .rpc('notification_pref', {
      target_user: notification.user_id,
      target_type: notification.type,
    })
    .single()

  const locale: Locale = recipient.locale === 'en' ? 'en' : 'da'
  const heading = HEADINGS[locale][notification.type]

  const push = prefs?.push === false
    ? 'skipped'
    : await sendPush(service, notification, heading)

  // `email_requested` is the event's own judgement (a high-severity incident);
  // the preference can only silence it, never ask for one (P5-01).
  const email = notification.email_requested && prefs?.email !== false
    ? await sendEmail(notification, heading, recipient.email)
    : 'skipped'

  return json({ push, email }, 200)
})
