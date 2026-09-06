import { ArrowDown, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ARM_AT, type PullState } from '@/hooks/use-pull-to-refresh'
import { cn } from '@/lib/utils'

/** The header is 60 px tall; the disc docks centred on its bottom edge. */
const DOCK_OFFSET = 20
const DISC = 32

/**
 * The disc that follows a pull-to-refresh: it comes down out of the header
 * with the finger, the arrow turning over as it goes, docks on the header's
 * edge and grows a little when the release will reload, then spins while the
 * queries refetch. Transform and opacity only, so the page beneath never
 * moves. The status line is always in the tree and only its text changes, so a
 * screen reader hears "Refreshing…" and then "Refreshed".
 */
export function PullIndicator({
  pull,
  state,
  done,
}: {
  pull: number
  state: PullState
  done: boolean
}) {
  const { t } = useTranslation()
  const refreshing = state === 'refreshing'
  const armed = state === 'armed' || refreshing
  // Under the finger the disc tracks it; off the finger it eases.
  const fingerOff = state === 'idle' || refreshing
  const y = state === 'idle' ? -DISC - 4 : Math.min(pull, ARM_AT) - DOCK_OFFSET
  const turn = Math.min(pull / ARM_AT, 1) * 180

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center transition-opacity duration-150 ease-out',
          fingerOff && 'transition-[transform,opacity]',
          state === 'idle' && 'opacity-0',
        )}
        style={{ transform: `translateY(${y}px)` }}
      >
        <span
          className={cn(
            'bg-card text-primary flex size-8 items-center justify-center rounded-full shadow-md transition-transform duration-150 ease-out',
            armed && 'scale-110',
          )}
        >
          {refreshing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowDown className="size-4" style={{ transform: `rotate(${turn}deg)` }} />
          )}
        </span>
      </div>
      <span role="status" className="sr-only">
        {refreshing ? t('app.refreshing') : done ? t('app.refreshed') : ''}
      </span>
    </>
  )
}
