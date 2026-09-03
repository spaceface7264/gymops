import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PasswordFields,
  checkPassword,
  useChangePassword,
  useProfile,
  useUpdateLocale,
  useUpdateName,
  type PasswordProblem,
} from '@/features/auth'
import { supportedLocales, type Locale } from '@/lib/i18n'

/**
 * `/account` (P7B-01): the person's own name, language and password, each a
 * card with its own save. Nothing here is a permission — `profiles_update`
 * lets a person edit their own row and `guard_profile_privileges()` keeps
 * the role flags out of reach.
 */
export function AccountPage() {
  const { t } = useTranslation()

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{t('auth.account.title')}</h1>
      <NameCard />
      <LanguageCard />
      <PasswordCard />
    </div>
  )
}

function Feedback({
  saved,
  failed,
  savedText,
  failedText,
}: {
  saved: boolean
  failed: boolean
  savedText: string
  failedText: string
}) {
  if (failed)
    return (
      <p role="alert" className="text-destructive text-sm">
        {failedText}
      </p>
    )
  if (saved) return <p className="text-muted-foreground text-sm">{savedText}</p>
  return null
}

function NameCard() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const updateName = useUpdateName()
  // null until the person types: the profile arrives after the first render.
  const [typed, setTyped] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false)
  // The value last written successfully — "saved" only holds while the field
  // still shows it, so editing further after a save clears the message
  // instead of implying the new text is persisted.
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const value = typed ?? profile?.full_name ?? ''

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = value.trim()
    setEmpty(name === '')
    if (name === '') return
    updateName.mutate(name, { onSuccess: () => setLastSaved(name) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.account.name')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="account-name">{t('auth.account.name')}</Label>
            <Input
              id="account-name"
              autoComplete="name"
              value={value}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          {empty && (
            <p role="alert" className="text-destructive text-sm">
              {t('auth.account.nameEmpty')}
            </p>
          )}
          <Feedback
            saved={lastSaved !== null && value === lastSaved}
            failed={updateName.isError}
            savedText={t('auth.account.nameSaved')}
            failedText={t('auth.account.saveFailed')}
          />
          <Button type="submit" disabled={updateName.isPending}>
            {updateName.isPending ? t('auth.account.saving') : t('auth.account.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function LanguageCard() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const updateLocale = useUpdateLocale()
  // null until the person picks one: the profile arrives after the first render.
  const [picked, setPicked] = useState<Locale | null>(null)
  // The locale last written successfully — see NameCard's `lastSaved`.
  const [lastSaved, setLastSaved] = useState<Locale | null>(null)
  const storedLocale =
    profile?.locale && supportedLocales.includes(profile.locale as Locale)
      ? (profile.locale as Locale)
      : 'da'
  const locale = picked ?? storedLocale

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateLocale.mutate(locale, { onSuccess: () => setLastSaved(locale) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.account.language')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="account-locale">{t('auth.account.language')}</Label>
            <select
              id="account-locale"
              className="border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
              value={locale}
              onChange={(event) => setPicked(event.target.value as Locale)}
            >
              {supportedLocales.map((option) => (
                <option key={option} value={option}>
                  {t(`language.${option}`)}
                </option>
              ))}
            </select>
          </div>
          <Feedback
            saved={lastSaved !== null && locale === lastSaved}
            failed={updateLocale.isError}
            savedText={t('auth.account.languageSaved')}
            failedText={t('auth.account.saveFailed')}
          />
          <Button type="submit" disabled={updateLocale.isPending}>
            {updateLocale.isPending ? t('auth.account.saving') : t('auth.account.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const { t } = useTranslation()
  const changePassword = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [problem, setProblem] = useState<PasswordProblem | null>(null)
  const wrongCurrent = changePassword.error?.message === 'wrong_password'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextProblem = checkPassword(next, confirm)
    setProblem(nextProblem)
    if (nextProblem) return
    changePassword.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.account.password')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="account-current">{t('auth.account.current')}</Label>
            <Input
              id="account-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>
          <PasswordFields
            passwordLabel={t('auth.account.newPassword')}
            confirmLabel={t('auth.account.repeat')}
            password={next}
            confirm={confirm}
            onPasswordChange={setNext}
            onConfirmChange={setConfirm}
          />
          {(problem ?? changePassword.isError) && (
            <p role="alert" className="text-destructive text-sm">
              {problem
                ? t(`auth.${problem}`)
                : wrongCurrent
                  ? t('auth.account.wrongPassword')
                  : t('auth.account.saveFailed')}
            </p>
          )}
          {changePassword.isSuccess && !problem && (
            <p className="text-muted-foreground text-sm">
              {t('auth.account.passwordSaved')}
            </p>
          )}
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? t('auth.account.saving') : t('auth.account.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
