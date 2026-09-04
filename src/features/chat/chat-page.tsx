import {
  ArrowLeft,
  BellOff,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Settings,
  SquarePen,
  Trash2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmDialog, EmptyState } from '@/components'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { mentionsAssistant, useAssistantReply } from '@/features/assistant'
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
          'min-h-0 flex-1 overflow-y-auto md:w-72 md:flex-none md:border-r',
          'pb-(--nav-bar-clearance) md:pb-0',
          channelId && 'hidden md:block',
        )}
      >
        <div className="grid gap-2 p-3 pb-0">
          <Button variant="outline" className="w-full" onClick={() => setNewDm(true)}>
            <SquarePen className="size-4" aria-hidden="true" />
            {t('chat.newDm')}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="min-w-0 flex-1 px-2"
              onClick={() => setBrowsing(true)}
            >
              {t('chat.browse')}
            </Button>
            {/* Creating a channel is `can_publish_content()` (spec §2.1): a
                manager in their gyms, an admin anywhere, staff never. */}
            {canPublishSomewhere && (
              <Button
                variant="ghost"
                className="min-w-0 flex-1 px-2"
                onClick={() => setNewChannel(true)}
              >
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
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          !channelId && 'hidden md:flex',
        )}
      >
        {channelId ? (
          // Keyed, so a channel's draft and read marker start fresh with it.
          <ChannelView key={channelId} channelId={channelId} />
        ) : (
          <EmptyState
            icon={MessageCircle}
            title={t('chat.pickChannel')}
            as="h1"
            className="m-6"
          />
        )}
      </section>
    </div>
  )
}

/** The conversation: its header, and the messages under it. */
function ChannelView({ channelId }: { channelId: string }) {
  const { t, i18n } = useTranslation()
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
  const { typing, startTyping, live } = useChannelLive(channelId)
  // A message that names the assistant is answered by its sender's own call
  // (P8-05); the reply comes back through the subscription above.
  const reply = useAssistantReply()
  const setMuted = useSetChannelMuted()
  const leave = useLeaveChannel()
  const remove = useDeleteChannel()
  const navigate = useNavigate()

  const [members, setMembers] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingLeave, setConfirmingLeave] = useState(false)

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
          className="hover:bg-accent/60 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 md:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <span className="truncate">{name}</span>
            {channel?.muted && (
              <>
                <BellOff
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="sr-only">{t('chat.muted')}</span>
              </>
            )}
          </h1>
          {channel?.description && (
            <p className="text-muted-foreground truncate text-sm">
              {channel.description}
            </p>
          )}
        </div>

        {/* One menu for everything about the channel: what it offers depends
            on its kind. A gym channel's roster is the gym's (P6-02) and is
            read here; only a custom one has members to manage, a name to
            change and a door out; a DM has none of those. */}
        {channel && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('chat.channelMenu')}>
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {channel.kind !== 'dm' && (
                <DropdownMenuItem onSelect={() => setMembers(true)}>
                  <Users aria-hidden="true" />
                  {t('chat.members')}
                </DropdownMenuItem>
              )}
              {/* The mute switch the channel list has been marking since P6-03. */}
              <DropdownMenuCheckboxItem
                checked={channel.muted}
                disabled={setMuted.isPending}
                onCheckedChange={(muted) =>
                  setMuted.mutate(
                    { channelId: channel.id, muted: muted === true },
                    { onError: () => toast.error(t('chat.saveFailed')) },
                  )
                }
              >
                {t('chat.muted')}
              </DropdownMenuCheckboxItem>
              {isCustom && canModerate && (
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Settings aria-hidden="true" />
                  {t('chat.editChannel')}
                </DropdownMenuItem>
              )}
              {isCustom && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setConfirmingLeave(true)}>
                    <LogOut aria-hidden="true" />
                    {t('chat.leave')}
                  </DropdownMenuItem>
                  {canModerate && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setConfirmingDelete(true)}
                    >
                      <Trash2 aria-hidden="true" />
                      {t('chat.deleteChannel')}
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {channel && channel.kind !== 'dm' && (
        <ChannelMembersDialog
          channel={channel}
          canModerate={isCustom && canModerate}
          open={members}
          onOpenChange={setMembers}
        />
      )}

      {isCustom && channel && (
        <>
          <ChannelDialog channel={channel} open={editing} onOpenChange={setEditing} />

          {/* Deleting a channel takes every message in it. */}
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={t('chat.deleteChannel')}
            body={t('chat.deleteChannelHint')}
            confirmLabel={t('chat.delete')}
            pending={remove.isPending}
            error={remove.isError ? t('chat.deleteFailed') : undefined}
            onConfirm={() =>
              remove.mutate(channel.id, {
                onSuccess: () => {
                  toast.success(t('chat.channelDeleted'))
                  void navigate('/chat')
                },
              })
            }
          />
          <ConfirmDialog
            open={confirmingLeave}
            onOpenChange={setConfirmingLeave}
            title={t('chat.leaveConfirm')}
            body={t('chat.leaveDescription')}
            confirmLabel={t('chat.leave')}
            pending={leave.isPending}
            error={leave.isError ? t('chat.leaveFailed') : undefined}
            onConfirm={() =>
              leave.mutate(channel.id, {
                onSuccess: () => {
                  toast.success(t('chat.left'))
                  void navigate('/chat')
                },
              })
            }
          />
        </>
      )}

      {channel && <MessageList channel={channel} canModerate={canModerate} />}

      {/* One reserved line between the list and the box, so what it says
          never moves the box under a thumb. */}
      <div className="min-h-6 px-4 text-sm">
        {!live ? (
          <p role="status" className="text-muted-foreground">
            {t('chat.notLive')}
          </p>
        ) : reply.isError ? (
          <p role="alert" className="text-destructive">
            {t(
              reply.error.problem === 'cap_reached'
                ? 'chat.assistantCapReached'
                : reply.error.problem === 'not_configured'
                  ? 'chat.assistantNotConfigured'
                  : 'chat.assistantFailed',
            )}
          </p>
        ) : reply.isPending ? (
          <p role="status" className="text-muted-foreground">
            {t('chat.assistantAnswering')}
          </p>
        ) : typing.length > 0 ? (
          <p aria-live="polite" className="text-muted-foreground">
            {t('chat.typing', {
              names: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
                typing,
              ),
              count: typing.length,
            })}
          </p>
        ) : null}
      </div>
      {channel && (
        <Composer
          channelId={channel.id}
          onTyping={startTyping}
          onSent={(messageId, body) => {
            if (mentionsAssistant(body))
              reply.mutate({ channelId: channel.id, messageId })
          }}
        />
      )}
    </>
  )
}
