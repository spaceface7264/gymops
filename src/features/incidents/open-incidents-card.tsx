import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, LoadingState, StatusBadge } from '@/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGymScope } from '@/features/gyms'
import { useIncidents } from './queries'

/** How many fit on a home page before it stops being a summary. */
const shown = 5

/**
 * The home page's incident block (P4-10): what is still open here, worst
 * first, so a high-severity report cannot be pushed off the list by five
 * newer small ones.
 */
export function OpenIncidentsCard() {
  const { t } = useTranslation()
  const { gymId } = useGymScope()
  const incidents = useIncidents(gymId, { status: 'open_only', kind: 'all' })

  const severityOrder = { high: 0, medium: 1, low: 2 }
  const open = [...(incidents.data ?? [])].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.incidents.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {incidents.isPending && <LoadingState rows={3} />}
        {incidents.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('incidents.loadFailed')}
          </p>
        )}
        {incidents.data && open.length === 0 && (
          <EmptyState icon={TriangleAlert} title={t('home.incidents.none')} />
        )}

        <ul className="space-y-2">
          {open.slice(0, shown).map((incident) => (
            <li key={incident.id} className="flex flex-wrap items-center gap-2">
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
              <Link
                to={`/incidents/${incident.id}`}
                className="font-medium hover:underline"
              >
                {incident.title}
              </Link>
              <span className="text-muted-foreground text-sm">
                {incident.assignee
                  ? t('incidents.assignedTo', {
                      who: incident.assignee.full_name ?? t('incidents.someone'),
                    })
                  : t('home.incidents.unassigned')}
                {gymId === null && incident.gyms ? ` · ${incident.gyms.name}` : ''}
              </span>
            </li>
          ))}
        </ul>

        {open.length > 0 && (
          <Button asChild variant="link" className="h-auto p-0">
            <Link to="/incidents">
              {open.length > shown
                ? t('home.incidents.allOpen', { count: open.length })
                : t('home.incidents.all')}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
