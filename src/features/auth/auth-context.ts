import type { Session, User } from '@supabase/supabase-js'
import { createContext, use } from 'react'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

export type AuthState = {
  status: AuthStatus
  session: Session | null
  user: User | null
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const state = use(AuthContext)
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>')
  return state
}
