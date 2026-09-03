import type { ComponentProps, ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type Tone = 'success' | 'warning' | 'info' | 'danger' | 'new' | 'neutral'

const toneClasses: Record<Exclude<Tone, 'neutral'>, { badge: string; dot: string }> = {
  success: {
    badge: 'bg-tone-success-bg text-tone-success-fg',
    dot: 'bg-tone-success-dot',
  },
  warning: {
    badge: 'bg-tone-warning-bg text-tone-warning-fg',
    dot: 'bg-tone-warning-dot',
  },
  info: { badge: 'bg-tone-info-bg text-tone-info-fg', dot: 'bg-tone-info-dot' },
  danger: { badge: 'bg-tone-danger-bg text-tone-danger-fg', dot: 'bg-tone-danger-dot' },
  new: { badge: 'bg-tone-new-bg text-tone-new-fg', dot: 'bg-tone-new-dot' },
}

/**
 * One badge for every state the app shows: tinted background, dark text of
 * the same hue, a dot. `neutral` is the quiet outline for labels that are not
 * states at all — a gym name, a kind.
 */
export function StatusBadge({
  tone,
  dot = tone !== 'neutral',
  className,
  children,
  ...props
}: ComponentProps<'span'> & { tone: Tone; dot?: boolean; children: ReactNode }) {
  if (tone === 'neutral') {
    return (
      <Badge variant="outline" className={className} {...props}>
        {children}
      </Badge>
    )
  }
  const classes = toneClasses[tone]
  return (
    <Badge variant="ghost" className={cn(classes.badge, className)} {...props}>
      {dot && (
        <span aria-hidden="true" className={cn('size-1.5 rounded-full', classes.dot)} />
      )}
      {children}
    </Badge>
  )
}
