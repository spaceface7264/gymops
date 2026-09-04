import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isDesktop } from '@/lib/platform'
import { DesktopNotificationOptIn } from './desktop-notification-opt-in'
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
      <PageHeader
        title={t('notifications.preferences')}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/notifications">{t('notifications.backToInbox')}</Link>
          </Button>
        }
      />

      <p className="text-muted-foreground text-sm">
        {t('notifications.preferencesHint')}
      </p>

      {isDesktop() ? <DesktopNotificationOptIn /> : <PushOptIn />}

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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t('notifications.typeColumn')}</TableHead>
            {notificationChannels.map((channel) => (
              <TableHead key={channel} scope="col">
                {t(`notifications.channel.${channel}`)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {notificationTypes.map((type) => (
            <TableRow key={type}>
              <th scope="row" className="px-2 py-3 text-left align-middle font-normal">
                {t(`notifications.type.${type}`)}
              </th>
              {notificationChannels.map((channel) => (
                <TableCell key={channel}>
                  <Label htmlFor={`pref-${type}-${channel}`} className="sr-only">
                    {t('notifications.channelFor', {
                      channel: t(`notifications.channel.${channel}`),
                      type: t(`notifications.type.${type}`),
                    })}
                  </Label>
                  <Switch
                    id={`pref-${type}-${channel}`}
                    checked={effective(type)[channel]}
                    disabled={prefs.isPending || setPref.isPending}
                    onCheckedChange={() => toggle(type, channel)}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
