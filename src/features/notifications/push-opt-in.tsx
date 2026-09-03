import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  pushConfigured,
  pushSupported,
  useDisablePush,
  useEnablePush,
  usePushState,
} from './push'

/**
 * The push switch for *this* browser, on the preferences screen. Separate from
 * the per-type table above it: those say what you want to hear about, this says
 * whether this device may buzz at all — and it is the one control that has to
 * be a real button, because the permission prompt only opens from a gesture.
 */
export function PushOptIn() {
  const { t } = useTranslation()
  const state = usePushState()
  const enable = useEnablePush()
  const disable = useDisablePush()

  if (!pushSupported()) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('notifications.pushUnsupported')}{' '}
        <Link className="underline" to="/install">
          {t('notifications.installGuide')}
        </Link>
      </p>
    )
  }

  const denied = state.data?.permission === 'denied'
  const subscribed = state.data?.subscribed ?? false

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="font-medium">{t('notifications.pushOnThisDevice')}</p>
      <p className="text-muted-foreground text-sm">
        {denied
          ? t('notifications.pushDenied')
          : subscribed
            ? t('notifications.pushOn')
            : t('notifications.pushOff')}
      </p>

      {!pushConfigured() && (
        <p className="text-muted-foreground text-sm">{t('notifications.pushNotSetUp')}</p>
      )}

      {(enable.isError || disable.isError) && (
        <p role="alert" className="text-destructive text-sm">
          {t('notifications.pushFailed')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={subscribed ? 'outline' : 'default'}
          disabled={denied || !pushConfigured() || enable.isPending || disable.isPending}
          onClick={() => (subscribed ? disable.mutate() : enable.mutate())}
        >
          {subscribed ? t('notifications.pushDisable') : t('notifications.pushEnable')}
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/install">{t('notifications.installGuide')}</Link>
        </Button>
      </div>
    </div>
  )
}
