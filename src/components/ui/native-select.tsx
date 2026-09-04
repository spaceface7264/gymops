import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A native `<select>` in the `Input` clothes. It stays native on purpose
 * (spec §4): the keyboard, the screen reader and the phone's own picker all
 * work, and there is no popover to keep in step with the viewport.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'border-input bg-card text-foreground focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/30 h-11 min-w-0 rounded-xl border px-3.5 py-1 text-base transition-[color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { NativeSelect }
