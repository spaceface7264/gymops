import { expect, test } from '@playwright/test'
import {
  checklistRunForToday,
  gymOf,
  notificationsTitled,
  removeTemplate,
  seedUsers,
  signIn,
  useEnglish,
} from './fixtures'

/**
 * P5-06 — the three flows a shift cannot do without: getting in, working a
 * checklist, and reporting what went wrong. Everything else has unit tests and
 * pgTAP; these are here because they cross every layer at once.
 */

test.beforeEach(async () => {
  await useEnglish(seedUsers.manager.email)
  await useEnglish(seedUsers.staff.email)
})

test('signing in, and staying signed in across a reload', async ({ page }) => {
  await page.goto('/checklists')
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page, seedUsers.staff)
  await expect(page.getByRole('link', { name: 'Checklists' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: 'Checklists' })).toBeVisible()
})

test('a wrong password says so and lets nobody in', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(seedUsers.staff.email)
  await page.getByLabel('Password').fill('WrongPassword123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('ticking off a checklist item', async ({ page }) => {
  const gym = await gymOf(seedUsers.staff.email)
  const { templateId } = await checklistRunForToday(gym.id, gym.timezone)

  try {
    await signIn(page, seedUsers.staff)
    await page.goto('/checklists')

    const item = page.getByRole('checkbox', { name: /Unlock the front door/ })
    await expect(item).toBeVisible()
    await expect(item).not.toBeChecked()

    // `check()` re-reads the state the moment it has clicked, and this box is
    // controlled by the round trip and disabled while it is in flight.
    await item.click()
    await expect(item).toBeChecked()

    // It is a tick in the database, not only on the screen.
    await page.reload()
    await expect(
      page.getByRole('checkbox', { name: /Unlock the front door/ }),
    ).toBeChecked()
  } finally {
    await removeTemplate(templateId)
  }
})

// The incident is left behind on purpose: nothing may delete one (spec §2.5),
// and a dated title keeps each run's row identifiable in a local database.
test('reporting an incident, and the notification it raises', async ({ page }) => {
  const title = `Fall from wall ${Date.now()}`

  await signIn(page, seedUsers.staff)
  await page.goto('/incidents/new')

  await page.getByLabel('Title').fill(title)
  await page.getByLabel('What happened').fill('Member landed badly, ice applied.')
  await page.getByRole('button', { name: 'Report' }).click()

  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // P5-02: the gym's managers are told, by a trigger, not by the client.
  const notifications = await notificationsTitled(title)
  expect(notifications.length).toBeGreaterThan(0)
  expect(notifications.map((row) => row.type)).toContain('incident_reported')
})
