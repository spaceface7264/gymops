import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
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
      <Badge variant="secondary">{t(`events.type.${event.event_type}`)}</Badge>

      {isCompanyWide(event) ? (
        <Badge variant="outline">{t('events.companyWide')}</Badge>
      ) : names.length > namedGyms ? (
        // Naming five gyms costs more room than it earns; the form is where
        // the full list is read.
        <Badge variant="outline" title={names.join(', ')}>
          {t('events.gymCount', { count: names.length })}
        </Badge>
      ) : (
        names.map((name) => (
          <Badge key={name} variant="outline">
            {name}
          </Badge>
        ))
      )}
    </div>
  )
}
