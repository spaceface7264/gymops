import { Newspaper } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, LoadingState, StatusBadge } from '@/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth'
import { useGymScope } from '@/features/gyms'
import { useUnreadNews } from './queries'

/**
 * The home page's news block (P3-07): what this person has not read, and what
 * they have read but not acknowledged. Posts needing a confirmation come
 * first — they are the ones somebody is waiting on.
 */
export function UnreadNewsCard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { gymId } = useGymScope()
  const unread = useUnreadNews(gymId, user?.id)

  const posts = [...(unread.data ?? [])].sort(
    (a, b) => Number(b.requires_ack) - Number(a.requires_ack),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.news.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {unread.isPending && <LoadingState rows={3} />}
        {unread.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('news.loadFailed')}
          </p>
        )}
        {unread.data && posts.length === 0 && (
          <EmptyState icon={Newspaper} title={t('home.news.allCaughtUp')} />
        )}

        <ul className="space-y-2">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-wrap items-center gap-2">
              {post.requires_ack ? (
                <StatusBadge tone="new">{t('home.news.needsConfirmation')}</StatusBadge>
              ) : (
                <StatusBadge tone="new">{t('home.news.unread')}</StatusBadge>
              )}
              <Link to={`/news/${post.id}`} className="font-medium hover:underline">
                {post.title}
              </Link>
              <span className="text-muted-foreground text-sm">
                {post.gyms?.name ?? t('news.companyWide')}
              </span>
            </li>
          ))}
        </ul>

        {posts.length > 0 && (
          <Button asChild variant="link" className="h-auto p-0">
            <Link to="/news">{t('home.news.allNews')}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
