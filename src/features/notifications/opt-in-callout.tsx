import type { ReactNode } from 'react'

/** One device-level opt-in (push, desktop): a titled box on the card ground. */
export function OptInCallout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="bg-card space-y-2 rounded-2xl border p-4">
      <p className="font-semibold">{title}</p>
      {children}
    </div>
  )
}
