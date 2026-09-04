import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/features/auth'
import { createQueryClient } from '@/lib/query-client'
import { router } from '@/routes/router'

export function App() {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* One provider, so a second tooltip opens at once while the first
            one's delay has just been paid. */}
        <TooltipProvider delayDuration={400} skipDelayDuration={300}>
          <RouterProvider router={router} />
        </TooltipProvider>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}
