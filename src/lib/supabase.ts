import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.',
  )
}

/**
 * The one Supabase client. Feature `queries.ts` hooks use it; components never
 * import it (spec §5).
 *
 * PKCE is required because invite and password-reset links open in the browser
 * or, later, in the desktop app through a `gymops://` deep link (P7-02).
 */
export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
