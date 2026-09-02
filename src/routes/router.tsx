import { createBrowserRouter } from 'react-router'
import { RequireAuth } from '@/features/auth'
import { GymProvider } from '@/features/gyms'
import { AcceptInvitePage } from '@/routes/accept-invite-page'
import { AppShell } from '@/routes/app-shell'
import { ForgotPasswordPage } from '@/routes/forgot-password-page'
import { HomePage } from '@/routes/home-page'
import { LoginPage } from '@/routes/login-page'
import { ModulePlaceholder } from '@/routes/module-placeholder'
import { navEntries } from '@/routes/nav'
import { NotFoundPage } from '@/routes/not-found-page'
import { ResetPasswordPage } from '@/routes/reset-password-page'

/**
 * Route table. Everything below `/` requires a session and renders inside the
 * app shell; modules whose phase has not landed render a placeholder, which
 * keeps this table and the nav (`nav.ts`) in step.
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
        <GymProvider>
          <AppShell />
        </GymProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      ...navEntries
        .filter((entry) => entry.to !== '/')
        .map((entry) => ({
          path: entry.to.slice(1),
          element: <ModulePlaceholder entry={entry} />,
        })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
