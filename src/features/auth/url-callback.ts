export type AuthCallback =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string }

/**
 * Reads what an auth mail link left in the URL.
 *
 * Recovery links are PKCE (`?code=`) and the Supabase client exchanges them on
 * its own. Invite links are issued by the admin API, which has no code
 * verifier, so they arrive as an implicit `#access_token=…` fragment — and
 * auth-js rejects those outright while the client runs `flowType: 'pkce'`.
 * Returns null for anything the client already handles.
 */
export function parseAuthCallback(href: string): AuthCallback | null {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const query = url.searchParams

  const errorCode = hash.get('error_code') ?? query.get('error_code')
  if (errorCode) return { kind: 'error', code: errorCode }

  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken }

  return null
}
