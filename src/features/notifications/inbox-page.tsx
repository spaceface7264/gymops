import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { EmptyState, LoadingState, PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { notificationIcons } from './labels'
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  type Notification,
} from './queries'

/** `/notifications`: everything this person has been told in the last month. */
export function InboxPage() {
  const { t } = useTranslation()
  const notifications = useNotifications()
  const markAllRead = useMarkAllRead()

  const items = notifications.data ?? []
  const unread = items.filter((item) => item.read_at === null).length

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('notifications.title')}
        action={
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={unread === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {t('notifications.markAllRead')}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/notifications/preferences">
                {t('notifications.preferences')}
              </Link>
            </Button>
          </>
        }
      />

      {notifications.isPending && <LoadingState rows={6} />}
      {notifications.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('notifications.loadFailed')}
        </p>
      )}
      {notifications.data && items.length === 0 && (
        <EmptyState icon={Bell} title={t('notifications.empty')} />
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationRow notification={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function NotificationRow({ notification }: { notification: Notification }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const markRead = useMarkRead()
  const Icon = notificationIcons[notification.type]
  const unread = notification.read_at === null

  // Opening it is reading it: following the link marks it read on the way.
  const open = () => {
    if (unread) markRead.mutate({ id: notification.id, read: true })
    if (notification.url) void navigate(notification.url)
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border p-3',
        unread && 'bg-accent/50',
      )}
    >
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />

      <button
        type="button"
        onClick={open}
        className="min-w-0 flex-1 text-left"
        aria-label={t('notifications.open', { title: notification.title })}
      >
        <p className="text-muted-foreground text-xs">
          {t(`notifications.type.${notification.type}`)} ·{' '}
          {new Date(notification.created_at).toLocaleString(i18n.language, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className={cn('truncate', unread && 'font-medium')}>{notification.title}</p>
        {notification.body && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {notification.body}
          </p>
        )}
      </button>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => markRead.mutate({ id: notification.id, read: unread })}
        disabled={markRead.isPending}
      >
        {unread ? t('notifications.markRead') : t('notifications.markUnread')}
      </Button>
    </div>
  )
}
