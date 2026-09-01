import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth, useSignIn } from '@/features/auth'

/**
 * Provisional sign-in screen: enough to exercise the session and the route
 * guard. P1-07 replaces it with the designed screens (forgot/reset password,
 * invite accept) and the layout that goes with them.
 */
export function LoginPage() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const location = useLocation()
  const signIn = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    signIn.mutate({ email, password })
  }

  return (
    <Card className="mx-auto mt-16 max-w-sm">
      <CardHeader>
        <CardTitle>{t('auth.signIn.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.signIn.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.signIn.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {signIn.isError && (
            <p role="alert" className="text-destructive text-sm">
              {t('auth.signIn.failed')}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={signIn.isPending}>
            {signIn.isPending ? t('auth.signIn.submitting') : t('auth.signIn.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
