// P7D-08: screenshots of the screens the refinement touched, for
// docs/design/screens/. Not a test of behaviour; run on purpose with
//   E2E_SCREENS=1 E2E_BASE_URL=http://localhost:5174 npx playwright test --project=chrome e2e/screens.spec.ts
import { test, type Page } from '@playwright/test'
import { rest, seedUsers, signIn } from './fixtures'

const widths = [390, 768, 1280]
const locales = ['en', 'da'] as const
const screens: { name: string; path: string; user: keyof typeof seedUsers }[] = [
  { name: 'checklists', path: '/checklists', user: 'staff' },
  { name: 'incidents', path: '/incidents', user: 'manager' },
  { name: 'admin', path: '/admin/users', user: 'manager' },
  { name: 'events', path: '/events', user: 'manager' },
  { name: 'daily-log', path: '/daily-log', user: 'staff' },
]

async function setLocale(email: string, locale: string) {
  await rest(`profiles?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify({ locale }),
  })
}

async function shoot(page: Page, name: string, width: number, locale: string) {
  await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
  await page.waitForTimeout(400)
  await page.screenshot({
    path: `docs/design/screens/${name}-${width}-${locale}.png`,
    fullPage: false,
  })
}

for (const locale of locales) {
  test(`screens in ${locale}`, async ({ page }) => {
    test.setTimeout(180_000)
    let signedInAs: string | null = null
    for (const screen of screens) {
      const user = seedUsers[screen.user]
      await setLocale(user.email, locale)
      if (signedInAs !== user.email) {
        if (signedInAs) {
          await page.context().clearCookies()
          await page.goto('/login')
          await page.evaluate(() => localStorage.clear())
        }
        await page.goto('/login')
        await page.getByLabel(locale === 'en' ? 'Email' : /E-mail|Email/).fill(user.email)
        await page
          .getByLabel(locale === 'en' ? 'Password' : /Adgangskode|Password/)
          .fill(user.password)
        await page
          .getByRole('button', { name: locale === 'en' ? 'Sign in' : /Log ind|Sign in/ })
          .click()
        await page.getByRole('navigation').waitFor()
        signedInAs = user.email
      }
      await page.goto(screen.path)
      await page.getByRole('main').waitFor()
      await page.waitForTimeout(600)
      for (const width of widths) await shoot(page, screen.name, width, locale)
    }
    await setLocale(seedUsers.staff.email, 'en')
    await setLocale(seedUsers.manager.email, 'en')
  })
}
void signIn
