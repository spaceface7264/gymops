import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
    <Button variant="ghost" size="sm" asChild className="relative">
      <Link
        to="/notifications"
        aria-label={
          count > 0 ? t('notifications.bellUnread', { count }) : t('notifications.bell')
        }
      >
        <Bell className="size-5" aria-hidden="true" />
        {count > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-[10px] leading-4 font-medium">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    </Button>
  )
}
