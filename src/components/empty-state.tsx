import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Nothing here yet — said plainly, with the way forward on the same card. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="bg-accent text-accent-foreground flex size-11 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {body && <p className="text-muted-foreground max-w-prose text-sm">{body}</p>}
      </div>
      {action}
    </div>
  )
}
