import { describe, expect, it } from 'vitest'
import { authCallbackRoute } from './deep-link'

describe('authCallbackRoute', () => {
  it('keeps a recovery code', () => {
    expect(authCallbackRoute('gymops://auth/callback?code=abc')).toBe(
      '/auth/callback?code=abc',
    )
  })

  it('keeps an invite fragment', () => {
    expect(
      authCallbackRoute(
        'gymops://auth/callback#access_token=a&refresh_token=b&type=invite',
      ),
    ).toBe('/auth/callback#access_token=a&refresh_token=b&type=invite')
  })

  it('ignores anything that is not the auth callback', () => {
    expect(authCallbackRoute('gymops://news/1')).toBeNull()
    expect(authCallbackRoute('gymops://auth/other')).toBeNull()
    expect(authCallbackRoute('https://gymops.dk/auth/callback?code=abc')).toBeNull()
    expect(authCallbackRoute('not a url')).toBeNull()
  })
})
