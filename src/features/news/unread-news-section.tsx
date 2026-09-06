import { useTranslation } from 'react-i18next'
import {
  HomeEmpty,
  HomeRow,
  HomeRows,
  HomeSection,
  HomeSectionLink,
  LoadingState,
  StatusBadge,
  LoadError,
} from '@/components'
import { useAuth } from '@/features/auth'
import { useGymScope } from '@/features/gyms'
import { useUnreadNews } from './queries'

/**
 * The home page's news block (P3-07): what this person has not read, and what
 * they have read but not acknowledged. Posts needing a confirmation come
 * first — they are the ones somebody is waiting on.
 */
export function UnreadNewsSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { gymId } = useGymScope()
  const unread = useUnreadNews(gymId, user?.id)

  const posts = [...(unread.data ?? [])].sort(
    (a, b) => Number(b.requires_ack) - Number(a.requires_ack),
  )

  return (
    <HomeSection
      title={t('home.news.title')}
      action={
        posts.length > 0 && (
          <HomeSectionLink to="/news">{t('home.news.allNews')}</HomeSectionLink>
        )
      }
    >
      {unread.isPending && <LoadingState rows={2} />}
      {unread.isError && (
        <LoadError message={t('news.loadFailed')} onRetry={() => void unread.refetch()} />
      )}
      {unread.data && posts.length === 0 && (
        <HomeEmpty>{t('home.news.allCaughtUp')}</HomeEmpty>
      )}

      {posts.length > 0 && (
        <HomeRows>
          {posts.map((post) => (
            <HomeRow
              key={post.id}
              to={`/news/${post.id}`}
              badge={
                post.requires_ack ? (
                  <StatusBadge tone="new">{t('home.news.needsConfirmation')}</StatusBadge>
                ) : (
                  <StatusBadge tone="info">{t('home.news.unread')}</StatusBadge>
                )
              }
              meta={post.gyms?.name ?? t('news.companyWide')}
            >
              {post.title}
            </HomeRow>
          ))}
        </HomeRows>
      )}
    </HomeSection>
  )
}
