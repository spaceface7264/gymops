import { defineConfig, devices } from '@playwright/test'

/**
 * P5-06 — the three flows that must never break, driven in a real browser.
 *
 * They run against the **local stack** and its seed users, so `supabase start`
 * has to be up: these tests are about the whole path — RLS, PostgREST, the
 * router, the forms — which is exactly what a mocked test cannot cover.
 *
 * Two projects for one browser. `chromium` is Playwright's own build and is
 * what CI runs; `chrome` drives the Google Chrome already installed on the
 * machine, for a laptop that has no room for a second copy of it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
