import { Paperclip, Reply, Send, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { assistantHandle } from '@/features/assistant'
import { useAuth, useProfile } from '@/features/auth'
import { cn } from '@/lib/utils'
import {
  useChannelMembers,
  useSendMessage,
  type ChannelMember,
  type QuotedMessage,
} from './queries'
import { firstLine, speakerName } from './speaker'

/** What a colleague is called in the member list and in an @mention. */
const memberName = (member: ChannelMember) => member.full_name?.trim() || member.email

/** The most a file may weigh; storage takes more, a phone on gym wifi does not. */
export const maxFileBytes = 10 * 1024 * 1024

/**
 * What was typed and not yet sent, per channel. Somebody interrupted
 * mid-sentence who taps another channel (or whose phone reloads the tab) and
 * comes back finds it still there; it lives as long as the tab does. Storage
 * can be refused (private mode, a full quota), and then the draft simply
 * lives as long as the box.
 */
const drafts = {
  key: (channelId: string) => `chat-draft:${channelId}`,
  get(channelId: string): string {
    try {
      return sessionStorage.getItem(this.key(channelId)) ?? ''
    } catch {
      return ''
    }
  },
  set(channelId: string, text: string) {
    try {
      if (text) sessionStorage.setItem(this.key(channelId), text)
      else sessionStorage.removeItem(this.key(channelId))
    } catch {
      // Nothing to do: the draft stays in state.
    }
  },
}

/**
 * The assistant sits in the list beside the colleagues (P8-05), but it is a
 * handle, not a person: it is never sent as a mention, and it is answered by
 * `onSent`, not by the notification trigger.
 */
const assistant: ChannelMember = {
  channel_id: '',
  user_id: assistantHandle,
  full_name: assistantHandle,
  email: '',
}
const isAssistant = (member: ChannelMember) => member === assistant

/**
 * The picture itself for an image about to go, so a photo of the wrong wall
 * is caught before the whole gym sees it; a paperclip for anything else.
 */
function Thumbnail({ file }: { file: File }) {
  // Keyed by the file in the list above, so one URL per chip for its life.
  const [url] = useState(() =>
    file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  )

  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  if (!url)
    return (
      <span className="flex size-8 items-center justify-center">
        <Paperclip className="size-4" aria-hidden="true" />
      </span>
    )
  return <img src={url} alt="" className="size-8 rounded-full object-cover" />
}

/** The partial @name immediately before the caret, if there is one. */
function mentionQuery(text: string, caret: number): string | null {
  const match = /@([\p{L}\p{N}_.-]*)$/u.exec(text.slice(0, caret))
  return match?.[1] ?? null
}

/**
 * Whether Enter sends. With a mouse or trackpad it does, and shift+Enter
 * starts a line, which is what everybody's fingers expect from a chat box. A
 * phone keyboard has no shift+Enter, so there Enter starts a line and the
 * button sends: a two-line handover must not go out as two half-messages.
 */
function enterSends(): boolean {
  return (
    typeof window.matchMedia !== 'function' ||
    window.matchMedia('(pointer: fine)').matches
  )
}

/**
 * Saying something: the text, the people it names, and the files that go with
 * it.
 */
export function Composer({
  channelId,
  onTyping,
  onSent,
  replyTo = null,
  onCancelReply,
}: {
  channelId: string
  onTyping: (name: string) => void
  /** The message is in the channel; what was sent, in case it asks for more. */
  onSent?: (messageId: string, body: string) => void
  /** The line being answered, shown above the box until sent or dropped. */
  replyTo?: QuotedMessage | null
  onCancelReply?: () => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const send = useSendMessage(channelId)
  const members = useChannelMembers([channelId])

  const [body, setBody] = useState(() => drafts.get(channelId))
  // The people picked from the list. A name typed by hand is a string; only
  // a pick is a person, and only a pick still named in the text is sent.
  const [picked, setPicked] = useState<ChannelMember[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [tooBig, setTooBig] = useState<string | null>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [sendOnEnter] = useState(enterSends)
  const box = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Choosing a line to answer is choosing to type. On the next tick: the
  // menu the choice was made in hands focus back to its trigger as it closes.
  useEffect(() => {
    if (!replyTo) return
    const timer = window.setTimeout(() => box.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [replyTo])

  const others = (members.data ?? []).filter((member) => member.user_id !== user?.id)
  const suggestions =
    query === null
      ? []
      : [
          ...(assistantHandle.startsWith(query.toLowerCase()) ? [assistant] : []),
          ...others.filter((member) =>
            memberName(member).toLowerCase().includes(query.toLowerCase()),
          ),
        ].slice(0, 5)
  const listOpen = suggestions.length > 0

  const myName = profile?.full_name?.trim() || user?.email || ''

  const change = (text: string, caret: number) => {
    setBody(text)
    drafts.set(channelId, text)
    setQuery(mentionQuery(text, caret))
    setActive(0)
    if (text) onTyping(myName)
  }

  const choose = (member: ChannelMember) => {
    const caret = box.current?.selectionStart ?? body.length
    const before = body.slice(0, caret).replace(/@[\p{L}\p{N}_.-]*$/u, '')
    const next = `${before}@${memberName(member)} ${body.slice(caret)}`

    setBody(next)
    drafts.set(channelId, next)
    setQuery(null)
    if (!isAssistant(member))
      setPicked((already) =>
        already.some((one) => one.user_id === member.user_id)
          ? already
          : [...already, member],
      )
    box.current?.focus()
  }

  const canSend = Boolean(body.trim()) || files.length > 0

  const submit = () => {
    const text = body.trim()
    if (!canSend) return

    // Only the people picked and still named in what is actually being sent
    // are carried (P6-08 notifies them).
    const mentions = picked
      .filter((member) => text.includes(`@${memberName(member)}`))
      .map((member) => member.user_id)

    // The box empties the moment the line is in the stream; what happens to
    // it from here is told there (a clock, then the time, or "Not sent").
    setBody('')
    setFiles([])
    setPicked([])
    drafts.set(channelId, '')
    onCancelReply?.()
    send.mutate(
      { body: text, mentions, files, replyTo },
      { onSuccess: (messageId) => onSent?.(messageId, text) },
    )
  }

  const key = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (listOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : suggestions.length - 1
        setActive((index) => (index + step) % suggestions.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const member = suggestions[active]
        if (member) choose(member)
        return
      }
      if (event.key === 'Escape') {
        setQuery(null)
        return
      }
    }

    if (event.key === 'Escape' && replyTo) {
      onCancelReply?.()
      return
    }

    if (sendOnEnter && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const pick = (chosen: File[]) => {
    const heavy = chosen.find((file) => file.size > maxFileBytes)
    setTooBig(heavy?.name ?? null)
    const fitting = chosen.filter((file) => file.size <= maxFileBytes)
    if (fitting.length > 0) setFiles((already) => [...already, ...fitting])
  }

  return (
    <form
      className="relative border-t p-3 pb-(--nav-bar-clearance) md:pb-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('chat.mentionSomebody')}
          className="bg-popover animate-in fade-in-0 zoom-in-95 absolute bottom-full left-3 mb-1 w-64 origin-bottom-left rounded-xl border p-1 shadow-lg duration-150 ease-out"
        >
          {suggestions.map((member, index) => (
            <li
              key={member.user_id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={cn(
                'min-h-11 cursor-default rounded-lg px-3 py-2.5 text-sm transition-colors duration-150',
                index === active
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/60',
              )}
              onMouseDown={(event) => {
                event.preventDefault()
                choose(member)
              }}
            >
              {isAssistant(member) ? (
                <>
                  @{assistantHandle}
                  <span className="text-muted-foreground">
                    {' '}
                    · {t('chat.askAssistant')}
                  </span>
                </>
              ) : (
                memberName(member)
              )}
            </li>
          ))}
        </ul>
      )}

      {replyTo && (
        <div className="bg-muted mb-2 flex min-h-11 items-center gap-2 rounded-xl pl-3 text-sm">
          <Reply className="size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">
              {t('chat.replyingTo', { name: speakerName(replyTo, user?.id, t) })}
            </p>
            <p className="text-muted-foreground truncate">
              {replyTo.deleted_at ? t('chat.deletedMessage') : firstLine(replyTo.body)}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('chat.cancelReply')}
            className="hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
            onClick={onCancelReply}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2 pb-2">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="bg-muted flex min-h-11 items-center gap-2 rounded-full pl-1.5 text-sm has-[img]:pl-1"
            >
              <Thumbnail file={file} />
              <span className="max-w-48 truncate">{file.name}</span>
              <button
                type="button"
                aria-label={t('chat.removeFile', { name: file.name })}
                className="hover:bg-accent flex size-11 items-center justify-center rounded-full transition-colors duration-150"
                onClick={() => setFiles((chosen) => chosen.filter((one) => one !== file))}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          data-testid="chat-files"
          onChange={(event) => {
            // Read before the input is cleared: a state updater runs at the
            // next render, by which time `event.target.files` is empty.
            pick([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('chat.attach')}
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip className="size-4" aria-hidden="true" />
        </Button>

        <Textarea
          ref={box}
          aria-label={t('chat.write')}
          placeholder={t('chat.write')}
          rows={1}
          className="max-h-32 min-h-11 flex-1 resize-none py-2.5"
          value={body}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-activedescendant={listOpen ? `${listId}-${active}` : undefined}
          onChange={(event) => change(event.target.value, event.target.selectionStart)}
          onKeyDown={key}
        />

        <Button
          type="submit"
          size="icon"
          // Quiet until there is something to send: a violet button that
          // cannot be pressed is a promise the box is not keeping.
          variant={canSend ? 'default' : 'secondary'}
          aria-label={t('chat.send')}
          disabled={!canSend}
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {tooBig && (
        <p role="alert" className="text-destructive pt-1 text-sm">
          {t('chat.fileTooBig', { name: tooBig })}
        </p>
      )}
    </form>
  )
}
