import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { weekdayNames } from '@/features/checklists'
import { eventsByDay, formatTime } from './event-date'
import {
  monthGridDays,
  monthLabel,
  monthWindow,
  todayIso,
  type MonthCursor,
} from './month-grid'
import { useEvents, type EventType, type GymEvent } from './queries'

/**
 * The month, Monday first. A multi-day event gets a chip on every day it
 * covers rather than a bar drawn across the columns: lane assignment and row
 * measurement buy nothing here, and the repeated chip is what survives the
 * grid collapsing on a phone.
 */
export function EventCalendar({
  gymId,
  type,
  cursor,
  onMonthChange,
  canManage,
  onEdit,
}: {
  gymId: string | null
  type: EventType | 'all'
  cursor: MonthCursor
  onMonthChange: (delta: number) => void
  canManage: boolean
  onEdit: (event: GymEvent) => void
}) {
  const { t, i18n } = useTranslation()
  const events = useEvents(gymId, monthWindow(cursor))

  const days = monthGridDays(cursor)
  const visible = (events.data ?? []).filter(
    (event) => type === 'all' || event.event_type === type,
  )
  const byDay = eventsByDay(visible, days)
  const today = todayIso()
  const month = String(cursor.month).padStart(2, '0')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-label={t('events.previousMonth')}
          onClick={() => onMonthChange(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label={t('events.nextMonth')}
          onClick={() => onMonthChange(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="text-lg font-medium">{monthLabel(cursor, i18n.language)}</h2>
      </div>

      {events.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('events.loadFailed')}
        </p>
      )}

      <div className="grid grid-cols-7 gap-px text-xs" role="grid">
        {weekdayNames(i18n.language).map((name) => (
          <div key={name} className="text-muted-foreground p-1 text-center font-medium">
            {name}
          </div>
        ))}

        {days.map((day) => {
          const inMonth = day.slice(5, 7) === month
          const dayEvents = byDay.get(day) ?? []

          return (
            <div
              key={day}
              className={`min-h-20 rounded border p-1 ${inMonth ? '' : 'opacity-50'} ${
                day === today ? 'border-primary' : 'border-border'
              }`}
            >
              <div className="text-muted-foreground mb-1 text-right">
                {Number(day.slice(8, 10))}
              </div>
              <ul className="space-y-0.5">
                {dayEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => onEdit(event)}
                      title={event.title}
                      className="bg-secondary text-secondary-foreground w-full truncate rounded px-1 py-0.5 text-left enabled:cursor-pointer"
                    >
                      {event.start_time && `${formatTime(event.start_time)} `}
                      {event.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
