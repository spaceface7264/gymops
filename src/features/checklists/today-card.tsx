import { ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, LoadingState, StatusBadge } from '@/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGymScope } from '@/features/gyms'
import { isRunComplete, runProgress, useTodaysRuns } from './queries'

/**
 * The home page's checklist block (P4-10): what today still needs, for
 * everybody. The week behind it is `ChecklistHistoryCard`, which only the
 * people who run a gym see.
 */
export function TodaysChecklistsCard() {
  const { t } = useTranslation()
  const { gymId } = useGymScope()
  const runs = useTodaysRuns(gymId)

  const all = runs.data ?? []
  // Unfinished first: a completed checklist is not what somebody opens the
  // home page to find.
  const sorted = [...all].sort(
    (a, b) => Number(isRunComplete(a)) - Number(isRunComplete(b)),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.today.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {runs.isPending && <LoadingState rows={3} />}
        {runs.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('checklists.runsLoadFailed')}
          </p>
        )}
        {runs.data && all.length === 0 && (
          <EmptyState
            bordered={false}
            icon={ListChecks}
            title={t('checklists.nothingToday')}
          />
        )}

        <ul className="space-y-2">
          {sorted.map((run) => {
            const progress = runProgress(run)
            const complete = isRunComplete(run)

            return (
              <li key={run.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={complete ? 'success' : 'warning'}>
                  {complete
                    ? t('checklists.complete')
                    : t('checklists.progress', {
                        done: progress.done,
                        total: progress.total,
                      })}
                </StatusBadge>
                <span className="font-medium">
                  {run.checklist_templates?.name ?? t('checklists.untitledRun')}
                </span>
                {gymId === null && run.gyms && (
                  <span className="text-muted-foreground text-sm">{run.gyms.name}</span>
                )}
              </li>
            )
          })}
        </ul>

        {all.length > 0 && (
          <Button asChild variant="link" className="h-auto p-0">
            <Link to="/checklists">{t('home.today.openChecklists')}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
