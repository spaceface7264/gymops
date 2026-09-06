import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Nothing here yet — said plainly, with the way forward beside it. No box and
 * no dashed border (a dashed edge reads as a drop zone on a phone), and the
 * icon only from `md` up: on a phone the sentence is the whole state (P7M-07).
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  as: Title = 'p',
}: {
  icon?: LucideIcon
  title: string
  body?: string
  action?: ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'p'
}) {
  return (
    <div
      className={cn('flex flex-col items-center gap-3 px-2 py-6 text-center', className)}
    >
      {Icon && (
        <span className="bg-accent text-accent-foreground hidden size-11 items-center justify-center rounded-full md:flex">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-1">
        <Title className="font-semibold">{title}</Title>
        {body && <p className="text-muted-foreground max-w-prose text-sm">{body}</p>}
      </div>
      {action}
    </div>
  )
}
