import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      // Above the phone nav bar; the sidebar layout has nothing at the bottom.
      offset={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
      mobileOffset={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
      toastOptions={{
        classNames: {
          toast: 'rounded-2xl border border-border bg-card text-foreground font-sans',
          description: 'text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
