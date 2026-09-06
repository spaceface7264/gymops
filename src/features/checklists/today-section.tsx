import { useTranslation } from 'react-i18next'
import {
  HomeEmpty,
  HomeRow,
  HomeRows,
  HomeSection,
  HomeSectionLink,
  LoadingState,
  StatusBadge,
} from '@/components'
import { useGymScope } from '@/features/gyms'
import { isRunComplete, runProgress, useTodaysRuns } from './queries'

/**
 * The home page's checklist block (P4-10): what today still needs, for
 * everybody. The week behind it is `ChecklistHistoryCard`, which only the
 * people who run a gym see.
 */
export function TodaysChecklistsSection() {
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
    <HomeSection
      title={t('home.today.title')}
      action={
        all.length > 0 && (
          <HomeSectionLink to="/checklists">
            {t('home.today.openChecklists')}
          </HomeSectionLink>
        )
      }
    >
      {runs.isPending && <LoadingState rows={2} />}
      {runs.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('checklists.runsLoadFailed')}
        </p>
      )}
      {runs.data && all.length === 0 && (
        <HomeEmpty>{t('checklists.nothingToday')}</HomeEmpty>
      )}

      {sorted.length > 0 && (
        <HomeRows>
          {sorted.map((run) => {
            const progress = runProgress(run)
            const complete = isRunComplete(run)
            return (
              <HomeRow
                key={run.id}
                to="/checklists"
                badge={
                  <StatusBadge tone={complete ? 'success' : 'warning'}>
                    {complete
                      ? t('checklists.complete')
                      : t('checklists.progress', {
                          done: progress.done,
                          total: progress.total,
                        })}
                  </StatusBadge>
                }
                meta={gymId === null && run.gyms ? run.gyms.name : undefined}
              >
                {run.checklist_templates?.name ?? t('checklists.untitledRun')}
              </HomeRow>
            )
          })}
        </HomeRows>
      )}
    </HomeSection>
  )
}
