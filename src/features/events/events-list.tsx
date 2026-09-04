import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState, LoadingState } from '@/components'
import { EventCard } from './event-card'
import { useEvents, type EventType, type GymEvent } from './queries'

/**
 * What is coming up here, and behind a toggle what already happened. Upcoming
 * counts a range that started last week but is still running: the split is on
 * the last day, not the first.
 */
export function EventsList({
  gymId,
  type,
  showPast,
  canManage,
  onEdit,
}: {
  gymId: string | null
  type: EventType | 'all'
  showPast: boolean
  canManage: boolean
  onEdit: (event: GymEvent) => void
}) {
  const { t } = useTranslation()
  const events = useEvents(gymId, showPast ? 'past' : 'upcoming')

  const visible = (events.data ?? []).filter(
    (event) => type === 'all' || event.event_type === type,
  )

  if (events.isPending) {
    return <LoadingState rows={5} />
  }

  if (events.isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('events.loadFailed')}
      </p>
    )
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={showPast ? t('events.emptyPast') : t('events.emptyUpcoming')}
      />
    )
  }

  return (
    <ul className="space-y-2">
      {visible.map((event) => (
        <li key={event.id}>
          <EventCard event={event} canManage={canManage} onEdit={onEdit} />
        </li>
      ))}
    </ul>
  )
}
