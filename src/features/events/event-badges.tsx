import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { eventGymNames, isCompanyWide, type GymEvent } from './queries'

/** How many gyms are named before the badge switches to a count. */
const namedGyms = 2

/**
 * The type, and where it is on. Where is always shown: an event running at two
 * of the three gyms reads differently from a company-wide one, whichever scope
 * the switcher is in.
 */
export function EventBadges({
  event,
}: {
  event: Pick<GymEvent, 'event_type' | 'event_gyms'>
}) {
  const { t } = useTranslation()
  const names = eventGymNames(event)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone="info">{t(`events.type.${event.event_type}`)}</StatusBadge>

      {isCompanyWide(event) ? (
        <StatusBadge tone="neutral">{t('events.companyWide')}</StatusBadge>
      ) : names.length > namedGyms ? (
        // Naming five gyms costs more room than it earns; the form is where
        // the full list is read.
        <Tooltip>
          <TooltipTrigger asChild>
            <StatusBadge tone="neutral" tabIndex={0}>
              {t('events.gymCount', { count: names.length })}
            </StatusBadge>
          </TooltipTrigger>
          <TooltipContent>{names.join(', ')}</TooltipContent>
        </Tooltip>
      ) : (
        names.map((name) => (
          <StatusBadge key={name} tone="neutral">
            {name}
          </StatusBadge>
        ))
      )}
    </div>
  )
}
