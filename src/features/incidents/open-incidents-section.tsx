import { useTranslation } from 'react-i18next'
import {
  HomeEmpty,
  HomeRow,
  HomeRows,
  HomeSection,
  HomeSectionLink,
  LoadingState,
  StatusBadge,
  LoadError,
} from '@/components'
import { useGymScope } from '@/features/gyms'
import { useIncidents } from './queries'

/** How many fit on a home page before it stops being a summary. */
const shown = 5

/**
 * The home page's incident block (P4-10): what is still open here, worst
 * first, so a high-severity report cannot be pushed off the list by five
 * newer small ones.
 */
export function OpenIncidentsSection() {
  const { t } = useTranslation()
  const { gymId } = useGymScope()
  const incidents = useIncidents(gymId, { status: 'open_only', kind: 'all' })

  const severityOrder = { high: 0, medium: 1, low: 2 }
  const open = [...(incidents.data ?? [])].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  )

  return (
    <HomeSection
      title={t('home.incidents.title')}
      // Reporting is never more than two taps from Home (PRODUCT.md), and the
      // photo is the part that fades: the link is there whether or not
      // anything is open (P7M-05).
      action={
        <HomeSectionLink to="/incidents/new">
          {t('home.incidents.report')}
        </HomeSectionLink>
      }
    >
      {incidents.isPending && <LoadingState rows={2} />}
      {incidents.isError && (
        <LoadError
          message={t('incidents.loadFailed')}
          onRetry={() => void incidents.refetch()}
        />
      )}
      {incidents.data && open.length === 0 && (
        <HomeEmpty>{t('home.incidents.none')}</HomeEmpty>
      )}

      {open.length > 0 && (
        <HomeRows>
          {open.slice(0, shown).map((incident) => (
            <HomeRow
              key={incident.id}
              to={`/incidents/${incident.id}`}
              badge={
                <StatusBadge
                  tone={
                    incident.severity === 'high'
                      ? 'danger'
                      : incident.severity === 'medium'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {t(`incidents.severity.${incident.severity}`)}
                </StatusBadge>
              }
              meta={
                (incident.assignee
                  ? t('incidents.assignedTo', {
                      who: incident.assignee.full_name ?? t('incidents.someone'),
                    })
                  : t('home.incidents.unassigned')) +
                (gymId === null && incident.gyms ? ` · ${incident.gyms.name}` : '')
              }
            >
              {incident.title}
            </HomeRow>
          ))}
        </HomeRows>
      )}
      {open.length > 0 && (
        <HomeSectionLink to="/incidents">
          {open.length > shown
            ? t('home.incidents.allOpen', { count: open.length })
            : t('home.incidents.all')}
        </HomeSectionLink>
      )}
    </HomeSection>
  )
}
