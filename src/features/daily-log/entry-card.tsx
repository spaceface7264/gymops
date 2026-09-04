import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ConfirmDialog, StatusBadge } from '@/components'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { incidentDraftPath } from './incident-draft'
import {
  dailyLogKinds,
  parseTags,
  useDeleteLogEntry,
  useUpdateLogEntry,
  type DailyLogEntry,
  type DailyLogKind,
} from './queries'

/**
 * One entry on the timeline. The author can edit theirs; a manager can only
 * take it off the timeline, which is the rule the database enforces too.
 */
export function EntryCard({
  entry,
  canManage,
  canReport,
  showGym,
}: {
  entry: DailyLogEntry
  canManage: boolean
  /** Whether to offer turning an issue into an incident (spec §2.2). */
  canReport: boolean
  showGym: boolean
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const update = useUpdateLogEntry()
  const remove = useDeleteLogEntry()

  const isAuthor = entry.created_by === user?.id
  const [editing, setEditing] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [kind, setKind] = useState<DailyLogKind>(entry.kind)
  const [body, setBody] = useState(entry.body)
  const [tags, setTags] = useState(entry.tags.join(', '))

  const when = new Date(entry.created_at).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={entry.kind === 'issue' ? 'warning' : 'neutral'}>
          {t(`dailyLog.kind.${entry.kind}`)}
        </StatusBadge>
        {showGym && entry.gyms && (
          <StatusBadge tone="neutral">{entry.gyms.name}</StatusBadge>
        )}
        <span className="text-muted-foreground text-xs">
          {t('dailyLog.writtenBy', {
            who: entry.author?.full_name ?? t('dailyLog.someone'),
            when,
          })}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Select value={kind} onValueChange={(value) => setKind(value as DailyLogKind)}>
            <SelectTrigger aria-label={t('dailyLog.kindLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {dailyLogKinds.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`dailyLog.kind.${option}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Textarea
            aria-label={t('dailyLog.entry')}
            className="min-h-20 text-sm"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Input
            aria-label={t('dailyLog.tags')}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              disabled={body.trim() === '' || update.isPending}
              onClick={() =>
                update.mutate(
                  { id: entry.id, kind, body, tags: parseTags(tags) },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              {t('dailyLog.save')}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('dailyLog.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-line">{entry.body}</p>
      )}

      {entry.tags.length > 0 && !editing && (
        <div className="flex flex-wrap gap-1">
          {entry.tags.map((tag) => (
            <StatusBadge key={tag} tone="neutral">
              #{tag}
            </StatusBadge>
          ))}
        </div>
      )}

      {!editing && entry.kind === 'issue' && canReport && (
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={incidentDraftPath(entry)}>
              <TriangleAlert className="size-4" />
              {t('dailyLog.reportAsIncident')}
            </Link>
          </Button>
        </div>
      )}

      {!editing && (isAuthor || canManage) && (
        <div className="flex gap-2">
          {isAuthor && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {t('dailyLog.edit')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmingRemove(true)}>
            {t('dailyLog.remove')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingRemove}
        onOpenChange={setConfirmingRemove}
        title={t('dailyLog.removeConfirm')}
        body={t('dailyLog.removeDescription')}
        confirmLabel={t('dailyLog.remove')}
        pending={remove.isPending}
        error={remove.isError ? t('dailyLog.removeFailed') : undefined}
        onConfirm={() =>
          remove.mutate(entry.id, { onSuccess: () => setConfirmingRemove(false) })
        }
      />
    </Card>
  )
}
