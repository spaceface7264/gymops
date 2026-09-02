import { ChecklistHistoryCard, TodaysChecklistsCard } from '@/features/checklists'
import { LatestLogEntryCard } from '@/features/daily-log'
import { OpenIncidentsCard } from '@/features/incidents'
import { UnreadNewsCard } from '@/features/news'

/**
 * Home, in the order spec §2.2 puts it: what somebody has to read, what the
 * gym still has to get through today, what is broken, and the last thing
 * written in the log. The week behind the checklists (P4-05) sits underneath,
 * and only the people who run a gym see it.
 */
export function HomePage() {
  return (
    <div className="space-y-4">
      <UnreadNewsCard />
      <TodaysChecklistsCard />
      <OpenIncidentsCard />
      <LatestLogEntryCard />
      <ChecklistHistoryCard />
    </div>
  )
}
