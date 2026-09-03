/**
 * The in-app route for a `gymops://auth/callback` deep link, or null for any
 * other URL (P7-02). Whatever the auth server appended — a PKCE `?code=` from a
 * recovery mail, or an invite's `#access_token=…` fragment — travels along
 * unchanged, and the callback screen reads it the way it reads a browser URL.
 */
export function authCallbackRoute(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (
    parsed.protocol !== 'gymops:' ||
    parsed.host !== 'auth' ||
    parsed.pathname !== '/callback'
  ) {
    return null
  }
  return `/auth/callback${parsed.search}${parsed.hash}`
}
