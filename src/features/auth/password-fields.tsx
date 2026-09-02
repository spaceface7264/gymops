import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { minPasswordLength } from './password'

/** New password + repeat, with the length hint. Used on reset and invite accept. */
export function PasswordFields({
  passwordLabel,
  confirmLabel,
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
}: {
  passwordLabel: string
  confirmLabel: string
  password: string
  confirm: string
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="password">{passwordLabel}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={minPasswordLength}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">{t('auth.passwordHint')}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">{confirmLabel}</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => onConfirmChange(event.target.value)}
        />
      </div>
    </>
  )
}
