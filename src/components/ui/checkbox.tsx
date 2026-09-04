import * as React from 'react'
import { CheckIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * A 20 px box with a 44 px hit area (the `before:` pseudo-element), so the
 * box alone is tappable on a phone; wrap it in a `<label>` with its text to
 * make the whole row the target.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-input bg-card focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/30 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground relative size-5 shrink-0 rounded-md border transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out outline-none before:absolute before:-inset-3 before:content-[''] focus-visible:ring-[3px] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
