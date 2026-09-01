import { describe, expect, it } from 'vitest'
import { parseAuthCallback } from '@/features/auth'

/**
 * Invite mails are issued server-side, where no PKCE verifier exists, so their
 * link comes back as an implicit hash fragment. auth-js refuses to read one
 * while `flowType: 'pkce'`, so the screens have to pick it up themselves.
 */
describe('parseAuthCallback', () => {
  it('reads the tokens an implicit invite link carries', () => {
    expect(
      parseAuthCallback(
        'http://localhost:5173/accept-invite#access_token=a-token&refresh_token=a-refresh&type=invite',
      ),
    ).toEqual({ kind: 'session', accessToken: 'a-token', refreshToken: 'a-refresh' })
  })

  it('reports an expired link from the hash', () => {
    expect(
      parseAuthCallback(
        'http://localhost:5173/accept-invite#error=access_denied&error_code=otp_expired',
      ),
    ).toEqual({ kind: 'error', code: 'otp_expired' })
  })

  it('reports an expired link from the query string', () => {
    expect(
      parseAuthCallback('http://localhost:5173/reset-password?error_code=otp_expired'),
    ).toEqual({ kind: 'error', code: 'otp_expired' })
  })

  it('ignores a PKCE link, which the Supabase client handles itself', () => {
    expect(
      parseAuthCallback('http://localhost:5173/reset-password?code=a-code'),
    ).toBeNull()
  })

  it('ignores a plain URL', () => {
    expect(parseAuthCallback('http://localhost:5173/accept-invite')).toBeNull()
  })

  it('ignores a hash that carries no refresh token', () => {
    expect(
      parseAuthCallback('http://localhost:5173/accept-invite#access_token=a-token'),
    ).toBeNull()
  })
})
