import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState, LoadingState, StatusBadge } from '@/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePublishScope } from '@/features/content'
import { useGymScope } from '@/features/gyms'
import { runOutcome, runProgress, useRecentRuns, type ChecklistRun } from './queries'

const days = 7

/**
 * The home page's checklist block for the people who run a gym (P4-05): how
 * the last week went, and which checklists nobody finished. Staff get the run
 * screen itself; this is the view from behind the desk.
 */
export function ChecklistHistoryCard() {
  const { t, i18n } = useTranslation()
  const { gymId } = useGymScope()
  const scope = usePublishScope()
  const runs = useRecentRuns(gymId, days)

  if (!scope.canPublishSomewhere) return null

  const all = runs.data ?? []
  const complete = all.filter((run) => runOutcome(run) === 'complete')
  const missed = all.filter((run) => runOutcome(run) === 'missed')

  const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.checklists.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {runs.isPending && <LoadingState rows={3} />}
        {runs.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('checklists.runsLoadFailed')}
          </p>
        )}

        {runs.data && all.length === 0 && (
          <EmptyState icon={History} title={t('home.checklists.noRuns')} />
        )}

        {all.length > 0 && (
          <p className="text-sm">
            {t('home.checklists.summary', {
              done: complete.length,
              total: all.length,
              days,
            })}
          </p>
        )}

        {all.length > 0 && missed.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {t('home.checklists.nothingMissed', { days })}
          </p>
        )}

        {missed.length > 0 && (
          <ul aria-label={t('home.checklists.missed')} className="space-y-2">
            {missed.map((run: ChecklistRun) => {
              const progress = runProgress(run)

              return (
                <li key={run.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge tone="warning">
                    {t('home.checklists.missedBadge')}
                  </StatusBadge>
                  <span className="font-medium">
                    {run.checklist_templates?.name ?? t('checklists.untitledRun')}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(run.run_date)}
                    {gymId === null && run.gyms ? ` · ${run.gyms.name}` : ''} ·{' '}
                    {t('checklists.progress', {
                      done: progress.done,
                      total: progress.total,
                    })}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
