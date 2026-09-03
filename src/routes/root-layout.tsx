import { Outlet } from 'react-router'
import { useDeepLinkAuth } from '@/features/auth'

/** Above every route: the one place a desktop deep link is listened for. */
export function RootLayout() {
  useDeepLinkAuth()
  return <Outlet />
}
