import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import {
  ChecklistHistoryCard,
  isRunComplete,
  TodaysChecklistsSection,
  useTodaysRuns,
} from '@/features/checklists'
import { LatestLogEntrySection } from '@/features/daily-log'
import { useGymScope } from '@/features/gyms'
import { OpenIncidentsSection } from '@/features/incidents'
import { UnreadNewsSection } from '@/features/news'

/**
 * Home (P7M-03): one list a phone reads top to bottom, in the order spec §2.2
 * puts it — what somebody has to read, what the gym still has to get through
 * today, what is broken, and the last thing written in the log — under one
 * button for the shift's next step. The week behind the checklists (P4-05)
 * sits underneath, and only the people who run a gym see it.
 */
export function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <PageHeader title={t('home.title')} />
      <NextAction />
      <UnreadNewsSection />
      <TodaysChecklistsSection />
      <OpenIncidentsSection />
      <LatestLogEntrySection />
      <ChecklistHistoryCard />
    </div>
  )
}

/**
 * The one violet button on the page: the first unfinished checklist of the
 * day, or, when there is none, the log — a shift with nothing to tick still
 * writes its handover.
 */
function NextAction() {
  const { t } = useTranslation()
  const { gymId } = useGymScope()
  const runs = useTodaysRuns(gymId)
  if (!runs.data) return null

  const unfinished = runs.data.find((run) => !isRunComplete(run))
  return (
    // A template name is in the label, and Danish ones run long: the pill
    // grows instead of clipping (P7M-05).
    <Button asChild className="h-auto min-h-11 w-full py-2 whitespace-normal md:w-auto">
      {unfinished ? (
        <Link to="/checklists">
          {t('home.next.continue', {
            name: unfinished.checklist_templates?.name ?? t('checklists.untitledRun'),
          })}
        </Link>
      ) : (
        <Link to="/daily-log">{t('dailyLog.add')}</Link>
      )}
    </Button>
  )
}
