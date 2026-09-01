import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './auth-context'

/**
 * Route guard. Renders nothing while the session is still being restored, and
 * sends signed-out users to the login screen, remembering where they were
 * heading so P1-07 can return them there after sign-in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return null
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
