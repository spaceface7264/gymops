import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      // Above the phone nav bar; the sidebar layout has nothing at the bottom.
      offset={{ bottom: 'var(--nav-bar-clearance)' }}
      mobileOffset={{ bottom: 'var(--nav-bar-clearance)' }}
      toastOptions={{
        classNames: {
          toast: 'rounded-2xl border border-border bg-card text-foreground font-sans',
          description: 'text-muted-foreground',
          success: '[&_[data-icon]]:text-tone-success-fg',
          error: '[&_[data-icon]]:text-tone-danger-fg',
          info: '[&_[data-icon]]:text-tone-info-fg',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
