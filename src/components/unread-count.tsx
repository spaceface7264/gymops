import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * The violet pill that says how many are unread: the same in the nav, the
 * channel list and the bell. Pass the `aria-label` that spells the count out.
 */
export function UnreadCount({
  count,
  className,
  ...props
}: ComponentProps<'span'> & { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5 font-semibold tabular-nums',
        className,
      )}
      {...props}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
