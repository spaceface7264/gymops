import {
  AtSign,
  BellRing,
  CheckCheck,
  MessageCircle,
  Reply,
  SmilePlus,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import type { NotificationType } from './queries'

/**
 * What each kind of notification *is*, as an icon and a translated heading.
 * The row itself carries the author's own words in whatever language they
 * wrote them (P5-02); this is the framing around them, and `notify` keeps the
 * same headings for the push and the email.
 */
export const notificationIcons: Record<NotificationType, LucideIcon> = {
  incident_reported: TriangleAlert,
  incident_status_changed: CheckCheck,
  ack_reminder: BellRing,
  invite: UserPlus,
  chat_mention: AtSign,
  chat_dm: MessageCircle,
  chat_reply: Reply,
  chat_reaction: SmilePlus,
}
