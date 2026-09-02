import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
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
        {runs.isPending && (
          <p className="text-muted-foreground text-sm">{t('checklists.loading')}</p>
        )}
        {runs.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('checklists.runsLoadFailed')}
          </p>
        )}
        {runs.data && all.length === 0 && (
          <p className="text-muted-foreground text-sm">{t('checklists.nothingToday')}</p>
        )}

        <ul className="space-y-2">
          {sorted.map((run) => {
            const progress = runProgress(run)
            const complete = isRunComplete(run)

            return (
              <li key={run.id} className="flex flex-wrap items-center gap-2">
                <Badge variant={complete ? 'outline' : 'secondary'}>
                  {complete
                    ? t('checklists.complete')
                    : t('checklists.progress', {
                        done: progress.done,
                        total: progress.total,
                      })}
                </Badge>
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
          <Link to="/checklists" className="text-sm underline">
            {t('home.today.openChecklists')}
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
