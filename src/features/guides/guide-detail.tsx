import { ArrowLeft, Check, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { LoadingState, PageHeader, StatusBadge } from '@/components'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth'
import { RichText, toDoc, usePublishScope } from '@/features/content'
import {
  useAcknowledgeGuide,
  useDeleteGuide,
  useGuide,
  useMyGuideAck,
  useSetGuideStatus,
  type Guide,
} from './queries'

/** One guide, with the acknowledgement panel and the editing controls. */
export function GuideDetailPage() {
  const { guideId } = useParams<{ guideId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const scope = usePublishScope()
  const guide = useGuide(guideId)
  const setStatus = useSetGuideStatus()
  const remove = useDeleteGuide()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (guide.isPending) {
    return <LoadingState rows={5} />
  }
  if (!guide.data) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('guides.notFound')}
      </p>
    )
  }

  const canEdit = scope.canPublishIn(guide.data.gym_id)

  return (
    <article className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/guides">
          <ArrowLeft className="size-4" />
          {t('guides.backToGuides')}
        </Link>
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone="neutral">
            {guide.data.gyms?.name ?? t('guides.companyWide')}
          </StatusBadge>
          {guide.data.guide_categories && (
            <StatusBadge tone="neutral">{guide.data.guide_categories.name}</StatusBadge>
          )}
          {guide.data.status === 'draft' && (
            <StatusBadge tone="warning">{t('guides.draft')}</StatusBadge>
          )}
          <StatusBadge tone="neutral">
            {t('guides.version', { version: guide.data.version })}
          </StatusBadge>
        </div>
        <PageHeader title={guide.data.title} />
      </header>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/guides/${guide.data.id}/edit`}>
              <Pencil className="size-4" />
              {t('guides.edit')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setStatus.mutate({
                id: guide.data.id,
                status: guide.data.status === 'published' ? 'draft' : 'published',
              })
            }
          >
            {guide.data.status === 'published'
              ? t('guides.unpublish')
              : t('guides.publish')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="size-4" />
            {t('guides.delete')}
          </Button>
        </div>
      )}

      <RichText doc={toDoc(guide.data.body)} />

      <GuideAcknowledgement guide={guide.data} />

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('guides.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('guides.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              {t('guides.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(guide.data.id, {
                  onSuccess: () => void navigate('/guides'),
                })
              }
            >
              {t('guides.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

/**
 * Confirming a guide, and confirming it again once it has been rewritten: the
 * acknowledgement stores the version it was given for, so a reader whose
 * confirmation is behind `guides.version` is asked once more (spec §2.2).
 */
export function GuideAcknowledgement({
  guide,
}: {
  guide: Pick<Guide, 'id' | 'requires_ack' | 'version'>
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const myAck = useMyGuideAck(guide.id, user?.id)
  const acknowledge = useAcknowledgeGuide()

  if (!guide.requires_ack) return null

  const ack = myAck.data
  const upToDate = ack != null && ack.version >= guide.version

  return (
    <div className="bg-tone-new-bg text-tone-new-fg flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
      <p className="text-sm">
        {ack && !upToDate ? t('guides.ack.changed') : t('guides.ack.prompt')}
      </p>

      {upToDate ? (
        <p className="flex items-center gap-2 text-sm">
          <Check className="size-4" />
          {t('guides.ack.confirmedAt', {
            when: new Date(ack.acknowledged_at).toLocaleString(i18n.language, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          })}
        </p>
      ) : (
        <Button
          disabled={acknowledge.isPending || !user}
          onClick={() =>
            user &&
            acknowledge.mutate({
              guideId: guide.id,
              userId: user.id,
              version: guide.version,
            })
          }
        >
          {ack ? t('guides.ack.confirmAgain') : t('guides.ack.confirm')}
        </Button>
      )}
    </div>
  )
}
