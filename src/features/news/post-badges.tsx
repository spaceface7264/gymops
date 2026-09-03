import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components'
import type { NewsPost } from './queries'

/**
 * The four things worth knowing about a post at a glance: where it applies,
 * whether it is still a draft, whether it is pinned and whether it must be
 * acknowledged.
 */
export function PostBadges({
  post,
}: {
  post: Pick<NewsPost, 'gyms' | 'status' | 'pinned' | 'requires_ack'>
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone="neutral">{post.gyms?.name ?? t('news.companyWide')}</StatusBadge>
      {post.status === 'draft' && (
        <StatusBadge tone="warning">{t('news.draft')}</StatusBadge>
      )}
      {post.pinned && <StatusBadge tone="info">{t('news.pinned')}</StatusBadge>}
      {post.requires_ack && (
        <StatusBadge tone="new">{t('news.acknowledgementRequired')}</StatusBadge>
      )}
    </div>
  )
}
