import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  PasswordFields,
  checkPassword,
  useAuth,
  useUrlSession,
  useSetPassword,
  type PasswordProblem,
} from '@/features/auth'
import { AuthLayout } from '@/routes/auth-layout'

/**
 * Second half of the recovery flow. The link's `code` is exchanged for a
 * session by the Supabase client (`detectSessionInUrl`), so "no session once
 * loading finished" means the link was expired or already used.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const urlSession = useUrlSession()
  const setPassword = useSetPassword()
  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [problem, setProblem] = useState<PasswordProblem | null>(null)

  if (setPassword.isSuccess) return <Navigate to="/" replace />

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextProblem = checkPassword(password, confirm)
    setProblem(nextProblem)
    if (!nextProblem) setPassword.mutate(password)
  }

  if (status === 'loading' || urlSession === 'adopting') return null

  if (status === 'signedOut' || urlSession === 'failed') {
    return (
      <AuthLayout title={t('auth.resetPassword.title')}>
        <div className="space-y-4">
          <p className="text-sm">{t('auth.resetPassword.expired')}</p>
          <Link to="/forgot-password" className="text-sm underline underline-offset-4">
            {t('auth.resetPassword.requestNew')}
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth.resetPassword.title')}
      description={t('auth.resetPassword.description')}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <PasswordFields
          passwordLabel={t('auth.resetPassword.password')}
          confirmLabel={t('auth.resetPassword.confirm')}
          password={password}
          confirm={confirm}
          onPasswordChange={setPasswordValue}
          onConfirmChange={setConfirm}
        />
        {(problem ?? setPassword.isError) && (
          <p role="alert" className="text-destructive text-sm">
            {problem ? t(`auth.${problem}`) : t('auth.resetPassword.failed')}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={setPassword.isPending}>
          {setPassword.isPending
            ? t('auth.resetPassword.submitting')
            : t('auth.resetPassword.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
