import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

/**
 * `src/lib/supabase.ts` refuses to build a client without these, which is the
 * right behaviour in the app and the wrong one in a test run: a fresh clone —
 * and every CI runner — has no `.env.local`, so importing anything that
 * reaches the client threw before a single assertion ran. Tests mock the
 * client itself; these values only have to exist.
 */
vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key')

afterEach(() => {
  cleanup()
})
