import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        /* 16px, one step over the app's 15: iOS zooms the page into any smaller field it focuses. */
        'border-input bg-card placeholder:text-muted-foreground field-sizing-content min-h-24 w-full rounded-xl border px-3.5 py-2.5 text-[16px] transition-[color,box-shadow] duration-150 outline-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/30',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
