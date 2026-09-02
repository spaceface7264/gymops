import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAddComment, useIncidentComments } from './queries'

/** The thread on one incident: oldest first, and a box for the next word. */
export function CommentThread({
  incidentId,
  canComment,
}: {
  incidentId: string
  canComment: boolean
}) {
  const { t, i18n } = useTranslation()
  const comments = useIncidentComments(incidentId)
  const add = useAddComment(incidentId)
  const [body, setBody] = useState('')

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{t('incidents.comments')}</h2>

      {comments.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('incidents.noComments')}</p>
      )}

      <ul className="space-y-2">
        {(comments.data ?? []).map((comment) => (
          <li key={comment.id}>
            <Card className="space-y-1 p-3">
              <p className="text-muted-foreground text-xs">
                {t('incidents.commentBy', {
                  who: comment.author?.full_name ?? t('incidents.someone'),
                  when: new Date(comment.created_at).toLocaleString(i18n.language, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </p>
              <p className="text-sm whitespace-pre-line">{comment.body}</p>
            </Card>
          </li>
        ))}
      </ul>

      {canComment && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            add.mutate(body, { onSuccess: () => setBody('') })
          }}
        >
          <textarea
            aria-label={t('incidents.comment')}
            className="border-input bg-background min-h-16 w-full rounded-md border p-2 text-sm"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          {add.isError && (
            <p role="alert" className="text-destructive text-sm">
              {t('incidents.commentFailed')}
            </p>
          )}
          <Button type="submit" size="sm" disabled={body.trim() === '' || add.isPending}>
            {t('incidents.addComment')}
          </Button>
        </form>
      )}
    </section>
  )
}
