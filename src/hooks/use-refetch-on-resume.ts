import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

/**
 * A PWA brought back from the Home Screen shows whatever was on screen when it
 * was put away. When the document becomes visible again, every active query
 * that has gone stale refetches once; a tab switch within `staleTime` costs
 * nothing. Distinct from `refetchOnWindowFocus`, which some browsers fire on
 * every click into the window.
 */
export function useRefetchOnResume() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState !== 'visible') return
      void queryClient.refetchQueries({ type: 'active', stale: true })
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [queryClient])
}
