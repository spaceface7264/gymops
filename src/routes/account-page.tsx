import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components'
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
    <div className="max-w-xl space-y-5">
      <PageHeader title={t('auth.account.title')} />
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
  if (saved)
    return (
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {savedText}
      </p>
    )
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
  // A failure is a latch on the mutation object — it stays `isError` until
  // the next `mutate()` call, so without this the message would still show
  // after the person edited the field to fix the problem.
  const [dismissed, setDismissed] = useState(false)
  const value = typed ?? profile?.full_name ?? ''

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = value.trim()
    setEmpty(name === '')
    if (name === '') return
    setDismissed(false)
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
              onChange={(event) => {
                setTyped(event.target.value)
                setDismissed(true)
              }}
            />
          </div>
          {empty && (
            <p role="alert" className="text-destructive text-sm">
              {t('auth.account.nameEmpty')}
            </p>
          )}
          <Feedback
            saved={lastSaved !== null && value.trim() === lastSaved}
            failed={updateName.isError && !dismissed}
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
  // See NameCard's `dismissed`: a failure otherwise latches until submit.
  const [dismissed, setDismissed] = useState(false)
  const storedLocale =
    profile?.locale && supportedLocales.includes(profile.locale as Locale)
      ? (profile.locale as Locale)
      : 'da'
  const locale = picked ?? storedLocale

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDismissed(false)
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
              className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-xl border px-3.5 py-1 text-base outline-none focus-visible:ring-[3px]"
              value={locale}
              onChange={(event) => {
                setPicked(event.target.value as Locale)
                setDismissed(true)
              }}
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
            failed={updateLocale.isError && !dismissed}
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
  // "Password changed." set on success, like the other cards' `lastSaved` —
  // cleared by editing any of the three fields, so it does not stay on
  // screen while the person types a new current password.
  const [changed, setChanged] = useState(false)
  // See NameCard's `dismissed`: a failure otherwise latches until submit.
  const [dismissed, setDismissed] = useState(false)
  const wrongCurrent = changePassword.error?.message === 'wrong_password'

  function clearFeedback() {
    setChanged(false)
    setDismissed(true)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextProblem = checkPassword(next, confirm)
    setProblem(nextProblem)
    if (nextProblem) return
    setDismissed(false)
    changePassword.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
          setChanged(true)
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
              onChange={(event) => {
                setCurrent(event.target.value)
                clearFeedback()
              }}
            />
          </div>
          <PasswordFields
            passwordLabel={t('auth.account.newPassword')}
            confirmLabel={t('auth.account.repeat')}
            password={next}
            confirm={confirm}
            onPasswordChange={(value) => {
              setNext(value)
              clearFeedback()
            }}
            onConfirmChange={(value) => {
              setConfirm(value)
              clearFeedback()
            }}
          />
          {problem && (
            <p role="alert" className="text-destructive text-sm">
              {t(`auth.${problem}`)}
            </p>
          )}
          {!problem && (
            <Feedback
              saved={changed}
              failed={changePassword.isError && !dismissed}
              savedText={t('auth.account.passwordSaved')}
              failedText={
                wrongCurrent
                  ? t('auth.account.wrongPassword')
                  : t('auth.account.saveFailed')
              }
            />
          )}
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? t('auth.account.saving') : t('auth.account.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
