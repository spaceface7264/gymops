import { ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, LoadingState, PageHeader, StatusBadge } from '@/components'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePublishScope } from '@/features/content'
import { useGymScope } from '@/features/gyms'
import { useCompletionScope } from './completion'
import {
  isRunComplete,
  runProgress,
  useTodaysRuns,
  type ChecklistRun,
  type ChecklistRunItem,
} from './queries'
import { RunItemRow } from './run-item-row'
import { useRunSync } from './use-run-sync'

/** `/checklists`: what this gym has to get through today. */
export function ChecklistRunsPage() {
  const { t } = useTranslation()
  const { gymId } = useGymScope()
  const publish = usePublishScope()
  const runs = useTodaysRuns(gymId)
  useRunSync(gymId)

  const templatesAction = publish.canPublishSomewhere && (
    <Button asChild variant="outline">
      <Link to="/checklists/templates">
        <ListChecks className="size-4" />
        {t('checklists.templates')}
      </Link>
    </Button>
  )

  return (
    <div className="space-y-4">
      <PageHeader title={t('checklists.today')} action={templatesAction} />

      {runs.isPending && <LoadingState rows={5} />}
      {runs.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('checklists.runsLoadFailed')}
        </p>
      )}
      {runs.data?.length === 0 && (
        <EmptyState icon={ListChecks} title={t('checklists.nothingToday')} />
      )}

      <ul aria-label={t('checklists.today')} className="space-y-4">
        {(runs.data ?? []).map((run) => (
          <li key={run.id}>
            <RunCard run={run} showGym={gymId === null} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RunCard({ run, showGym }: { run: ChecklistRun; showGym: boolean }) {
  const { t } = useTranslation()
  const { canCompleteIn } = useCompletionScope()
  const progress = runProgress(run)
  const canComplete = canCompleteIn(run.gym_id)
  const title = run.checklist_templates?.name ?? t('checklists.untitledRun')

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {showGym && <StatusBadge tone="neutral">{run.gyms?.name}</StatusBadge>}
        {run.checklist_templates && (
          <StatusBadge tone="neutral">
            {t(`checklists.kind.${run.checklist_templates.kind}`)}
          </StatusBadge>
        )}
        {isRunComplete(run) && (
          <StatusBadge tone="success">{t('checklists.complete')}</StatusBadge>
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">
          {t('checklists.progress', { done: progress.done, total: progress.total })}
        </p>
      </div>

      {!canComplete && (
        <p className="text-muted-foreground text-sm">{t('checklists.readOnly')}</p>
      )}

      <ul aria-label={title} className="divide-border divide-y">
        {run.checklist_run_items.map((item: ChecklistRunItem) => (
          <li key={item.id} className="py-2">
            <RunItemRow item={item} canComplete={canComplete} />
          </li>
        ))}
      </ul>
    </Card>
  )
}
