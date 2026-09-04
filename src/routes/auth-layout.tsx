import type { ReactNode } from 'react'
import { Logo } from '@/components'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Frame shared by the four signed-out screens: sign in, forgot password,
 * reset password and invite accept.
 */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <Logo wordmark className="flex justify-center text-xl" />
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
