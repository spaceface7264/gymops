import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PullState } from '@/hooks/use-pull-to-refresh'
import { cn } from '@/lib/utils'

/**
 * The disc that follows a pull-to-refresh under the header: it comes down with
 * the finger, the icon turning with it, and spins while the queries reload.
 * Transform and opacity only, so the page beneath never moves.
 */
export function PullIndicator({ pull, state }: { pull: number; state: PullState }) {
  const { t } = useTranslation()
  const refreshing = state === 'refreshing'

  return (
    <div
      role="status"
      aria-hidden={!refreshing}
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center',
        state === 'idle' && 'opacity-0 transition-opacity duration-150',
      )}
      style={{ transform: `translateY(${pull + 12}px)` }}
    >
      <span className="bg-card text-primary flex size-8 items-center justify-center rounded-full shadow-md">
        <LoaderCircle
          aria-hidden
          className={cn('size-4', refreshing && 'animate-spin')}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </span>
      {refreshing && <span className="sr-only">{t('app.refreshing')}</span>}
    </div>
  )
}
