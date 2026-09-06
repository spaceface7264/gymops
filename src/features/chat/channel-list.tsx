import { BellOff, Hash, Lock, MessageCircle, MessagesSquare, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { EmptyState, LoadingState, UnreadCount, LoadError } from '@/components'
import { useAuth } from '@/features/auth'
import { cn } from '@/lib/utils'
import { channelName } from './channel-name'
import { useChannels, useChatOverview, useChannelMembers, type Channel } from './queries'

/** The three groups the sidebar shows, in the order they matter on a shift. */
const groups = ['gyms', 'channels', 'dms'] as const
type Group = (typeof groups)[number]

function groupOf(channel: Channel): Group {
  if (channel.kind === 'dm') return 'dms'
  if (channel.kind === 'custom') return 'channels'
  return 'gyms'
}

/** The channels this person is in, grouped, with what each one is owed. */
export function ChannelList({ activeId }: { activeId?: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const channels = useChannels()
  const overview = useChatOverview()

  const rows = channels.data ?? []
  const dmMembers = useChannelMembers(
    rows.filter((row) => row.kind === 'dm').map((row) => row.id),
  )

  const activity = new Map((overview.data ?? []).map((row) => [row.channel_id, row]))

  const named = rows.map((channel) => ({
    channel,
    name: channelName(channel, dmMembers.data ?? [], user?.id),
    unread: activity.get(channel.id)?.unread ?? 0,
    lastMessageAt: activity.get(channel.id)?.last_message_at ?? null,
  }))

  if (channels.isError) {
    return (
      <div className="p-3">
        <LoadError message={t('chat.loadFail')} onRetry={() => void channels.refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3">
      {channels.isPending && <LoadingState rows={6} />}

      {groups.map((group) => {
        const inGroup = named
          .filter((row) => groupOf(row.channel) === group)
          // Newest activity first, so a channel that is talking is at the top;
          // the ones nobody has posted in yet sort by name underneath.
          .sort(
            (a, b) =>
              (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '') ||
              a.name.localeCompare(b.name),
          )

        if (inGroup.length === 0) return null

        return (
          // Labelled, so each group is a landmark somebody on a screen reader
          // can jump between rather than one flat list of links.
          <section
            key={group}
            aria-labelledby={`chat-group-${group}`}
            className="space-y-1"
          >
            <h2
              id={`chat-group-${group}`}
              className="text-muted-foreground px-2 text-xs font-medium"
            >
              {t(`chat.group.${group}`)}
            </h2>
            {inGroup.map(({ channel, name, unread, lastMessageAt }) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                name={name}
                unread={unread}
                lastMessageAt={lastMessageAt}
                active={channel.id === activeId}
              />
            ))}
          </section>
        )
      })}

      {!channels.isPending && named.length === 0 && (
        <EmptyState icon={MessagesSquare} title={t('chat.empty')} />
      )}
    </div>
  )
}

function ChannelIcon({ channel }: { channel: Channel }) {
  if (channel.kind === 'dm')
    return <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
  if (channel.kind === 'company')
    return <Users className="size-4 shrink-0" aria-hidden="true" />
  if (channel.is_private) return <Lock className="size-4 shrink-0" aria-hidden="true" />
  return <Hash className="size-4 shrink-0" aria-hidden="true" />
}

/**
 * When something was last said, short enough for the edge of a row: the time
 * today, the weekday this week, the date otherwise.
 */
function lastSaid(iso: string, language: string): string {
  const date = new Date(iso)
  const now = new Date()
  const days = (now.getTime() - date.getTime()) / 86_400_000

  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString(language, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  if (days < 6) return date.toLocaleDateString(language, { weekday: 'short' })
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short' })
}

function ChannelRow({
  channel,
  name,
  unread,
  lastMessageAt,
  active,
}: {
  channel: Channel
  name: string
  unread: number
  lastMessageAt: string | null
  active: boolean
}) {
  const { t, i18n } = useTranslation()

  return (
    <NavLink
      to={`/chat/${channel.id}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-xl px-2 py-2 text-sm transition-colors duration-150',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
      )}
    >
      <ChannelIcon channel={channel} />
      <span className={cn('min-w-0 flex-1 truncate', unread > 0 && 'font-semibold')}>
        {name}
      </span>
      {channel.muted && (
        <>
          <BellOff className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t('chat.muted')}</span>
        </>
      )}
      {unread > 0 ? (
        <UnreadCount count={unread} aria-label={t('chat.unread', { count: unread })} />
      ) : (
        lastMessageAt && (
          <time
            dateTime={lastMessageAt}
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
          >
            {lastSaid(lastMessageAt, i18n.language)}
          </time>
        )
      )}
    </NavLink>
  )
}
