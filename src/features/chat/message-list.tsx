import {
  ArrowDown,
  ChevronDown,
  Clock,
  Copy,
  MessageCircle,
  Reply,
  RotateCcw,
  SmilePlus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Markdown,
  UnreadCount,
} from '@/components'
import { Bubble, BubbleContent, BubbleReactions } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Marker, MarkerContent } from '@/components/ui/marker'
import { Message as MessageRowFrame, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller'
import { useAuth } from '@/features/auth'
import { cn } from '@/lib/utils'
import { Attachments } from './attachments'
import {
  reactionEmojis,
  useChannelMembers,
  useDeleteMessage,
  useForgetFailed,
  useMarkChannelRead,
  useMessages,
  useSendMessage,
  useToggleReaction,
  type Channel,
  type Message,
  type QuotedMessage,
  type ReactionEmoji,
} from './queries'
import { firstLine, personName, speakerName } from './speaker'

/** Lines by the same person this close together share one name and time. */
const groupMinutes = 5
/** Within this distance of the bottom, somebody is reading the latest. */
const followPx = 100

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** Who a message counts as, for grouping: a person, or the assistant. */
const speaker = (message: Message) =>
  message.from_assistant ? 'assistant' : (message.created_by ?? 'unknown')

/**
 * One channel's conversation, oldest at the bottom, cut into days. The pages
 * arrive newest-first and are turned round here, so "load older" adds to the
 * top without moving what somebody is reading.
 *
 * The transcript follows the newest line only while the reader is at the
 * bottom; scrolled up to read, they are left where they are with a way down.
 * Every channel reads as bubbles, one side each, the way staff already talk
 * on their phones: the side says who, so only somebody else's line carries a
 * name.
 */
export function MessageList({
  channel,
  canModerate,
  onReply,
}: {
  channel: Channel
  canModerate: boolean
  /** Somebody chose to answer this line; the composer takes it from here. */
  onReply: (quoted: QuotedMessage) => void
}) {
  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="end"
      scrollEdgeThreshold={followPx}
    >
      <Transcript channel={channel} canModerate={canModerate} onReply={onReply} />
    </MessageScrollerProvider>
  )
}

function Transcript({
  channel,
  canModerate,
  onReply,
}: {
  channel: Channel
  canModerate: boolean
  onReply: (quoted: QuotedMessage) => void
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const messages = useMessages(channel.id)
  const { scrollToEnd, scrollToMessage } = useMessageScroller()
  // The last line whose top is inside the box: what the reader has reached.
  // Measured from the DOM on every scroll and whenever the rows change (the
  // scroller's own visibility store only tracks anchored items).
  const root = useRef<HTMLDivElement>(null)
  const [lastVisibleId, setLastVisibleId] = useState<string | null>(null)
  // The names an @ in a line can be set in the accent: the channel's people.
  const members = useChannelMembers([channel.id])
  const memberNames = new Map(
    (members.data ?? []).map((member) => [
      member.user_id,
      member.full_name?.trim() || member.email,
    ]),
  )

  const markRead = useMarkChannelRead()
  const mark = markRead.mutate

  // Where this person had read to when they opened the channel. Taken once:
  // read live it would move the "New" line the moment `mark` below runs.
  const [readUpTo] = useState(() => new Date(channel.last_read_at).getTime())
  const opened = useRef(false)

  const pages = messages.data?.pages ?? []

  // A page refetched while somebody is reading can overlap the next one, so
  // the cursor's own row is not counted twice.
  const seen = new Set<string>()
  const rows = pages
    .flat()
    .filter((message) => !seen.has(message.id) && seen.add(message.id))
    .reverse()

  const newest = rows.at(-1)
  const newestId = newest?.id
  const newestMine = newest?.created_by === user?.id

  // The first line said since they last read, by somebody else.
  const firstUnread = rows.find(
    (message) =>
      new Date(message.created_at).getTime() > readUpTo &&
      message.created_by !== user?.id,
  )?.id

  // How many lines somebody else said, that this person had not read when
  // they opened the channel, sit below what is on screen: the badge on the
  // way down.
  const lastVisibleIndex = rows.findIndex((message) => message.id === lastVisibleId)
  const unreadBelow =
    lastVisibleIndex < 0
      ? 0
      : rows
          .slice(lastVisibleIndex + 1)
          .filter(
            (message) =>
              !message.deleted_at &&
              message.created_by !== user?.id &&
              new Date(message.created_at).getTime() > readUpTo,
          ).length

  useEffect(() => {
    const box = root.current?.querySelector<HTMLElement>(
      '[data-slot=message-scroller-viewport]',
    )
    if (!box) return
    const measure = () => {
      const bottom = box.getBoundingClientRect().bottom
      let last: string | null = null
      for (const item of box.querySelectorAll<HTMLElement>('[data-message-id]')) {
        if (item.getBoundingClientRect().top < bottom)
          last = item.dataset.messageId ?? last
        else break
      }
      setLastVisibleId(last)
    }
    measure()
    box.addEventListener('scroll', measure, { passive: true })
    return () => box.removeEventListener('scroll', measure)
  }, [newestId, rows.length])

  // Opening the channel lands on the "New" line when there is one (the
  // scroller's own default is the end). After that the scroller follows only
  // while the reader is at the bottom; their own new line always goes there.
  useEffect(() => {
    if (!newestId) return
    if (!opened.current) {
      opened.current = true
      // `nearest`, not `start`: aligning to the top pads the transcript with
      // the scroller's spacer, and a chat with blank space under its last
      // line looks broken. The margin keeps the rule above the line in view.
      if (firstUnread)
        scrollToMessage(firstUnread, { align: 'nearest', scrollMargin: 48 })
      return
    }
    if (newestMine) scrollToEnd()
  }, [newestId, newestMine, firstUnread, scrollToEnd, scrollToMessage])

  // Going to a quoted line. The scroller says whether it found it; when it did
  // not, the line is on a page not loaded yet, so older pages are fetched and
  // the jump tried again once they have rendered, a few times at most.
  const jump = useRef<{ id: string; tried: number } | null>(null)
  const tryJump = useCallback(() => {
    const target = jump.current
    if (!target) return
    if (scrollToMessage(target.id, { align: 'nearest', scrollMargin: 48 })) {
      jump.current = null
      return
    }
    if (messages.isFetchingNextPage) return
    if (messages.hasNextPage && target.tried < 5) {
      target.tried += 1
      void messages.fetchNextPage()
      return
    }
    jump.current = null
    toast.info(t('chat.quotedNotLoaded'))
  }, [messages, scrollToMessage, t])
  useEffect(() => {
    tryJump()
  }, [rows.length, tryJump])

  // Having a channel open is reading it — including whatever arrives while it
  // is open, which is why this follows the newest message and not just the
  // channel. Without it a badge appears for a line already on screen.
  useEffect(() => {
    mark(channel.id)
  }, [channel.id, newestId, mark])

  if (messages.isError) {
    return (
      <p role="alert" className="text-destructive p-4 text-sm">
        {t('chat.loadMessagesFail')}
      </p>
    )
  }

  // Cut into days, so each gets a heading a reader (or a screen reader) can
  // find "today" by.
  const days: { key: string; date: Date; rows: Message[] }[] = []
  for (const message of rows) {
    const date = new Date(message.created_at)
    const last = days.at(-1)
    if (last && sameDay(last.date, date)) last.rows.push(message)
    else days.push({ key: message.id, date, rows: [message] })
  }

  const dayLabel = (date: Date) => {
    const today = new Date()
    if (sameDay(date, today)) return t('chat.today')
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (sameDay(date, yesterday)) return t('chat.yesterday')
    return date.toLocaleDateString(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    })
  }

  return (
    <MessageScroller
      ref={root}
      className="min-h-0 flex-1"
      data-last-visible={lastVisibleId ?? undefined}
    >
      <MessageScrollerViewport preserveScrollOnPrepend className="px-4 pt-4 pb-3">
        <MessageScrollerContent>
          {messages.hasNextPage && (
            <div className="pb-3 text-center">
              <Button
                variant="outline"
                onClick={() => void messages.fetchNextPage()}
                disabled={messages.isFetchingNextPage}
              >
                {messages.isFetchingNextPage
                  ? t('chat.loadingOlder')
                  : t('chat.loadOlder')}
              </Button>
            </div>
          )}

          {messages.isPending && <LoadingState rows={5} />}

          {!messages.isPending && rows.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title={t('chat.noMessages')}
              body={t('chat.noMessagesHint')}
            />
          )}

          {days.map((day) => (
            <section key={day.key} aria-label={dayLabel(day.date)}>
              <Marker asChild className="justify-center py-3">
                <h2>
                  <MarkerContent className="bg-card rounded-full border px-3 py-1 text-xs font-medium">
                    {dayLabel(day.date)}
                  </MarkerContent>
                </h2>
              </Marker>
              <ol>
                {day.rows.map((message, index) => {
                  const previous = day.rows[index - 1]
                  const continued =
                    previous !== undefined &&
                    !previous.deleted_at &&
                    speaker(previous) === speaker(message) &&
                    new Date(message.created_at).getTime() -
                      new Date(previous.created_at).getTime() <
                      groupMinutes * 60_000
                  return (
                    <MessageRow
                      key={message.id}
                      channelId={channel.id}
                      message={message}
                      mentionNames={message.mentions
                        .map((id) => memberNames.get(id))
                        .filter((name): name is string => Boolean(name))}
                      continued={continued}
                      unreadFrom={message.id === firstUnread}
                      canModerate={canModerate}
                      onReply={onReply}
                      onJump={(id) => {
                        jump.current = { id, tried: 0 }
                        tryJump()
                      }}
                    />
                  )
                })}
              </ol>
            </section>
          ))}
        </MessageScrollerContent>
      </MessageScrollerViewport>

      {/* Sits bottom right while the reader is further up, with what is
          still unread below them. */}
      <MessageScrollerButton data-unread-below={unreadBelow}>
        <ArrowDown className="size-4" aria-hidden="true" />
        <span className="sr-only">{t('chat.jumpToLatest')}</span>
        <UnreadCount
          count={unreadBelow}
          className="absolute -top-1.5 -right-1.5"
          aria-label={t('chat.unread', { count: unreadBelow })}
        />
      </MessageScrollerButton>
    </MessageScroller>
  )
}

function MessageRow({
  channelId,
  message,
  mentionNames,
  continued,
  unreadFrom,
  canModerate,
  onReply,
  onJump,
}: {
  channelId: string
  message: Message
  /** The people this line names, as their names appear after an @. */
  mentionNames: string[]
  /** Follows a line by the same person moments ago: no name or time again. */
  continued: boolean
  /** The first line said since this person last read. */
  unreadFrom: boolean
  canModerate: boolean
  onReply: (quoted: QuotedMessage) => void
  onJump: (id: string) => void
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showingReactions, setShowingReactions] = useState(false)
  const [picking, setPicking] = useState(false)
  // On a phone the menu is hidden until the bubble is tapped: a thumb has no
  // hover, and a 44 px control beside every line was the loudest thing on
  // the screen.
  const [revealed, setRevealed] = useState(false)
  // Reply hands the focus to the box; the menu must not take it back to its
  // trigger as it closes.
  const handedOff = useRef(false)

  const remove = useDeleteMessage(channelId)
  const resend = useSendMessage(channelId)
  const forgetFailed = useForgetFailed(channelId)
  const react = useToggleReaction(channelId)

  const mine = message.created_by === user?.id
  const author = speakerName(message, user?.id, t)
  const when = new Date(message.created_at).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const namesMe = Boolean(user && message.mentions.includes(user.id))
  // Nothing to answer, copy or react to on a line that is gone or not yet
  // there; the failed line has its own Try again.
  const hasMenu = !message.deleted_at && !message.pending && !message.failed
  const canDelete = hasMenu && (mine || canModerate)

  const copy = () => {
    if (!navigator.clipboard) {
      toast.error(t('chat.copyFailed'))
      return
    }
    navigator.clipboard.writeText(message.body).then(
      () => toast.success(t('chat.copied')),
      () => toast.error(t('chat.copyFailed')),
    )
  }

  const reactedByMe = (emoji: string) =>
    message.message_reactions.some((r) => r.user_id === user?.id && r.emoji === emoji)

  // The four, in a fixed order, with who is behind each count.
  const reactionGroups = reactionEmojis
    .map((emoji) => ({
      emoji,
      reactors: message.message_reactions.filter((r) => r.emoji === emoji),
    }))
    .filter((group) => group.reactors.length > 0)

  const body = message.deleted_at ? (
    <p className="text-muted-foreground text-sm italic">{t('chat.deletedMessage')}</p>
  ) : (
    <>
      <Markdown body={message.body} mentions={mentionNames} />
      {message.pending ? (
        message.message_attachments.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {message.message_attachments.map((file) => file.file_name).join(', ')}
          </p>
        )
      ) : (
        <Attachments attachments={message.message_attachments} />
      )}
      {message.pending && (
        <span className="sr-only" role="status">
          {t('chat.sending')}
        </span>
      )}
    </>
  )

  // One menu per line: what everybody may do (answer, react, copy), then
  // what this person may take away. The trigger is a chevron in the bubble's
  // top corner over a fade of the bubble's own colour, the way the phone apps
  // do it. Hidden and untouchable until the line is tapped, hovered or
  // focused; kept up while open, because Radix moves the focus into the
  // portal.
  const menu = hasMenu && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('chat.messageMenu')}
          className={cn(
            // Inside the bubble's 1 px edge, so the stroke stays; the fade is
            // short, so the name under it stays readable.
            'text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-px right-px flex h-8 w-11 items-center justify-end rounded-tr-[15px] rounded-bl-full pr-1.5 transition-[opacity,color] duration-150 outline-none focus-visible:ring-[3px]',
            mine
              ? 'bg-[linear-gradient(to_right,transparent,var(--bubble-own)_55%)]'
              : 'bg-[linear-gradient(to_right,transparent,var(--card)_55%)]',
            'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100',
            'data-[state=open]:pointer-events-auto data-[state=open]:opacity-100',
            revealed && 'pointer-events-auto opacity-100',
          )}
        >
          <ChevronDown className="size-5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={mine ? 'end' : 'start'}
        className="w-48"
        onCloseAutoFocus={(event) => {
          if (handedOff.current) {
            event.preventDefault()
            handedOff.current = false
          }
        }}
      >
        <DropdownMenuItem
          className="md:min-h-9 md:py-1.5"
          onSelect={() => {
            handedOff.current = true
            onReply(message)
          }}
        >
          <Reply aria-hidden="true" />
          {t('chat.reply')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="md:min-h-9 md:py-1.5"
          onSelect={() => {
            // After this menu has closed and handed focus back.
            window.setTimeout(() => setPicking(true), 0)
          }}
        >
          <SmilePlus aria-hidden="true" />
          {t('chat.react')}
        </DropdownMenuItem>
        <DropdownMenuItem className="md:min-h-9 md:py-1.5" onSelect={copy}>
          <Copy aria-hidden="true" />
          {t('chat.copy')}
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="md:min-h-9 md:py-1.5"
              onSelect={() => setConfirmingDelete(true)}
            >
              <Trash2 aria-hidden="true" />
              {t('chat.delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // The reaction picker: a smiley beside the bubble, revealed like the
  // chevron, that opens the four emoji in a row above it.
  const picker = hasMenu && (
    <DropdownMenu open={picking} onOpenChange={setPicking}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label={t('chat.react')}
          className={cn(
            'text-muted-foreground hover:text-foreground self-center',
            'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100',
            'data-[state=open]:pointer-events-auto data-[state=open]:opacity-100',
            revealed && 'pointer-events-auto opacity-100',
          )}
        >
          <SmilePlus className="size-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align={mine ? 'end' : 'start'}
        sideOffset={6}
        aria-label={t('chat.react')}
        className="flex min-w-0 gap-0.5 rounded-full p-1"
      >
        {reactionEmojis.map((emoji) => {
          const on = reactedByMe(emoji)
          return (
            <DropdownMenuItem
              key={emoji}
              aria-label={t(on ? 'chat.unreact' : 'chat.reactWith', { emoji })}
              aria-pressed={on}
              className={cn(
                'size-11 justify-center rounded-full p-0 text-2xl transition-transform duration-150 hover:scale-110',
                on && 'bg-accent',
              )}
              onSelect={() =>
                react.mutate(
                  { messageId: message.id, emoji, on: !on },
                  { onError: () => toast.error(t('chat.reactionFailed')) },
                )
              }
            >
              <span aria-hidden="true">{emoji}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Who reacted, per emoji: a count on the bubble's edge, the names on tap.
  const reactionTotal = message.message_reactions.length
  const reactions = !message.deleted_at && reactionGroups.length > 0 && (
    <>
      {/* The faces, and one count once there is more than one: the way
          the phone apps say it. Tapping opens who, per emoji. */}
      <BubbleReactions
        side="bottom"
        align={mine ? 'end' : 'start'}
        // The chip arrives with the first reaction; each new face pops in.
        // White, no fill or stroke behind the faces; the ring alone keeps it
        // off the bubble.
        className="bg-card animate-in fade-in-0 zoom-in-75 duration-200 ease-out"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`${t('chat.reactions')}: ${reactionGroups
            .map(({ emoji, reactors }) => `${emoji} ${reactors.length}`)
            .join(', ')}`}
          // A 28 px pill to look at, a 44 px area to hit.
          className="relative flex h-7 items-center gap-1 rounded-full px-2 tabular-nums transition-colors duration-150 after:absolute after:-inset-2 after:content-['']"
          onClick={() => setShowingReactions(true)}
        >
          <span
            aria-hidden="true"
            className="flex items-center gap-0.5 text-base leading-none"
          >
            {reactionGroups.map(({ emoji }) => (
              <span key={emoji} className="animate-reaction-pop inline-block">
                {emoji}
              </span>
            ))}
          </span>
          {reactionTotal > 1 && (
            <span
              aria-hidden="true"
              className="text-muted-foreground text-xs leading-none"
            >
              {reactionTotal}
            </span>
          )}
        </button>
      </BubbleReactions>
      <Dialog open={showingReactions} onOpenChange={setShowingReactions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('chat.reactions')}</DialogTitle>
            <DialogDescription>{t('chat.reactionsHint')}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="all">
            <TabsList aria-label={t('chat.reactions')}>
              <TabsTrigger value="all">
                {t('chat.reactionsAll', { count: reactionTotal })}
              </TabsTrigger>
              {reactionGroups.map(({ emoji, reactors }) => (
                <TabsTrigger key={emoji} value={emoji}>
                  {emoji} {reactors.length}
                </TabsTrigger>
              ))}
            </TabsList>
            {[
              { emoji: 'all', reactors: message.message_reactions },
              ...reactionGroups,
            ].map(({ emoji, reactors }) => (
              <TabsContent key={emoji} value={emoji}>
                <ul className="divide-border divide-y">
                  {reactors.map((r) => {
                    const own = r.user_id === user?.id
                    return (
                      <li key={`${r.user_id}-${r.emoji}`}>
                        {own ? (
                          // Your own: tap to take it away, as on the phone apps.
                          <button
                            type="button"
                            className="hover:bg-accent/60 flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm transition-colors duration-150"
                            onClick={() =>
                              react.mutate(
                                {
                                  messageId: message.id,
                                  emoji: r.emoji as ReactionEmoji,
                                  on: false,
                                },
                                { onError: () => toast.error(t('chat.reactionFailed')) },
                              )
                            }
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{t('chat.you')}</span>
                              <span className="text-muted-foreground block text-xs">
                                {t('chat.removeReactionHint')}
                              </span>
                            </span>
                            <span aria-hidden="true" className="text-xl">
                              {r.emoji}
                            </span>
                          </button>
                        ) : (
                          <div className="flex min-h-11 items-center gap-3 px-2 text-sm">
                            <span className="min-w-0 flex-1 truncate">
                              {personName(r.reactor, t)}
                            </span>
                            <span aria-hidden="true" className="text-xl">
                              {r.emoji}
                            </span>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )

  // The line this one answers, above the words; tapping it goes there.
  const quote = message.quoted && (
    <button
      type="button"
      aria-label={t('chat.jumpToQuoted')}
      className="bg-foreground/5 hover:bg-foreground/10 mb-1 flex min-h-11 w-full flex-col justify-center rounded-lg px-2.5 py-1 text-left transition-colors duration-150"
      onClick={(event) => {
        event.stopPropagation()
        if (message.quoted) onJump(message.quoted.id)
      }}
    >
      <span className="text-accent-foreground text-xs font-semibold">
        {speakerName(message.quoted, user?.id, t)}
      </span>
      <span
        className={cn(
          'truncate text-sm',
          message.quoted.deleted_at && 'text-muted-foreground italic',
        )}
      >
        {message.quoted.deleted_at
          ? t('chat.deletedMessage')
          : firstLine(message.quoted.body)}
      </span>
    </button>
  )

  const confirm = (
    <ConfirmDialog
      open={confirmingDelete}
      onOpenChange={setConfirmingDelete}
      title={t('chat.deleteMessageConfirm')}
      body={t('chat.deleteMessageDescription')}
      confirmLabel={t('chat.delete')}
      pending={remove.isPending}
      error={remove.isError ? t('chat.deleteFailed') : undefined}
      onConfirm={() =>
        remove.mutate(message.id, { onSuccess: () => setConfirmingDelete(false) })
      }
    />
  )

  const newRule = unreadFrom && (
    <li role="separator" aria-label={t('chat.newSince')} className="my-3">
      <Marker
        variant="separator"
        className="before:bg-tone-new-dot after:bg-tone-new-dot"
      >
        <MarkerContent className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold">
          {t('chat.newSince')}
        </MarkerContent>
      </Marker>
    </li>
  )

  // The reader's own lines on the right in the tint, everybody else's on the
  // left in white. As on the phone apps staff already use: the name sits
  // inside the bubble at the top (only on the first of a run, only for
  // somebody else), the time bottom-right inside it, a clock while it goes
  // up, and the first bubble of a run has a squarer corner on its side.
  const stamp = (
    <span className="text-muted-foreground inline-flex shrink-0 items-baseline gap-1 text-[11px] leading-none tabular-nums">
      {namesMe && <span className="sr-only">{t('chat.mentionsYou')}. </span>}
      {message.failed ? (
        <span
          role="alert"
          className="text-tone-danger-fg flex items-center gap-1 font-semibold"
        >
          <span className="bg-tone-danger-dot size-1.5 rounded-full" aria-hidden="true" />
          {t('chat.notSent')}
        </span>
      ) : message.pending ? (
        <Clock className="size-3" aria-hidden="true" />
      ) : (
        <time dateTime={message.created_at}>{when}</time>
      )}
    </span>
  )

  // A line that was refused goes again from the stream, where the sender
  // saw it stop; the failed copy leaves as the new attempt goes in.
  const retryButton = message.failed && (
    <Button
      variant="outline"
      size="icon"
      aria-label={t('chat.retry')}
      className="self-center"
      onClick={() => {
        const again = message.failed
        if (!again) return
        forgetFailed(message.id)
        resend.mutate(again)
      }}
    >
      <RotateCcw className="size-4" aria-hidden="true" />
    </Button>
  )

  return (
    <>
      {newRule}
      <li
        className={cn(
          'group',
          continued ? 'mt-0.5' : 'mt-2',
          // Room for the reactions chip, which hangs off the bubble's edge.
          reactions && 'pb-5',
        )}
        aria-busy={message.pending || undefined}
      >
        <MessageScrollerItem messageId={message.id}>
          <MessageRowFrame align={mine ? 'end' : 'start'}>
            <MessageContent>
              <div className={cn('flex items-end gap-1', mine && 'flex-row-reverse')}>
                <Bubble
                  variant={mine ? 'tinted' : namesMe ? 'highlight' : 'outline'}
                  align={mine ? 'end' : 'start'}
                  className={cn(message.pending && 'opacity-70')}
                  onClick={hasMenu ? () => setRevealed((open) => !open) : undefined}
                >
                  <BubbleContent
                    className={cn(
                      'py-1.5',
                      !continued && (mine ? 'rounded-tr-md' : 'rounded-tl-md'),
                    )}
                  >
                    {quote}
                    {/* Somebody else's name opens the first bubble of their
                        run, in the text colour: the accent is kept for the
                        line that is for the reader. Own and continued lines
                        still say who for a screen reader. */}
                    <span
                      className={cn(
                        'mb-0.5 flex items-center gap-1 text-xs font-semibold',
                        (continued || mine) && 'sr-only',
                      )}
                    >
                      {message.from_assistant && (
                        <Sparkles className="size-3" aria-hidden="true" />
                      )}
                      {author}
                    </span>
                    {/* Last-baseline alignment: the time sits on the text's
                        own baseline, whether it shares the last line or drops
                        under a long one, instead of on the bottom of a line
                        box that carries leading below the letters. */}
                    <div className="flex flex-wrap items-baseline-last justify-end gap-x-3">
                      <div className="min-w-0 flex-1">{body}</div>
                      {stamp}
                    </div>
                  </BubbleContent>
                  {reactions}
                  {menu}
                </Bubble>
                {picker}
                {retryButton}
              </div>
            </MessageContent>
          </MessageRowFrame>
        </MessageScrollerItem>
        {confirm}
      </li>
    </>
  )
}
