import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * How every screen opens: the title, one line under it if the title needs one,
 * and one action on the right. On a phone the action wraps under the title
 * rather than squeezing it.
 */
export function PageHeader({
  title,
  description,
  action,
  as: Heading = 'h1',
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  as?: 'h1' | 'h2'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-4 gap-y-3',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <Heading className="text-2xl font-semibold">{title}</Heading>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
