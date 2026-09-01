import { createBrowserRouter } from 'react-router'
import { GymsPanel, UsersPanel } from '@/features/admin'
import { RequireAuth } from '@/features/auth'
import { GymProvider } from '@/features/gyms'
import { AcceptInvitePage } from '@/routes/accept-invite-page'
import { AdminPage, RequireSuperadmin } from '@/routes/admin-page'
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
 * app shell; modules whose phase has not landed render a
 * placeholder, so a nav entry without a `phase` must have a route here.
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
      {
        path: 'admin',
        element: <AdminPage />,
        children: [
          { path: 'users', element: <UsersPanel /> },
          {
            path: 'gyms',
            element: (
              <RequireSuperadmin>
                <GymsPanel />
              </RequireSuperadmin>
            ),
          },
        ],
      },
      ...navEntries
        .filter((entry) => entry.phase)
        .map((entry) => ({
          path: entry.to.slice(1),
          element: <ModulePlaceholder entry={entry} />,
        })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
