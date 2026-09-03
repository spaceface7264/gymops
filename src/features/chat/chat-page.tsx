import {
  ArrowLeft,
  Bell,
  BellOff,
  LogOut,
  Plus,
  Search,
  Settings,
  SquarePen,
  Trash2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth'
import { usePublishScope } from '@/features/content'
import { cn } from '@/lib/utils'
import { channelName } from './channel-name'
import { ChannelList } from './channel-list'
import { Composer } from './composer'
import { BrowseChannelsDialog } from './browse-channels-dialog'
import { ChannelDialog } from './channel-dialog'
import { ChannelMembersDialog } from './channel-members-dialog'
import { MessageList } from './message-list'
import { NewDmDialog } from './new-dm-dialog'
import { useChannelLive } from './use-channel-live'
import {
  useChannels,
  useChannelMembers,
  useDeleteChannel,
  useLeaveChannel,
  useSetChannelMuted,
} from './queries'

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
  const { canPublishSomewhere } = usePublishScope()
  const [newDm, setNewDm] = useState(false)
  const [newChannel, setNewChannel] = useState(false)
  const [browsing, setBrowsing] = useState(false)

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
        <div className="grid gap-2 p-3 pb-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setNewDm(true)}
          >
            <SquarePen className="size-4" aria-hidden="true" />
            {t('chat.newDm')}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => setBrowsing(true)}
            >
              <Search className="size-4" aria-hidden="true" />
              {t('chat.browse')}
            </Button>
            {/* Creating a channel is `can_publish_content()` (spec §2.1): a
                manager in their gyms, an admin anywhere, staff never. */}
            {canPublishSomewhere && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => setNewChannel(true)}
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('chat.newChannel')}
              </Button>
            )}
          </div>
        </div>
        <ChannelList activeId={channelId} />
      </aside>

      <NewDmDialog open={newDm} onOpenChange={setNewDm} />
      <ChannelDialog open={newChannel} onOpenChange={setNewChannel} />
      <BrowseChannelsDialog open={browsing} onOpenChange={setBrowsing} />

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

/** The conversation: its header, and the messages under it. */
function ChannelView({ channelId }: { channelId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const channels = useChannels()
  const channel = (channels.data ?? []).find((row) => row.id === channelId)
  const dmMembers = useChannelMembers(channel?.kind === 'dm' ? [channel.id] : [])

  // "Delete any chat message (non-DM)" (§2.1) — the same rule the database
  // enforces in `can_moderate_channel()`, asked here only to decide what to
  // put on screen.
  const { canPublishIn } = usePublishScope()
  const canModerate = Boolean(
    channel && channel.kind !== 'dm' && canPublishIn(channel.gym_id),
  )

  // One subscription for the channel: the messages and who is typing.
  const { typing, startTyping } = useChannelLive(channelId)
  const setMuted = useSetChannelMuted()
  const leave = useLeaveChannel()
  const remove = useDeleteChannel()
  const navigate = useNavigate()

  const [members, setMembers] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // The three things only a custom channel has: a member list to manage, a
  // name to change, and a door out. A gym channel's roster is the gym's
  // (P6-02) and a DM has no membership to manage at all.
  const isCustom = channel?.kind === 'custom'

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
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{name}</h1>
          {channel?.description && (
            <p className="text-muted-foreground truncate text-sm">
              {channel.description}
            </p>
          )}
        </div>

        {isCustom && channel && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('chat.members')}
            onClick={() => setMembers(true)}
          >
            <Users className="size-4" aria-hidden="true" />
          </Button>
        )}

        {isCustom && canModerate && (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('chat.editChannel')}
              onClick={() => setEditing(true)}
            >
              <Settings className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('chat.deleteChannel')}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </>
        )}

        {isCustom && channel && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('chat.leave')}
            disabled={leave.isPending}
            onClick={() =>
              leave.mutate(channel.id, { onSuccess: () => void navigate('/chat') })
            }
          >
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        )}

        {/* The mute switch the channel list has been marking since P6-03. */}
        {channel && (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={channel.muted}
            aria-label={channel.muted ? t('chat.unmute') : t('chat.mute')}
            disabled={setMuted.isPending}
            onClick={() =>
              setMuted.mutate({ channelId: channel.id, muted: !channel.muted })
            }
          >
            {channel.muted ? (
              <BellOff className="size-4" aria-hidden="true" />
            ) : (
              <Bell className="size-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </header>

      {isCustom && channel && (
        <>
          <ChannelMembersDialog
            channel={channel}
            canModerate={canModerate}
            open={members}
            onOpenChange={setMembers}
          />
          <ChannelDialog channel={channel} open={editing} onOpenChange={setEditing} />

          {/* A dialog rather than `window.confirm`: it is translated, and a
              browser modal would block the app (as news does it). Deleting a
              channel takes every message in it. */}
          <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('chat.deleteChannel')}</DialogTitle>
                <DialogDescription>{t('chat.deleteChannelHint')}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  {t('chat.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(channel.id, {
                      onSuccess: () => void navigate('/chat'),
                    })
                  }
                >
                  {t('chat.delete')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {channel && <MessageList channel={channel} canModerate={canModerate} />}

      {typing.length > 0 && (
        <p aria-live="polite" className="text-muted-foreground px-4 text-xs">
          {t('chat.typing', { names: typing.join(', '), count: typing.length })}
        </p>
      )}

      {channel && <Composer channelId={channel.id} onTyping={startTyping} />}
    </>
  )
}
