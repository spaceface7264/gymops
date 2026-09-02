/**
 * A deactivated account is banned in GoTrue by the `profiles.active` trigger,
 * so sign-in comes back as `user_banned` rather than as bad credentials. Telling
 * the two apart is the difference between "try again" and "ask your manager".
 */
export function isDeactivatedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'user_banned'
  )
}
