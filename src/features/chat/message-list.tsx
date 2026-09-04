import { MessageCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog, EmptyState, LoadingState } from '@/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { Attachments } from './attachments'
import { ChatMarkdown } from './markdown'
import {
  useDeleteMessage,
  useEditMessage,
  useMarkChannelRead,
  useMessages,
  type Channel,
  type Message,
} from './queries'

/**
 * One channel's conversation, oldest at the bottom. The pages arrive
 * newest-first and are turned round here, so "load older" adds to the top
 * without moving what somebody is reading.
 */
export function MessageList({
  channel,
  canModerate,
}: {
  channel: Channel
  canModerate: boolean
}) {
  const { t } = useTranslation()
  const messages = useMessages(channel.id)

  const markRead = useMarkChannelRead()
  const mark = markRead.mutate

  const bottom = useRef<HTMLDivElement>(null)
  const pages = messages.data?.pages ?? []

  // A page refetched while somebody is reading can overlap the next one, so
  // the cursor's own row is not counted twice.
  const seen = new Set<string>()
  const rows = pages
    .flat()
    .filter((message) => !seen.has(message.id) && seen.add(message.id))
    .reverse()

  const newest = rows.at(-1)?.id

  useEffect(() => {
    bottom.current?.scrollIntoView()
  }, [newest])

  // Having a channel open is reading it — including whatever arrives while it
  // is open, which is why this follows the newest message and not just the
  // channel. Without it a badge appears for a line already on screen.
  useEffect(() => {
    mark(channel.id)
  }, [channel.id, newest, mark])

  if (messages.isError) {
    return (
      <p role="alert" className="text-destructive p-4 text-sm">
        {t('chat.loadMessagesFail')}
      </p>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-(--nav-bar-clearance) md:pb-4">
      {messages.hasNextPage && (
        <div className="pb-3 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void messages.fetchNextPage()}
            disabled={messages.isFetchingNextPage}
          >
            {messages.isFetchingNextPage ? t('chat.loadingOlder') : t('chat.loadOlder')}
          </Button>
        </div>
      )}

      {messages.isPending && <LoadingState rows={5} />}

      {!messages.isPending && rows.length === 0 && (
        <EmptyState icon={MessageCircle} title={t('chat.noMessages')} />
      )}

      <ol className="space-y-3">
        {rows.map((message) => (
          <MessageRow
            key={message.id}
            channelId={channel.id}
            message={message}
            canModerate={canModerate}
          />
        ))}
      </ol>

      <div ref={bottom} />
    </div>
  )
}

function MessageRow({
  channelId,
  message,
  canModerate,
}: {
  channelId: string
  message: Message
  canModerate: boolean
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const edit = useEditMessage(channelId)
  const remove = useDeleteMessage(channelId)

  const mine = message.created_by === user?.id
  const author =
    message.author?.full_name?.trim() || message.author?.email || t('chat.someone')
  const when = new Date(message.created_at).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (message.deleted_at) {
    return (
      <li className="text-muted-foreground text-sm italic">{t('chat.deletedMessage')}</li>
    )
  }

  return (
    <li className="group">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{author}</span>
        <time dateTime={message.created_at} className="text-muted-foreground text-xs">
          {when}
        </time>
        {message.edited_at && (
          <span className="text-muted-foreground text-xs">{t('chat.edited')}</span>
        )}
      </div>

      {editing ? (
        <EditForm
          message={message}
          pending={edit.isPending}
          onCancel={() => setEditing(false)}
          onSave={(body) =>
            edit.mutate({ id: message.id, body }, { onSuccess: () => setEditing(false) })
          }
        />
      ) : (
        <>
          <ChatMarkdown body={message.body} />
          <Attachments attachments={message.message_attachments} />
        </>
      )}

      {!editing && (mine || canModerate) && (
        <div className="flex gap-2 pt-1">
          {mine && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {t('chat.edit')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
            {t('chat.delete')}
          </Button>
        </div>
      )}

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
    </li>
  )
}

function EditForm({
  message,
  pending,
  onCancel,
  onSave,
}: {
  message: Message
  pending: boolean
  onCancel: () => void
  onSave: (body: string) => void
}) {
  const { t } = useTranslation()
  const [body, setBody] = useState(message.body)

  return (
    <form
      className="space-y-2 pt-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (body.trim()) onSave(body.trim())
      }}
    >
      <Textarea
        aria-label={t('chat.editMessage')}
        className="text-sm"
        rows={2}
        value={body}
        autoFocus
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {t('chat.save')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('chat.cancel')}
        </Button>
      </div>
    </form>
  )
}
