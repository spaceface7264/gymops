import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
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
      <Badge variant="outline">{post.gyms?.name ?? t('news.companyWide')}</Badge>
      {post.status === 'draft' && <Badge variant="secondary">{t('news.draft')}</Badge>}
      {post.pinned && <Badge variant="secondary">{t('news.pinned')}</Badge>}
      {post.requires_ack && <Badge>{t('news.acknowledgementRequired')}</Badge>}
    </div>
  )
}
