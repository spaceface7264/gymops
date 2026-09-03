import { Paperclip, SendHorizontal, X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth, useProfile } from '@/features/auth'
import { cn } from '@/lib/utils'
import { useChannelMembers, useSendMessage, type ChannelMember } from './queries'

/** What a colleague is called in the member list and in an @mention. */
const memberName = (member: ChannelMember) => member.full_name?.trim() || member.email

/** The partial @name immediately before the caret, if there is one. */
function mentionQuery(text: string, caret: number): string | null {
  const match = /@([\p{L}\p{N}_.-]*)$/u.exec(text.slice(0, caret))
  return match?.[1] ?? null
}

/**
 * Saying something: the text, the people it names, and the files that go with
 * it. Enter sends and shift+Enter starts a line, which is what everybody's
 * fingers already expect from a chat box.
 */
export function Composer({
  channelId,
  onTyping,
}: {
  channelId: string
  onTyping: (name: string) => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const send = useSendMessage(channelId)
  const members = useChannelMembers([channelId])

  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const others = (members.data ?? []).filter((member) => member.user_id !== user?.id)
  const suggestions =
    query === null
      ? []
      : others
          .filter((member) =>
            memberName(member).toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 5)

  const myName = profile?.full_name?.trim() || user?.email || ''

  const change = (text: string, caret: number) => {
    setBody(text)
    setQuery(mentionQuery(text, caret))
    setActive(0)
    if (text) onTyping(myName)
  }

  const choose = (member: ChannelMember) => {
    const caret = box.current?.selectionStart ?? body.length
    const before = body.slice(0, caret).replace(/@[\p{L}\p{N}_.-]*$/u, '')
    const next = `${before}@${memberName(member)} ${body.slice(caret)}`

    setBody(next)
    setQuery(null)
    box.current?.focus()
  }

  const submit = () => {
    const text = body.trim()
    if (!text && files.length === 0) return

    // A name in the text is a string; a mention is a person. Only the people
    // still named in what is actually being sent are carried (P6-08 notifies
    // them), and only the ones who are in this channel.
    const mentions = others
      .filter((member) => text.includes(`@${memberName(member)}`))
      .map((member) => member.user_id)

    send.mutate(
      { body: text, mentions, files },
      {
        onSuccess: () => {
          setBody('')
          setFiles([])
        },
      },
    )
  }

  const key = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
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

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="relative border-t p-3 pb-20 md:pb-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label={t('chat.mentionSomebody')}
          className="bg-popover absolute bottom-full left-3 mb-1 w-64 rounded-md border shadow-md"
        >
          {suggestions.map((member, index) => (
            <li key={member.user_id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm',
                  index === active
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/60',
                )}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(member)
                }}
              >
                {memberName(member)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2 pb-2">
          {files.map((file) => (
            <li
              key={file.name}
              className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs"
            >
              {file.name}
              <button
                type="button"
                aria-label={t('chat.removeFile', { name: file.name })}
                onClick={() => setFiles((chosen) => chosen.filter((one) => one !== file))}
              >
                <X className="size-3" aria-hidden="true" />
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
            const chosen = [...(event.target.files ?? [])]
            setFiles((already) => [...already, ...chosen])
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('chat.attach')}
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip className="size-4" aria-hidden="true" />
        </Button>

        <textarea
          ref={box}
          aria-label={t('chat.write')}
          placeholder={t('chat.write')}
          rows={1}
          className="border-input bg-background max-h-32 min-h-9 flex-1 resize-y rounded-md border p-2 text-sm"
          value={body}
          onChange={(event) => change(event.target.value, event.target.selectionStart)}
          onKeyDown={key}
        />

        <Button
          type="submit"
          size="sm"
          aria-label={t('chat.send')}
          disabled={send.isPending || (!body.trim() && files.length === 0)}
        >
          <SendHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {send.isError && (
        <p role="alert" className="text-destructive pt-1 text-sm">
          {t('chat.sendFailed')}
        </p>
      )}
    </form>
  )
}
