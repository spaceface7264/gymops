import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UnreadCount } from '@/components'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useUnreadCount } from './queries'
import { useNotificationStream } from './use-notification-stream'

/**
 * The way into the inbox, in the app shell's header. It also owns the Realtime
 * subscription: the badge is the one thing on screen everywhere, so this is
 * where "something arrived" has to land.
 */
export function NotificationBell() {
  const { t } = useTranslation()
  const unread = useUnreadCount()
  useNotificationStream()

  const count = unread.data ?? 0

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link
        to="/notifications"
        aria-label={
          count > 0 ? t('notifications.bellUnread', { count }) : t('notifications.bell')
        }
      >
        <Bell className="size-5" aria-hidden="true" />
        <UnreadCount
          count={count}
          className="absolute top-0.5 right-0.5"
          aria-hidden="true"
        />
      </Link>
    </Button>
  )
}
