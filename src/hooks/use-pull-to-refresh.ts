import { useCallback, useEffect, useRef, useState } from 'react'

export type PullState = 'idle' | 'pulling' | 'armed' | 'refreshing'

/** Where the disc docks and the release commits; 64 px of disc is ~140 px of thumb. */
export const ARM_AT = 64
const MAX_PULL = 96
/** Finger distance over which the pull loses most of its give. */
const GIVE = 128
/** Shown at least this long, so a fast refetch does not blink. */
const MIN_SHOWN_MS = 400
/** How long "Refreshed" stays announced after the disc has gone. */
const DONE_MS = 1500

/**
 * The phone's pull-down-to-reload gesture on a page the document scrolls.
 * Armed only when the page is at the top at `touchstart` and the finger is not
 * inside a dialog or sheet; passive listeners, so the page is never kept from
 * scrolling. Renders nothing: `pull`, `state` and `done` drive `PullIndicator`,
 * and `refresh()` runs the same reload from a button.
 */
export function usePullToRefresh({
  enabled,
  onRefresh,
}: {
  enabled: boolean
  onRefresh: () => Promise<unknown>
}): { pull: number; state: PullState; done: boolean; refresh: () => void } {
  const [pull, setPull] = useState(0)
  const [state, setState] = useState<PullState>('idle')
  const [done, setDone] = useState(false)
  const startY = useRef<number | null>(null)
  const refreshing = useRef(false)
  const refresh = useRef(onRefresh)
  // The end handler reads the latest pull without re-binding the listeners.
  const pullRef = useRef(0)

  useEffect(() => {
    refresh.current = onRefresh
  }, [onRefresh])

  const commit = useCallback(() => {
    if (refreshing.current) return
    refreshing.current = true
    setDone(false)
    setState('refreshing')
    setPull(ARM_AT)
    const shown = new Promise((resolve) => setTimeout(resolve, MIN_SHOWN_MS))
    void Promise.allSettled([refresh.current(), shown]).then(() => {
      refreshing.current = false
      pullRef.current = 0
      setPull(0)
      setState('idle')
      setDone(true)
      setTimeout(() => setDone(false), DONE_MS)
    })
  }, [])

  useEffect(() => {
    if (!enabled) return

    const atTop = () =>
      (document.scrollingElement ?? document.documentElement).scrollTop <= 0
    // A sheet or dialog locks the page at the top; a drag inside it is its own.
    const inDialog = (target: EventTarget | null) =>
      target instanceof Element && target.closest('[role="dialog"]') !== null

    const reset = () => {
      startY.current = null
      pullRef.current = 0
      setPull(0)
      setState('idle')
    }

    const onStart = (event: TouchEvent) => {
      const finger = event.touches[0]
      if (refreshing.current || event.touches.length !== 1 || !finger) return
      if (!atTop() || inDialog(event.target)) return
      startY.current = finger.clientY
    }

    const onMove = (event: TouchEvent) => {
      if (startY.current === null) return
      const finger = event.touches[0]
      if (event.touches.length !== 1 || !finger || !atTop()) return reset()
      const delta = finger.clientY - startY.current
      if (delta <= 0) return reset()
      // Rubber: the disc approaches the cap and never hits it.
      const next = MAX_PULL * (1 - Math.exp(-delta / GIVE))
      pullRef.current = next
      setPull(next)
      setState(next >= ARM_AT ? 'armed' : 'pulling')
    }

    const onEnd = () => {
      if (startY.current === null) return
      const armed = pullRef.current >= ARM_AT
      startY.current = null
      if (armed) commit()
      else reset()
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled, commit])

  return { pull, state, done, refresh: commit }
}
