import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
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
        {unread.isPending && (
          <p className="text-muted-foreground text-sm">{t('news.loading')}</p>
        )}
        {unread.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('news.loadFailed')}
          </p>
        )}
        {unread.data && posts.length === 0 && (
          <p className="text-muted-foreground text-sm">{t('home.news.allCaughtUp')}</p>
        )}

        <ul className="space-y-2">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-wrap items-center gap-2">
              {post.requires_ack ? (
                <Badge>{t('home.news.needsConfirmation')}</Badge>
              ) : (
                <Badge variant="secondary">{t('home.news.unread')}</Badge>
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
          <Link to="/news" className="text-sm underline">
            {t('home.news.allNews')}
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
