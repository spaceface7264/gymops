import { expect, type Page } from '@playwright/test'

/**
 * The local stack, its seed users, and the few rows a flow needs but cannot
 * create through the UI.
 *
 * These talk to PostgREST with `fetch` rather than through `supabase-js`: the
 * client opens a Realtime connection the moment it is created, and Node 20 has
 * no native WebSocket (CLAUDE.md). Nothing here needs more than three verbs.
 *
 * The key below is the local demo service role key every Supabase installation
 * prints; these tests only ever run against `supabase start`, and spec §5 keeps
 * real keys out of the repo entirely.
 */
const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  'content-type': 'application/json',
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  })

  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${await response.text()}`)
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

const insert = <T>(table: string, rows: unknown) =>
  rest<T>(table, {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })

export const seedUsers = {
  manager: { email: 'manager@gymops.test', password: 'Password123' },
  staff: { email: 'staff@gymops.test', password: 'Password123' },
}

/** The app is bilingual and follows `profiles.locale`; the assertions read
 *  English, so each test pins the seed user's language first. */
export async function useEnglish(email: string) {
  await rest(`profiles?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify({ locale: 'en' }),
  })
}

export async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('navigation')).toBeVisible()
}

/**
 * The gym somebody actually works in. Not "the first gym": a run created in a
 * gym the signed-in user is not a member of is invisible to them, and the test
 * would fail on RLS doing its job.
 */
export async function gymOf(email: string) {
  const memberships = await rest<
    { gyms: { id: string; name: string; timezone: string } }[]
  >(
    `gym_memberships?select=gyms(id,name,timezone),profiles!inner(email)` +
      `&profiles.email=eq.${encodeURIComponent(email)}&limit=1`,
  )
  const gym = memberships[0]?.gyms
  if (!gym) throw new Error(`${email} works in no gym; run \`npm run db:reset\``)
  return gym
}

/**
 * Today's checklist run for one gym, built the way pg_cron would build it at
 * 03:00 gym-local (P4-02) — a test cannot wait for the job, and
 * `generate_checklist_runs()` is revoked from every client role.
 */
export async function checklistRunForToday(gymId: string, timezone: string) {
  const runDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
    new Date(),
  )

  const [template] = await insert<{ id: string }[]>('checklist_templates', {
    gym_id: gymId,
    kind: 'opening',
    name: `E2E opening ${Date.now()}`,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
  })
  if (!template) throw new Error('the checklist template was not created')

  const items = await insert<
    { id: string; position: number; label: string; required: boolean }[]
  >('checklist_template_items', [
    {
      template_id: template.id,
      position: 1,
      label: 'Unlock the front door',
      required: true,
    },
    { template_id: template.id, position: 2, label: 'Sweep the mats', required: false },
  ])

  const [run] = await insert<{ id: string }[]>('checklist_runs', {
    template_id: template.id,
    gym_id: gymId,
    run_date: runDate,
  })
  if (!run) throw new Error('the checklist run was not created')

  await insert(
    'checklist_run_items',
    items.map((item) => ({
      run_id: run.id,
      template_item_id: item.id,
      position: item.position,
      label: item.label,
      required: item.required,
    })),
  )

  return { templateId: template.id, runDate }
}

export async function notificationsTitled(title: string) {
  return rest<{ type: string; url: string | null; user_id: string }[]>(
    `notifications?select=type,url,user_id&title=eq.${encodeURIComponent(title)}`,
  )
}

/**
 * Leaves the database as the suite found it. The run has to go first:
 * `checklist_runs.template_id` is `on delete restrict` (P4-01), so a template
 * that has ever been run cannot be deleted out from under its history. Run
 * items cascade from the run.
 */
export async function removeTemplate(templateId: string) {
  await rest(`checklist_runs?template_id=eq.${templateId}`, { method: 'DELETE' })
  await rest(`checklist_templates?id=eq.${templateId}`, { method: 'DELETE' })
}
