import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth'
import { createQueryClient } from '@/lib/query-client'
import { router } from '@/routes/router'

export function App() {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}
