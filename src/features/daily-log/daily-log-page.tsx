import { NotebookPen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, LoadingState, PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import { useCompletionScope, localDate } from '@/features/checklists'
import { usePublishScope } from '@/features/content'
import { useGymScope } from '@/features/gyms'
import { EntryCard } from './entry-card'
import { EntryComposer } from './entry-composer'
import {
  dailyLogKinds,
  useDailyLog,
  type DailyLogEntry,
  type DailyLogKind,
} from './queries'

/** `/daily-log`: the gym's shift timeline, newest first. */
export function DailyLogPage() {
  const { t, i18n } = useTranslation()
  const { gymId } = useGymScope()
  // Writing in the log is the same rule as ticking a checklist (spec §2.1).
  const { canCompleteIn } = useCompletionScope()
  const publish = usePublishScope()

  const [kind, setKind] = useState<DailyLogKind | 'all'>('all')
  const [tag, setTag] = useState<string | null>(null)
  const entries = useDailyLog(gymId, { kind, tag })

  const shown = entries.data ?? []
  const tags = [...new Set(shown.flatMap((entry) => entry.tags))].sort()
  const canWriteHere = gymId !== null && canCompleteIn(gymId)

  const days = shown.reduce<Record<string, DailyLogEntry[]>>((grouped, entry) => {
    const day = localDate(entry.gyms?.timezone ?? 'UTC', new Date(entry.created_at))
    grouped[day] = [...(grouped[day] ?? []), entry]
    return grouped
  }, {})

  return (
    <div className="space-y-4">
      <PageHeader title={t('dailyLog.title')} />

      {canWriteHere ? (
        <EntryComposer gymId={gymId} />
      ) : (
        <p className="text-muted-foreground text-sm">
          {gymId === null ? t('dailyLog.pickGym') : t('dailyLog.readOnly')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {(['all', ...dailyLogKinds] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={kind === option ? 'default' : 'outline'}
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
            >
              {option === 'all' ? t('dailyLog.allKinds') : t(`dailyLog.kind.${option}`)}
            </Button>
          ))}
        </div>

        {(tags.length > 0 || tag) && (
          <select
            aria-label={t('dailyLog.filterByTag')}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            value={tag ?? ''}
            onChange={(event) => setTag(event.target.value || null)}
          >
            <option value="">{t('dailyLog.noTag')}</option>
            {[...new Set([...tags, ...(tag ? [tag] : [])])].sort().map((option) => (
              <option key={option} value={option}>
                #{option}
              </option>
            ))}
          </select>
        )}
      </div>

      {entries.isPending && <LoadingState rows={5} />}
      {entries.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('dailyLog.loadFailed')}
        </p>
      )}
      {entries.data && shown.length === 0 && (
        <EmptyState icon={NotebookPen} title={t('dailyLog.empty')} />
      )}

      <div className="space-y-4">
        {Object.entries(days).map(([day, dayEntries]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-muted-foreground text-sm font-medium">
              {new Date(`${day}T00:00:00`).toLocaleDateString(i18n.language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h2>
            <ul aria-label={day} className="space-y-2">
              {dayEntries.map((entry) => (
                <li key={entry.id}>
                  <EntryCard
                    entry={entry}
                    canManage={publish.canPublishIn(entry.gym_id)}
                    canReport={canCompleteIn(entry.gym_id)}
                    showGym={gymId === null}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
