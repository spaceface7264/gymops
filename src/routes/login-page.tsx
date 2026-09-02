import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth, useSignIn } from '@/features/auth'
import { AuthLayout } from '@/routes/auth-layout'

/**
 * Sign-in screen. Signing up is impossible by design: accounts only exist
 * through an invite (PROJECT_SPEC.md §1), so the only way out of this screen is
 * the recovery link.
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
    <AuthLayout title={t('auth.signIn.title')}>
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
        <Link
          to="/forgot-password"
          className="text-muted-foreground block text-center text-sm underline underline-offset-4"
        >
          {t('auth.signIn.forgotPassword')}
        </Link>
      </form>
    </AuthLayout>
  )
}
