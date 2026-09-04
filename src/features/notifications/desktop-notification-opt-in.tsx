import { useTranslation } from 'react-i18next'
import { OptInCallout } from './opt-in-callout'
import { Button } from '@/components/ui/button'
import { useDesktopNotificationState, useEnableDesktopNotifications } from './desktop'

/**
 * The desktop app's stand-in for `PushOptIn` on the preferences screen: the
 * per-type switches above say what to hear about, this says whether this
 * computer may show it. A refusal is the OS's to undo.
 */
export function DesktopNotificationOptIn() {
  const { t } = useTranslation()
  const state = useDesktopNotificationState()
  const enable = useEnableDesktopNotifications()
  const granted = state.data ?? false
  const denied = enable.error?.message === 'denied'

  return (
    <OptInCallout title={t('notifications.desktopOnThisDevice')}>
      <p className="text-muted-foreground text-sm">
        {granted
          ? t('notifications.desktopOn')
          : denied
            ? t('notifications.desktopDenied')
            : t('notifications.desktopOff')}
      </p>
      {!granted && (
        <Button
          size="sm"
          disabled={denied || enable.isPending}
          onClick={() => enable.mutate()}
        >
          {t('notifications.pushEnable')}
        </Button>
      )}
    </OptInCallout>
  )
}
