import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { Incident } from './queries'

/**
 * What is worth knowing about an incident at a glance. Severity is coloured
 * because a high one is the reason somebody scans this list at all; a resolved
 * incident is deliberately quiet.
 */
export function IncidentBadges({
  incident,
  showGym,
}: {
  incident: Pick<Incident, 'kind' | 'severity' | 'status' | 'gyms'>
  showGym: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={incident.status === 'resolved' ? 'outline' : 'default'}>
        {t(`incidents.status.${incident.status}`)}
      </Badge>
      <Badge
        variant={
          incident.severity === 'high'
            ? 'destructive'
            : incident.severity === 'medium'
              ? 'secondary'
              : 'outline'
        }
      >
        {t(`incidents.severity.${incident.severity}`)}
      </Badge>
      <Badge variant="secondary">{t(`incidents.kind.${incident.kind}`)}</Badge>
      {showGym && incident.gyms && <Badge variant="outline">{incident.gyms.name}</Badge>}
    </div>
  )
}
