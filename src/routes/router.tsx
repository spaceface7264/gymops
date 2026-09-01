import { createBrowserRouter } from 'react-router'
import { RequireAuth } from '@/features/auth'
import { HomePage } from '@/routes/home-page'
import { LoginPage } from '@/routes/login-page'
import { NotFoundPage } from '@/routes/not-found-page'
import { RootLayout } from '@/routes/root-layout'

/**
 * Route table. Everything below `/` requires a session; the real app shell
 * (nav, gym switcher) replaces RootLayout in P1-08.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
