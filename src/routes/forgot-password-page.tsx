import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRequestPasswordReset } from '@/features/auth'
import { AuthLayout } from '@/routes/auth-layout'

/**
 * Requests a recovery mail. The confirmation is deliberately the same whether
 * or not the address has an account, so the form cannot enumerate staff.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const requestReset = useRequestPasswordReset()
  const [email, setEmail] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    requestReset.mutate(email)
  }

  return (
    <AuthLayout
      title={t('auth.forgotPassword.title')}
      description={t('auth.forgotPassword.description')}
    >
      {requestReset.isSuccess ? (
        <div className="space-y-4">
          <p className="text-sm">{t('auth.forgotPassword.sent')}</p>
          <Link to="/login" className="text-sm underline underline-offset-4">
            {t('auth.forgotPassword.backToSignIn')}
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.forgotPassword.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {requestReset.isError && (
            <p role="alert" className="text-destructive text-sm">
              {t('auth.forgotPassword.failed')}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={requestReset.isPending}>
            {requestReset.isPending
              ? t('auth.forgotPassword.submitting')
              : t('auth.forgotPassword.submit')}
          </Button>
          <Link
            to="/login"
            className="text-muted-foreground block text-center text-sm underline underline-offset-4"
          >
            {t('auth.forgotPassword.backToSignIn')}
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
