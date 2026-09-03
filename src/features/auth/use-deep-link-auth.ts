import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { onDeepLink } from '@/lib/platform'
import { authCallbackRoute } from './deep-link'

/**
 * Routes the desktop app to its callback screen when an auth mail link opens
 * it (P7-02). Mounted once, above every route; a no-op on the web.
 */
export function useDeepLinkAuth() {
  const navigate = useNavigate()

  useEffect(
    () =>
      onDeepLink((url) => {
        const route = authCallbackRoute(url)
        if (route) void navigate(route, { replace: true })
      }),
    [navigate],
  )
}
