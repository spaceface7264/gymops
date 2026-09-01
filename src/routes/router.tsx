import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/routes/home-page'
import { NotFoundPage } from '@/routes/not-found-page'
import { RootLayout } from '@/routes/root-layout'

/**
 * Route table. The real app shell (nav, gym switcher) arrives in P1-08 and
 * protected routes in P1-06.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
