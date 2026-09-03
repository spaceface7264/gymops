import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/features/auth'
import { cn } from '@/lib/utils'
import { channelName } from './channel-name'
import { ChannelList } from './channel-list'
import { useChannels, useDmMembers } from './queries'

/**
 * `/chat` and `/chat/:channelId` are the same screen. On desktop the list and
 * the conversation sit side by side; on a phone they are one pane at a time —
 * the list until a channel is picked, the channel with a way back. Staff read
 * this one-handed mid-shift, which is also why the route is full-bleed: the
 * conversation scrolls inside itself rather than moving the page.
 */
export function ChatPage() {
  const { t } = useTranslation()
  const { channelId } = useParams()

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside
        aria-label={t('chat.title')}
        className={cn(
          'md:w-72 md:shrink-0 md:overflow-y-auto md:border-r',
          'pb-20 md:pb-0',
          channelId && 'hidden md:block',
        )}
      >
        <ChannelList activeId={channelId} />
      </aside>

      <section
        className={cn('flex min-w-0 flex-1 flex-col', !channelId && 'hidden md:flex')}
      >
        {channelId ? (
          <ChannelView channelId={channelId} />
        ) : (
          <p className="text-muted-foreground p-6 text-sm">{t('chat.pickChannel')}</p>
        )}
      </section>
    </div>
  )
}

/**
 * The conversation. P6-03 builds its frame — the header, the way back and the
 * scroll container the message list will live in; the messages themselves,
 * their pagination and their live sync are P6-04.
 */
function ChannelView({ channelId }: { channelId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const channels = useChannels()
  const channel = (channels.data ?? []).find((row) => row.id === channelId)
  const dmMembers = useDmMembers(channel?.kind === 'dm' ? [channel.id] : [])

  const name = channel ? channelName(channel, dmMembers.data ?? [], user?.id) : ''

  return (
    <>
      <header className="flex items-center gap-2 border-b p-3">
        <Link
          to="/chat"
          aria-label={t('chat.back')}
          className="hover:bg-accent/60 rounded-md p-1 md:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-semibold">{name}</h1>
          {channel?.description && (
            <p className="text-muted-foreground truncate text-sm">
              {channel.description}
            </p>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
        <p className="text-muted-foreground text-sm">{t('chat.messagesNotYet')}</p>
      </div>
    </>
  )
}
