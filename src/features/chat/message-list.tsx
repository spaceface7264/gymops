import { ArrowDown, Clock, MessageCircle, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Markdown,
  UnreadCount,
} from '@/components'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
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
  useMessageScrollerVisibility,
} from '@/components/ui/message-scroller'
import { useAuth } from '@/features/auth'
import { cn } from '@/lib/utils'
import { Attachments } from './attachments'
import {
  useChannelMembers,
  useDeleteMessage,
  useMarkChannelRead,
  useMessages,
  type Channel,
  type Message,
} from './queries'

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
}: {
  channel: Channel
  canModerate: boolean
}) {
  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="end"
      scrollEdgeThreshold={followPx}
    >
      <Transcript channel={channel} canModerate={canModerate} />
    </MessageScrollerProvider>
  )
}

function Transcript({
  channel,
  canModerate,
}: {
  channel: Channel
  canModerate: boolean
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const messages = useMessages(channel.id)
  const { scrollToEnd, scrollToMessage } = useMessageScroller()
  const { visibleMessageIds } = useMessageScrollerVisibility()
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

  // How many unread lines sit below what is on screen: the badge on the way
  // down. Counted only when the first unread line is neither on screen nor
  // above it.
  const firstUnreadIndex = rows.findIndex((message) => message.id === firstUnread)
  const lastVisibleIndex = rows.reduce(
    (last, message, index) => (visibleMessageIds.includes(message.id) ? index : last),
    -1,
  )
  const unreadBelow =
    firstUnreadIndex > lastVisibleIndex && lastVisibleIndex >= 0
      ? rows.length - firstUnreadIndex
      : 0

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
    <MessageScroller className="min-h-0 flex-1">
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
      <MessageScrollerButton>
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
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // On a phone the trash can is hidden until the bubble is tapped: a thumb
  // has no hover, and a 44 px destructive target beside every own line was
  // the loudest thing on the screen.
  const [revealed, setRevealed] = useState(false)

  const remove = useDeleteMessage(channelId)

  const mine = message.created_by === user?.id
  const author = message.from_assistant
    ? t('chat.assistant')
    : mine
      ? t('chat.you')
      : message.author?.full_name?.trim() || message.author?.email || t('chat.someone')
  const when = new Date(message.created_at).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const namesMe = Boolean(user && message.mentions.includes(user.id))
  const canDelete = !message.deleted_at && !message.pending && (mine || canModerate)

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

  const deleteButton = canDelete && (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('chat.delete')}
      onClick={() => setConfirmingDelete(true)}
      className={cn(
        'text-muted-foreground hover:text-destructive self-center',
        // Hidden and untouchable until the line is tapped, hovered or
        // focused; an invisible target is still a target.
        'pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100',
        revealed && 'pointer-events-auto opacity-100',
      )}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </Button>
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
        <MarkerContent className="bg-tone-new-bg text-tone-new-fg rounded-full px-3 py-1 text-xs font-semibold">
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
      {message.pending ? (
        <Clock className="size-3" aria-hidden="true" />
      ) : (
        <time dateTime={message.created_at}>{when}</time>
      )}
    </span>
  )

  return (
    <>
      {newRule}
      <li
        className={cn('group', continued ? 'mt-0.5' : 'mt-2')}
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
                  onClick={canDelete ? () => setRevealed((open) => !open) : undefined}
                >
                  <BubbleContent
                    className={cn(
                      'py-1.5',
                      !continued && (mine ? 'rounded-tr-md' : 'rounded-tl-md'),
                    )}
                  >
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
                </Bubble>
                {deleteButton}
              </div>
            </MessageContent>
          </MessageRowFrame>
        </MessageScrollerItem>
        {confirm}
      </li>
    </>
  )
}
