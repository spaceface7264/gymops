import { Newspaper, Pin, PinOff, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link } from 'react-router'
import { EmptyState, LoadingState, PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ContentSearch, excerpt, toDoc, usePublishScope } from '@/features/content'
import { useGymScope } from '@/features/gyms'
import { postDate } from './post-date'
import { PostBadges } from './post-badges'
import { useNewsFeed, useSetPostPinned } from './queries'

/**
 * The news feed for whatever the gym switcher is showing: pinned posts first,
 * then newest. Drafts appear to the people who may edit them, labelled.
 */
export function NewsFeed() {
  const { t, i18n } = useTranslation()
  const { gymId } = useGymScope()
  const scope = usePublishScope()
  const feed = useNewsFeed(gymId)
  const setPinned = useSetPostPinned()

  const newPostAction = scope.canPublishSomewhere && (
    <Button asChild>
      <Link to="/news/new">
        <Plus className="size-4" />
        {t('news.newPost')}
      </Link>
    </Button>
  )

  return (
    <div className="space-y-4">
      <PageHeader title={t('news.title')} action={newPostAction} />

      <ContentSearch />

      {feed.isPending && <LoadingState rows={5} />}
      {feed.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('news.loadFailed')}
        </p>
      )}
      {feed.data?.length === 0 && (
        <EmptyState icon={Newspaper} title={t('news.empty')} action={newPostAction} />
      )}

      <ul className="space-y-3">
        {feed.data?.map((post) => (
          <li key={post.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <PostBadges post={post} />
                  <h2 className="text-lg font-semibold">
                    <Link to={`/news/${post.id}`} className="hover:underline">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {excerpt(toDoc(post.body))}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {postDate(post, i18n.language)}
                  </p>
                </div>

                {scope.canPublishIn(post.gym_id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={post.pinned ? t('news.unpin') : t('news.pin')}
                    aria-pressed={post.pinned}
                    disabled={setPinned.isPending}
                    onClick={() =>
                      setPinned.mutate(
                        { id: post.id, pinned: !post.pinned },
                        { onError: () => toast.error(t('news.saveFailed')) },
                      )
                    }
                  >
                    {post.pinned ? (
                      <PinOff className="size-4" />
                    ) : (
                      <Pin className="size-4" />
                    )}
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
