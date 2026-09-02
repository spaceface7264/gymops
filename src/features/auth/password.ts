/**
 * Mirrors supabase/config.toml: `minimum_password_length = 10` and
 * `password_requirements = "lower_upper_letters_digits"`. GoTrue enforces it
 * server-side; checking here keeps its English error message off the screen.
 */
export const minPasswordLength = 10

export type PasswordProblem = 'passwordPolicy' | 'passwordMismatch'

/** The rule both the reset and the invite screen apply before calling Supabase. */
export function checkPassword(password: string, confirm: string): PasswordProblem | null {
  const meetsPolicy =
    password.length >= minPasswordLength &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)

  if (!meetsPolicy) return 'passwordPolicy'
  if (password !== confirm) return 'passwordMismatch'
  return null
}
