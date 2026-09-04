import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LoadingState } from '@/components'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth'
import { useAcknowledgePost, useAckReport, useMyPostRead, type NewsPost } from './queries'

/** "I have read this" — shown only on posts that ask for it. */
export function AcknowledgeButton({
  post,
}: {
  post: Pick<NewsPost, 'id' | 'requires_ack'>
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const myRead = useMyPostRead(post.id, user?.id)
  const acknowledge = useAcknowledgePost()

  if (!post.requires_ack) return null

  const acknowledgedAt = myRead.data?.acknowledged_at

  return (
    <div className="bg-tone-new-bg text-tone-new-fg flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
      <p className="text-sm">{t('news.ack.prompt')}</p>
      {acknowledgedAt ? (
        <p className="flex items-center gap-2 text-sm">
          <Check className="size-4" />
          {t('news.ack.confirmedAt', {
            when: new Date(acknowledgedAt).toLocaleString(i18n.language, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          })}
        </p>
      ) : (
        <Button
          disabled={acknowledge.isPending || !user}
          onClick={() => user && acknowledge.mutate({ postId: post.id, userId: user.id })}
        >
          {t('news.ack.confirm')}
        </Button>
      )}
    </div>
  )
}

/**
 * Who has confirmed and who has not, for the people who may see acknowledgement
 * reports (spec §2.1). Outstanding names come first — that is the list a
 * manager acts on.
 */
export function AckReport({
  post,
}: {
  post: Pick<NewsPost, 'id' | 'gym_id' | 'requires_ack'>
}) {
  const { t, i18n } = useTranslation()
  const report = useAckReport(post.id, post.gym_id, post.requires_ack)

  if (!post.requires_ack) return null

  const rows = report.data ?? []
  const outstanding = rows.filter((row) => !row.acknowledgedAt)

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">{t('news.ack.reportTitle')}</h2>

      {report.isPending && <LoadingState rows={3} />}
      {report.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('news.ack.reportFailed')}
        </p>
      )}
      {report.data && (
        <p className="text-muted-foreground text-sm">
          {t('news.ack.reportSummary', {
            confirmed: rows.length - outstanding.length,
            total: rows.length,
          })}
        </p>
      )}

      <ul className="divide-y rounded-md border">
        {rows.map((row) => (
          <li
            key={row.userId}
            className="flex items-center justify-between gap-4 px-3 py-2"
          >
            <span className="text-sm">
              {row.name}
              <span className="text-muted-foreground">
                {' · '}
                {row.gymName ?? t('news.companyWide')}
              </span>
            </span>
            <span
              className={
                row.acknowledgedAt
                  ? 'text-muted-foreground text-xs'
                  : 'text-destructive text-xs'
              }
            >
              {row.acknowledgedAt
                ? new Date(row.acknowledgedAt).toLocaleString(i18n.language, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : t('news.ack.outstanding')}
            </span>
          </li>
        ))}
      </ul>

      {/* Reminders themselves are a notification, and notifications are created
          only by database triggers (spec §5). That trigger is P5-02's "ack
          reminder"; until then this list is how a manager chases people. */}
      <p className="text-muted-foreground text-xs">{t('news.ack.reminderNote')}</p>
    </section>
  )
}
