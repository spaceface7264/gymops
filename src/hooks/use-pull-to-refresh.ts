import { useEffect, useRef, useState } from 'react'

export type PullState = 'idle' | 'pulling' | 'armed' | 'refreshing'

/** Finger travel is halved, so this is 128 px of thumb. */
const ARM_AT = 64
const MAX_PULL = 96
const DAMPING = 0.5
/** Shown at least this long, so a fast refetch does not blink. */
const MIN_SHOWN_MS = 400

/**
 * The phone's pull-down-to-reload gesture on a page the document scrolls.
 * Armed only when the page is at the top at `touchstart`; passive listeners,
 * so the page is never kept from scrolling. Renders nothing: `pull` and
 * `state` drive `PullIndicator`.
 */
export function usePullToRefresh({
  enabled,
  onRefresh,
}: {
  enabled: boolean
  onRefresh: () => Promise<unknown>
}): { pull: number; state: PullState } {
  const [pull, setPull] = useState(0)
  const [state, setState] = useState<PullState>('idle')
  const startY = useRef<number | null>(null)
  const refreshing = useRef(false)
  const refresh = useRef(onRefresh)
  // The end handler reads the latest pull without re-binding the listeners.
  const pullRef = useRef(0)

  useEffect(() => {
    refresh.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) return

    const atTop = () =>
      (document.scrollingElement ?? document.documentElement).scrollTop <= 0

    const reset = () => {
      startY.current = null
      pullRef.current = 0
      setPull(0)
      setState('idle')
    }

    const onStart = (event: TouchEvent) => {
      const finger = event.touches[0]
      if (refreshing.current || event.touches.length !== 1 || !finger || !atTop()) return
      startY.current = finger.clientY
    }

    const onMove = (event: TouchEvent) => {
      if (startY.current === null) return
      const finger = event.touches[0]
      if (event.touches.length !== 1 || !finger || !atTop()) return reset()
      const delta = finger.clientY - startY.current
      if (delta <= 0) return reset()
      const next = Math.min(delta * DAMPING, MAX_PULL)
      pullRef.current = next
      setPull(next)
      setState(next >= ARM_AT ? 'armed' : 'pulling')
    }

    const onEnd = () => {
      if (startY.current === null) return
      const armed = pullRef.current >= ARM_AT
      startY.current = null
      if (!armed) return reset()

      refreshing.current = true
      setState('refreshing')
      setPull(ARM_AT)
      const shown = new Promise((done) => setTimeout(done, MIN_SHOWN_MS))
      void Promise.allSettled([refresh.current(), shown]).then(() => {
        refreshing.current = false
        reset()
      })
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
  }, [enabled])

  return { pull, state }
}
