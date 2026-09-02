import { UnreadNewsCard } from '@/features/news'

/**
 * Home. The news block lands here first (P3-07); today's checklists, open
 * incidents and the latest daily log entry join it in P4-10 (spec §2.2).
 */
export function HomePage() {
  return (
    <div className="space-y-4">
      <UnreadNewsCard />
    </div>
  )
}
