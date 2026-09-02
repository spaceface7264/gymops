import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseAuthCallback } from './url-callback'

export type UrlSessionStatus = 'none' | 'adopting' | 'failed'

/**
 * Picks up the session an implicit auth link leaves in the URL fragment and
 * hands it to the Supabase client, then strips the tokens from the address bar
 * so they never reach the browser history.
 *
 * The client itself only reads PKCE links (`?code=`); it refuses an implicit
 * fragment while `flowType: 'pkce'`, which is exactly what admin-issued invite
 * mails send. Without this the invite screen would fall back to whatever
 * session the browser already had — possibly a different user's.
 */
export function useUrlSession(): UrlSessionStatus {
  // Read once, on the first render: the effect below strips the tokens from
  // the URL, so a later re-read would find nothing.
  const [callback] = useState(() => parseAuthCallback(window.location.href))
  const [status, setStatus] = useState<UrlSessionStatus>(() => {
    if (callback?.kind === 'session') return 'adopting'
    if (callback?.kind === 'error') return 'failed'
    return 'none'
  })

  useEffect(() => {
    if (callback?.kind !== 'session') return
    let active = true

    void supabase.auth
      .setSession({
        access_token: callback.accessToken,
        refresh_token: callback.refreshToken,
      })
      .then(({ error }) => {
        window.history.replaceState(null, '', window.location.pathname)
        if (active) setStatus(error ? 'failed' : 'none')
      })

    return () => {
      active = false
    }
  }, [callback])

  return status
}
