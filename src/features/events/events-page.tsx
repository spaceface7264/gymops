import { ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useGymScope } from '@/features/gyms'
import { EventCalendar } from './event-calendar'
import { EventDialog } from './event-dialog'
import { EventsList } from './events-list'
import { formatMonth, parseMonth, shiftMonth } from './month-grid'
import { useEventScope } from './permissions'
import { eventTypes, type EventType, type GymEvent } from './queries'

const views = ['list', 'calendar'] as const

/**
 * `/events`: what is on here. The view and the month live in the URL, so a
 * shared link opens where the sender was and Back leaves the month it came
 * from.
 */
export function EventsPage() {
  const { t } = useTranslation()
  const { gymId } = useGymScope()
  const { canManageEvents, scopableGyms } = useEventScope()

  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'calendar' ? 'calendar' : 'list'
  const cursor = parseMonth(params.get('month'))
  const type = (eventTypes as string[]).includes(params.get('type') ?? '')
    ? (params.get('type') as EventType)
    : 'all'

  const [showPast, setShowPast] = useState(false)
  const [editing, setEditing] = useState<GymEvent | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(event: GymEvent) {
    setEditing(event)
    setDialogOpen(true)
  }

  const typeLabel = type === 'all' ? t('events.allTypes') : t(`events.type.${type}`)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('events.title')}</h1>
        {canManageEvents && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            {t('events.new')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {views.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={view === option ? 'default' : 'outline'}
              aria-pressed={view === option}
              onClick={() => update({ view: option })}
            >
              {t(`events.view.${option}`)}
            </Button>
          ))}
        </div>

        {view === 'list' && (
          <Button
            size="sm"
            variant={showPast ? 'default' : 'outline'}
            aria-pressed={showPast}
            onClick={() => setShowPast(!showPast)}
          >
            {t('events.past')}
          </Button>
        )}

        {/* The trigger carries the label and the value, so its accessible name
            reads "Type: Offer" without an aria-label hiding the value. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              {t('events.typeLabel')}: {typeLabel}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={type}
              onValueChange={(value) => update({ type: value === 'all' ? null : value })}
            >
              <DropdownMenuRadioItem value="all">
                {t('events.allTypes')}
              </DropdownMenuRadioItem>
              {eventTypes.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {t(`events.type.${option}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {view === 'list' ? (
        <EventsList
          gymId={gymId}
          type={type}
          showPast={showPast}
          canManage={canManageEvents}
          onEdit={openEdit}
        />
      ) : (
        <EventCalendar
          gymId={gymId}
          type={type}
          cursor={cursor}
          onMonthChange={(delta) =>
            update({ month: formatMonth(shiftMonth(cursor, delta)) })
          }
          canManage={canManageEvents}
          onEdit={openEdit}
        />
      )}

      {canManageEvents && (
        <EventDialog
          key={editing?.id ?? 'new'}
          event={editing}
          defaultGymId={gymId}
          gyms={scopableGyms}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  )
}
