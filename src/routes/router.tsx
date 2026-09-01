import { createBrowserRouter } from 'react-router'
import { RequireAuth } from '@/features/auth'
import { AcceptInvitePage } from '@/routes/accept-invite-page'
import { ForgotPasswordPage } from '@/routes/forgot-password-page'
import { HomePage } from '@/routes/home-page'
import { LoginPage } from '@/routes/login-page'
import { NotFoundPage } from '@/routes/not-found-page'
import { ResetPasswordPage } from '@/routes/reset-password-page'
import { RootLayout } from '@/routes/root-layout'

/**
 * Route table. Everything below `/` requires a session; the real app shell
 * (nav, gym switcher) replaces RootLayout in P1-08.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/accept-invite', element: <AcceptInvitePage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RootLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
