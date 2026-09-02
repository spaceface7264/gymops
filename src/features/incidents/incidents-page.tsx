import { ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompletionScope } from '@/features/checklists'
import { useGymScope } from '@/features/gyms'
import { IncidentBadges } from './incident-badges'
import {
  incidentKinds,
  useIncidents,
  type IncidentFilters,
  type IncidentKind,
} from './queries'

/** `/incidents`: what is still open here, newest first. */
export function IncidentsPage() {
  const { t, i18n } = useTranslation()
  const { gymId } = useGymScope()
  const { canCompleteIn } = useCompletionScope()

  // Opening on the unresolved ones: a resolved incident is history, and the
  // list is read mid-shift to find what still needs somebody.
  const [filters, setFilters] = useState<IncidentFilters>({
    status: 'open_only',
    kind: 'all',
  })
  const incidents = useIncidents(gymId, filters)

  const canReport = gymId !== null && canCompleteIn(gymId)
  const kindLabel =
    filters.kind === 'all' ? t('incidents.allKinds') : t(`incidents.kind.${filters.kind}`)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('incidents.title')}</h1>
        {canReport && (
          <Button asChild size="sm">
            <Link to="/incidents/new">
              <Plus className="size-4" />
              {t('incidents.report')}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {(['open_only', 'resolved', 'all'] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filters.status === option ? 'default' : 'outline'}
              aria-pressed={filters.status === option}
              onClick={() => setFilters((current) => ({ ...current, status: option }))}
            >
              {t(`incidents.filter.${option}`)}
            </Button>
          ))}
        </div>

        {/* The trigger carries the label and the current value, so the button's
            accessible name reads "Kind: Injury" without an aria-label hiding
            the value from a screen reader. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              {t('incidents.kindLabel')}: {kindLabel}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={filters.kind}
              onValueChange={(kind) =>
                setFilters((current) => ({
                  ...current,
                  kind: kind as IncidentKind | 'all',
                }))
              }
            >
              <DropdownMenuRadioItem value="all">
                {t('incidents.allKinds')}
              </DropdownMenuRadioItem>
              {incidentKinds.map((option) => (
                <DropdownMenuRadioItem key={option} value={option}>
                  {t(`incidents.kind.${option}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {incidents.isPending && (
        <p className="text-muted-foreground text-sm">{t('incidents.loading')}</p>
      )}
      {incidents.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('incidents.loadFailed')}
        </p>
      )}
      {incidents.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('incidents.empty')}</p>
      )}

      <ul className="space-y-2">
        {(incidents.data ?? []).map((incident) => (
          <li key={incident.id}>
            <Card className="p-4">
              <Link to={`/incidents/${incident.id}`} className="block space-y-2">
                <IncidentBadges incident={incident} showGym={gymId === null} />
                <h2 className="font-medium">{incident.title}</h2>
                <p className="text-muted-foreground text-xs">
                  {t('incidents.reportedBy', {
                    who: incident.reporter?.full_name ?? t('incidents.someone'),
                    when: new Date(incident.created_at).toLocaleString(i18n.language, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })}
                  {incident.assignee &&
                    ` · ${t('incidents.assignedTo', {
                      who: incident.assignee.full_name ?? t('incidents.someone'),
                    })}`}
                </p>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
