import { describe, expect, it } from 'vitest'
import { checkPassword } from '@/features/auth'

/**
 * The rule mirrors `[auth] minimum_password_length` and `password_requirements`
 * in supabase/config.toml: GoTrue rejects anything weaker, and it does so with
 * an English server message the user should never have to see.
 */
describe('checkPassword', () => {
  it('accepts a password that satisfies the server policy', () => {
    expect(checkPassword('Bouldering1', 'Bouldering1')).toBeNull()
  })

  it('rejects a password shorter than ten characters', () => {
    expect(checkPassword('Boulder1', 'Boulder1')).toBe('passwordPolicy')
  })

  it('rejects a password without an uppercase letter', () => {
    expect(checkPassword('boulderings1', 'boulderings1')).toBe('passwordPolicy')
  })

  it('rejects a password without a lowercase letter', () => {
    expect(checkPassword('BOULDERINGS1', 'BOULDERINGS1')).toBe('passwordPolicy')
  })

  it('rejects a password without a digit', () => {
    expect(checkPassword('Boulderings', 'Boulderings')).toBe('passwordPolicy')
  })

  it('rejects two valid passwords that differ', () => {
    expect(checkPassword('Bouldering1', 'Bouldering2')).toBe('passwordMismatch')
  })
})
