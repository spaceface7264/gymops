import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthStatus } from './auth-context'

/**
 * Holds the Supabase session for the app: restores it on load and follows sign
 * in, sign out and token refresh. Until the first `getSession()` resolves the
 * status is `loading`, so guards do not bounce a signed-in user to the login
 * screen on a hard refresh.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'signedIn' : 'signedOut')
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setStatus(nextSession ? 'signedIn' : 'signedOut')
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({ status, session, user: session?.user ?? null }),
    [status, session],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
