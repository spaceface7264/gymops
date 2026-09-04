import { Plus, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useParams } from 'react-router'
import { EmptyState } from '@/components'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAssistantQuota, useConversations } from './queries'
import { Thread } from './thread'

/**
 * `/ask`, `/ask/new` and `/ask/:conversationId` are one screen, shaped like
 * chat: the list of earlier conversations beside the one that is open. On a
 * phone it is one pane at a time — `/ask` is the list, `/ask/new` a fresh
 * conversation with a way back — which is why `/ask/new` exists at all; on
 * desktop it is the same as `/ask`. Full-bleed, like chat, because the thread
 * scrolls inside itself and the composer stays at the bottom.
 */
export function AskPage() {
  const { t } = useTranslation()
  const { conversationId } = useParams()
  const conversations = useConversations()
  const quota = useAssistantQuota()
  const showThread = Boolean(conversationId) || location.pathname.endsWith('/new')

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside
        aria-label={t('assistant.title')}
        className={cn(
          'flex flex-col md:w-72 md:shrink-0 md:border-r',
          'pb-20 md:pb-0',
          showThread && 'hidden md:flex',
        )}
      >
        <div className="p-3">
          <h1 className="text-lg font-semibold">{t('assistant.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('assistant.description')}</p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <Link to="/ask/new">
              <Plus className="size-4" aria-hidden="true" />
              {t('assistant.newConversation')}
            </Link>
          </Button>
        </div>

        <nav
          aria-label={t('assistant.conversations')}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {conversations.data?.length === 0 && (
            <EmptyState
              icon={Sparkles}
              title={t('assistant.noConversations')}
              bordered={false}
              as="p"
            />
          )}
          {conversations.data && conversations.data.length > 0 && (
            <ul aria-label={t('assistant.conversations')} className="px-2">
              {conversations.data.map((conversation) => (
                <li key={conversation.id}>
                  <NavLink
                    to={`/ask/${conversation.id}`}
                    className={({ isActive }) =>
                      cn(
                        'block truncate rounded-xl px-3 py-2 text-sm',
                        isActive ? 'bg-accent font-medium' : 'hover:bg-accent/60',
                      )
                    }
                  >
                    {conversation.title || t('assistant.untitled')}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {quota.data && (
          <p className="text-muted-foreground border-t px-3 py-2 text-xs">
            {t('assistant.quota', { used: quota.data.used, cap: quota.data.cap })}
          </p>
        )}
      </aside>

      <section
        className={cn('flex min-w-0 flex-1 flex-col', !showThread && 'hidden md:flex')}
      >
        <Thread conversationId={conversationId} />
      </section>
    </div>
  )
}
