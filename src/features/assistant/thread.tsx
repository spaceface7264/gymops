import { ArrowLeft, Send, Sparkles, Square, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { EmptyState, LoadingState, Markdown } from '@/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  useConversationMessages,
  useConversations,
  useDeleteConversation,
  type AssistantProblem,
  type Source,
} from './queries'
import { useAsk } from './use-ask'

const problemKey = (problem: AssistantProblem | null) =>
  problem === 'cap_reached'
    ? 'assistant.capReached'
    : problem === 'not_configured'
      ? 'assistant.notConfigured'
      : 'assistant.failed'

/**
 * One conversation, or the start of one. The stored turns come from the
 * database; while a question is being answered its two bubbles are drawn from
 * `useAsk` instead, and are dropped once the stored reply they became has been
 * fetched — so nothing is shown twice and nothing disappears in between. The
 * live pair follows its conversation: a first answer opens the conversation
 * it created and the bubbles stay on screen there until the stored turns
 * arrive; opening another conversation leaves them behind.
 */
export function Thread({ conversationId }: { conversationId?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const conversations = useConversations()
  const messages = useConversationMessages(conversationId)
  const remove = useDeleteConversation()
  const live = useAsk()
  const [asked, setAsked] = useState<{
    question: string
    conversationId?: string
  } | null>(null)

  const conversation = conversations.data?.find((row) => row.id === conversationId)
  const rows = messages.data ?? []

  const landed = live.messageId !== null && rows.some((row) => row.id === live.messageId)
  const here = asked !== null && asked.conversationId === conversationId
  const showLive = here && live.status !== 'idle' && !landed
  const streaming = here && live.status === 'streaming'
  const empty = !conversationId && !showLive

  const submit = async (question: string) => {
    setAsked({ question, conversationId })
    const result = await live.ask(question, conversationId)
    if (result && !conversationId) {
      setAsked({ question, conversationId: result.conversationId })
      void navigate(`/ask/${result.conversationId}`)
    }
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b p-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden">
          <Link to="/ask" aria-label={t('assistant.back')}>
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {conversationId
            ? conversation?.title || t('assistant.untitled')
            : t('assistant.newConversation')}
        </h2>
        {conversationId && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('assistant.deleteConversation')}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(conversationId, { onSuccess: () => void navigate('/ask') })
            }
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {conversationId && messages.isPending && <LoadingState rows={4} />}
        {messages.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('assistant.loadFailed')}
          </p>
        )}
        {empty && (
          <EmptyState
            icon={Sparkles}
            title={t('assistant.empty')}
            body={t('assistant.description')}
          />
        )}

        <ol className="space-y-3">
          {rows.map((row) => (
            <Turn key={row.id} role={row.role} body={row.body} sources={row.sources} />
          ))}
          {showLive && (
            <>
              <Turn role="user" body={asked?.question ?? ''} sources={[]} />
              {live.status === 'error' ? (
                <li>
                  <p role="alert" className="text-destructive text-sm">
                    {t(problemKey(live.problem))}
                  </p>
                </li>
              ) : (
                <Turn
                  role="assistant"
                  body={live.text}
                  sources={live.sources}
                  placeholder={
                    streaming && !live.text ? t('assistant.thinking') : undefined
                  }
                />
              )}
            </>
          )}
        </ol>
      </div>

      <AskComposer
        streaming={streaming}
        onSubmit={(text) => void submit(text)}
        onStop={live.stop}
      />
    </>
  )
}

function Turn({
  role,
  body,
  sources,
  placeholder,
}: {
  role: 'user' | 'assistant'
  body: string
  sources: Source[]
  placeholder?: string
}) {
  const { t } = useTranslation()
  const mine = role === 'user'

  return (
    <li className={cn('flex', mine && 'justify-end')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2',
          mine ? 'bg-accent' : 'bg-card border',
        )}
      >
        {placeholder ? (
          <p aria-live="polite" className="text-muted-foreground text-sm">
            {placeholder}
          </p>
        ) : (
          <Markdown body={body} />
        )}
        {sources.length > 0 && (
          <div className="pt-2">
            <p className="text-muted-foreground text-xs">{t('assistant.sources')}</p>
            <ul className="flex flex-wrap gap-2 pt-1">
              {sources.map((source) => (
                <li key={source.id}>
                  <Link
                    to={`/${source.kind === 'guide' ? 'guides' : 'news'}/${source.id}`}
                    className="bg-muted inline-block rounded-full px-3 py-1 text-xs underline-offset-2 hover:underline"
                  >
                    {source.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  )
}

function AskComposer({
  streaming,
  onSubmit,
  onStop,
}: {
  streaming: boolean
  onSubmit: (question: string) => void
  onStop: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const submit = () => {
    const question = text.trim()
    if (!question || streaming) return
    onSubmit(question)
    setText('')
  }

  const key = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="flex items-end gap-2 border-t p-3 pb-20 md:pb-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Textarea
        aria-label={t('assistant.write')}
        placeholder={t('assistant.write')}
        rows={1}
        className="max-h-32 min-h-11 flex-1 resize-none py-2"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={key}
      />
      {streaming ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={t('assistant.stop')}
          onClick={onStop}
        >
          <Square className="size-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          aria-label={t('assistant.send')}
          disabled={!text.trim()}
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      )}
    </form>
  )
}
