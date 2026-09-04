import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Skeleton rows in place of "Loading…" text. The label is still there for a
 * screen reader — one announcement, not one per row.
 */
export function LoadingState({
  rows = 3,
  label,
  className,
}: {
  rows?: number
  label?: string
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <div role="status" className={cn('space-y-3', className)}>
      <span className="sr-only">{label ?? t('app.loading')}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-5', index % 3 === 2 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}
