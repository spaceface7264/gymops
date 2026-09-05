import { useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept current. Used where the *DOM* has to
 * differ between a phone and a desktop, not just the styling: a component
 * that may exist only once (the notification bell holds a Realtime
 * subscription) cannot be rendered twice and hidden with CSS.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () =>
      typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false,
    () => false,
  )
}

/** Below Tailwind's `md` (768 px): the phone layout with the bottom bar. */
export function usePhone(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
