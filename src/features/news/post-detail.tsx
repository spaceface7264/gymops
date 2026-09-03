import { ArrowLeft, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { LoadingState, PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RichText, toDoc, usePublishScope } from '@/features/content'
import { AcknowledgeButton, AckReport } from './acknowledgement'
import { useTrackPostRead } from './use-track-post-read'
import { postDate } from './post-date'
import { PostBadges } from './post-badges'
import { useDeletePost, useNewsPost, useSetPostPinned, useSetPostStatus } from './queries'

/** One post, with the editing controls the viewer is allowed to use. */
export function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const scope = usePublishScope()
  const post = useNewsPost(postId)
  const setPinned = useSetPostPinned()
  const setStatus = useSetPostStatus()
  const remove = useDeletePost()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  useTrackPostRead(post.data)

  if (post.isPending) return <LoadingState rows={5} />
  if (!post.data) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('news.notFound')}
      </p>
    )
  }

  const canEdit = scope.canPublishIn(post.data.gym_id)

  return (
    <article className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/news">
          <ArrowLeft className="size-4" />
          {t('news.backToFeed')}
        </Link>
      </Button>

      <header className="space-y-2">
        <PostBadges post={post.data} />
        <PageHeader title={post.data.title} />
        <p className="text-muted-foreground text-sm">
          {postDate(post.data, i18n.language)}
        </p>
      </header>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/news/${post.data.id}/edit`}>
              <Pencil className="size-4" />
              {t('news.edit')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={post.data.pinned}
            onClick={() =>
              setPinned.mutate({ id: post.data.id, pinned: !post.data.pinned })
            }
          >
            {post.data.pinned ? (
              <PinOff className="size-4" />
            ) : (
              <Pin className="size-4" />
            )}
            {post.data.pinned ? t('news.unpin') : t('news.pin')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setStatus.mutate({
                id: post.data.id,
                status: post.data.status === 'published' ? 'draft' : 'published',
              })
            }
          >
            {post.data.status === 'published' ? t('news.unpublish') : t('news.publish')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="size-4" />
            {t('news.delete')}
          </Button>
        </div>
      )}

      <RichText doc={toDoc(post.data.body)} />

      <AcknowledgeButton post={post.data} />
      {canEdit && <AckReport post={post.data} />}

      {/* A dialog rather than window.confirm: it is translated, and a browser
          modal would block the app. */}
      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('news.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('news.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              {t('news.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(post.data.id, { onSuccess: () => void navigate('/news') })
              }
            >
              {t('news.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
