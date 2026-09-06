import type { ReactNode } from 'react'
import { useId } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * One block of the home page (P7M-03): a heading, an optional "all of them"
 * link beside it, and rows underneath. Not a card: the page is one list a
 * phone reads top to bottom, and an empty block is one muted line, not a
 * box with an icon in it.
 */
export function HomeSection({
  title,
  action,
  children,
}: {
  title: string
  /** A `Link` or `HomeSectionLink` shown beside the heading. */
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-1">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** The "all news" kind of link beside a section heading, 44 px tall. */
export function HomeSectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="text-accent-foreground flex min-h-11 shrink-0 items-center rounded-full px-2 text-sm font-medium hover:underline"
    >
      {children}
    </Link>
  )
}

/** What a section says when there is nothing in it: one line, no box. */
export function HomeEmpty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-2">{children}</p>
}

/** The rows of a section: each one a 44 px link with a badge, a title and a
 *  line of meta. `divide-y` hairlines, no borders around the list. */
export function HomeRows({ children }: { children: ReactNode }) {
  return <ul className="divide-border -mx-2 divide-y">{children}</ul>
}

export function HomeRow({
  to,
  badge,
  meta,
  className,
  children,
}: {
  to: string
  badge?: ReactNode
  meta?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <li>
      <Link
        to={to}
        className={cn(
          'hover:bg-accent/60 focus-visible:ring-ring/40 flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 outline-none focus-visible:ring-[3px]',
          className,
        )}
      >
        {badge}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{children}</span>
          {meta && (
            <span className="text-muted-foreground block truncate text-sm">{meta}</span>
          )}
        </span>
      </Link>
    </li>
  )
}
