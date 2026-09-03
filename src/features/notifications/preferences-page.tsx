import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { PushOptIn } from './push-opt-in'
import {
  defaultPref,
  notificationChannels,
  notificationTypes,
  useNotificationPrefs,
  useSetNotificationPref,
  type NotificationChannel,
  type NotificationPref,
  type NotificationType,
} from './queries'

/**
 * `/notifications/preferences`: one row per kind of notification, one switch
 * per channel. Turning the inbox off for a type stops the row being written at
 * all (P5-02), which is why it is offered next to the two that only silence a
 * delivery.
 */
export function NotificationPreferencesPage() {
  const { t } = useTranslation()
  const prefs = useNotificationPrefs()
  const setPref = useSetNotificationPref()

  const stored = new Map((prefs.data ?? []).map((pref) => [pref.type, pref]))
  const effective = (type: NotificationType): NotificationPref =>
    stored.get(type) ?? defaultPref(type)

  const toggle = (type: NotificationType, channel: NotificationChannel) => {
    const current = effective(type)
    setPref.mutate({ ...current, [channel]: !current[channel] })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('notifications.preferences')}</h1>
        <Button size="sm" variant="outline" asChild>
          <Link to="/notifications">{t('notifications.backToInbox')}</Link>
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        {t('notifications.preferencesHint')}
      </p>

      <PushOptIn />

      {prefs.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('notifications.loadFailed')}
        </p>
      )}
      {setPref.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('notifications.saveFailed')}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th scope="col" className="py-2 pr-4 font-medium">
                {t('notifications.typeColumn')}
              </th>
              {notificationChannels.map((channel) => (
                <th key={channel} scope="col" className="px-2 py-2 font-medium">
                  {t(`notifications.channel.${channel}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {notificationTypes.map((type) => (
              <tr key={type} className="border-t">
                <th scope="row" className="py-2 pr-4 text-left font-normal">
                  {t(`notifications.type.${type}`)}
                </th>
                {notificationChannels.map((channel) => (
                  <td key={channel} className="px-2 py-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={effective(type)[channel]}
                        disabled={prefs.isPending || setPref.isPending}
                        onChange={() => toggle(type, channel)}
                        aria-label={t('notifications.channelFor', {
                          channel: t(`notifications.channel.${channel}`),
                          type: t(`notifications.type.${type}`),
                        })}
                      />
                      <span className="sr-only">
                        {t(`notifications.channel.${channel}`)}
                      </span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
