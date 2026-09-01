import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PasswordFields,
  checkPassword,
  useAuth,
  useUrlSession,
  useCompleteInvite,
  type PasswordProblem,
} from '@/features/auth'
import { supportedLocales, type Locale } from '@/lib/i18n'
import { AuthLayout } from '@/routes/auth-layout'

/**
 * Landing screen for an invite link: the invited user sets their name, their
 * language and a password. Their gyms and roles come from the `invites` row and
 * are applied server-side, so nothing here is a permission decision.
 */
export function AcceptInvitePage() {
  const { t, i18n } = useTranslation()
  const { status, user } = useAuth()
  const urlSession = useUrlSession()
  const completeInvite = useCompleteInvite()
  // The inviter already typed a name (P2-03 puts it in the user metadata), so
  // offer it and let it be corrected. null means "not touched yet"; the session
  // arrives after the first render, which rules out an initial state.
  const [typedName, setTypedName] = useState<string | null>(null)
  const invitedName: unknown = user?.user_metadata?.full_name
  const fullName = typedName ?? (typeof invitedName === 'string' ? invitedName : '')
  const [locale, setLocale] = useState<Locale>(() =>
    supportedLocales.includes(i18n.language as Locale) ? (i18n.language as Locale) : 'da',
  )
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [problem, setProblem] = useState<PasswordProblem | null>(null)

  if (completeInvite.isSuccess) return <Navigate to="/" replace />

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextProblem = checkPassword(password, confirm)
    setProblem(nextProblem)
    if (nextProblem) return

    completeInvite.mutate(
      { password, fullName, locale },
      { onSuccess: () => void i18n.changeLanguage(locale) },
    )
  }

  if (status === 'loading' || urlSession === 'adopting') return null

  if (status === 'signedOut' || urlSession === 'failed') {
    return (
      <AuthLayout title={t('auth.acceptInvite.title')}>
        <p className="text-sm">{t('auth.acceptInvite.expired')}</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth.acceptInvite.title')}
      description={t('auth.acceptInvite.description')}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="full-name">{t('auth.acceptInvite.fullName')}</Label>
          <Input
            id="full-name"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setTypedName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="locale">{t('language.label')}</Label>
          <select
            id="locale"
            className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            {supportedLocales.map((option) => (
              <option key={option} value={option}>
                {t(`language.${option}`)}
              </option>
            ))}
          </select>
        </div>
        <PasswordFields
          passwordLabel={t('auth.acceptInvite.password')}
          confirmLabel={t('auth.acceptInvite.confirm')}
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
        />
        {(problem ?? completeInvite.isError) && (
          <p role="alert" className="text-destructive text-sm">
            {problem ? t(`auth.${problem}`) : t('auth.acceptInvite.failed')}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={completeInvite.isPending}>
          {completeInvite.isPending
            ? t('auth.acceptInvite.submitting')
            : t('auth.acceptInvite.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
