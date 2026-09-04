import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MissingRequirements } from '@/features/content'
import type { Gym } from '@/features/gyms'
import { formatTime } from './event-date'
import {
  eventTypes,
  useCreateEvent,
  useUpdateEvent,
  type EventInput,
  type GymEvent,
} from './queries'

const selectClassName =
  'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-xl border px-3.5 py-1 text-base outline-none focus-visible:ring-[3px]'

const linkPattern = /^https?:\/\/\S+$/

function emptyEvent(gymId: string | null): EventInput {
  return {
    gymIds: gymId ? [gymId] : [],
    eventType: 'community',
    title: '',
    description: '',
    link: '',
    startsOn: '',
    startTime: '',
    endsOn: '',
    endTime: '',
  }
}

/** Create or edit one event. `event` decides which. */
export function EventDialog({
  event,
  defaultGymId,
  gyms,
  open,
  onOpenChange,
}: {
  event?: GymEvent
  defaultGymId: string | null
  gyms: Gym[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts the content when closed, so the form starts from the
          event it was opened on and needs no effect to reset itself. */}
      <DialogContent>
        <EventForm
          event={event}
          defaultGymId={defaultGymId}
          gyms={gyms}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function EventForm({
  event,
  defaultGymId,
  gyms,
  onDone,
}: {
  event?: GymEvent
  defaultGymId: string | null
  gyms: Gym[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const save = event ? update : create

  const [values, setValues] = useState<EventInput>(() =>
    event
      ? {
          gymIds: event.event_gyms.map((scope) => scope.gym_id),
          eventType: event.event_type,
          title: event.title,
          description: event.description,
          link: event.link ?? '',
          startsOn: event.starts_on,
          startTime: event.start_time ? formatTime(event.start_time) : '',
          endsOn: event.ends_on ?? '',
          endTime: event.end_time ? formatTime(event.end_time) : '',
        }
      : emptyEvent(defaultGymId),
  )
  const [multiDay, setMultiDay] = useState(Boolean(event?.ends_on))

  const set = (patch: Partial<EventInput>) =>
    setValues((current) => ({ ...current, ...patch }))

  // The same rules the CHECK constraints enforce, said before the round trip.
  const lastOn = values.endsOn || values.startsOn
  const reasons = [
    !values.title.trim() && t('events.needsTitle'),
    !values.startsOn && t('events.needsStart'),
    values.endsOn && values.endsOn < values.startsOn && t('events.needsValidRange'),
    values.endTime && !values.startTime && t('events.needsStartTime'),
    values.endTime &&
      values.startTime &&
      lastOn === values.startsOn &&
      values.endTime <= values.startTime &&
      t('events.needsValidTimes'),
    values.link && !linkPattern.test(values.link.trim()) && t('events.needsValidLink'),
  ].filter((reason): reason is string => Boolean(reason))

  function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (reasons.length > 0) return

    const input: EventInput = multiDay ? values : { ...values, endsOn: '' }

    const saved = () => {
      toast.success(t('events.saved'))
      onDone()
    }
    if (event) {
      update.mutate({ id: event.id, ...input }, { onSuccess: saved })
    } else {
      create.mutate(input, { onSuccess: saved })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {event ? t('events.editTitle') : t('events.createTitle')}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-title`}>{t('events.titleField')}</Label>
        <Input
          id={`${fieldId}-title`}
          value={values.title}
          onChange={(input) => set({ title: input.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-description`}>{t('events.description')}</Label>
        <textarea
          id={`${fieldId}-description`}
          rows={3}
          className={`${selectClassName} h-auto py-1.5`}
          value={values.description}
          onChange={(input) => set({ description: input.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-type`}>{t('events.typeLabel')}</Label>
        <select
          id={`${fieldId}-type`}
          className={selectClassName}
          value={values.eventType}
          onChange={(input) =>
            set({ eventType: input.target.value as EventInput['eventType'] })
          }
        >
          {eventTypes.map((option) => (
            <option key={option} value={option}>
              {t(`events.type.${option}`)}
            </option>
          ))}
        </select>
      </div>

      {/* One event, any number of gyms. "Company-wide" is the absence of a
          restriction, so picking it clears the rest rather than adding a row
          per gym that would then have to keep up as gyms open and close. */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('events.scope')}</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            variant="outline"
            pressed={values.gymIds.length === 0}
            onPressedChange={() => set({ gymIds: [] })}
          >
            {t('events.companyWide')}
          </Toggle>
          <ToggleGroup
            type="multiple"
            variant="outline"
            aria-label={t('events.scope')}
            value={values.gymIds}
            onValueChange={(gymIds) => set({ gymIds })}
          >
            {gyms.map((gym) => (
              <ToggleGroupItem key={gym.id} value={gym.id}>
                {gym.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-starts`}>{t('events.startDate')}</Label>
          <Input
            id={`${fieldId}-starts`}
            type="date"
            value={values.startsOn}
            onChange={(input) => set({ startsOn: input.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-start-time`}>{t('events.startTime')}</Label>
          <Input
            id={`${fieldId}-start-time`}
            type="time"
            value={values.startTime ?? ''}
            onChange={(input) => set({ startTime: input.target.value })}
          />
        </div>
      </div>

      <Toggle
        variant="outline"
        pressed={multiDay}
        onPressedChange={(pressed) => {
          setMultiDay(pressed)
          if (!pressed) set({ endsOn: '' })
        }}
      >
        {t('events.multiDay')}
      </Toggle>

      {multiDay && (
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-ends`}>{t('events.endDate')}</Label>
          <Input
            id={`${fieldId}-ends`}
            type="date"
            min={values.startsOn || undefined}
            value={values.endsOn ?? ''}
            onChange={(input) => set({ endsOn: input.target.value })}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-end-time`}>{t('events.endTime')}</Label>
          <Input
            id={`${fieldId}-end-time`}
            type="time"
            value={values.endTime ?? ''}
            onChange={(input) => set({ endTime: input.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-link`}>{t('events.link')}</Label>
          <Input
            id={`${fieldId}-link`}
            type="url"
            placeholder="https://"
            value={values.link ?? ''}
            onChange={(input) => set({ link: input.target.value })}
          />
        </div>
      </div>

      <MissingRequirements reasons={reasons} />

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('events.saveFailed')}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('events.cancel')}
        </Button>
        <Button type="submit" disabled={reasons.length > 0 || save.isPending}>
          {save.isPending ? t('events.saving') : t('events.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
