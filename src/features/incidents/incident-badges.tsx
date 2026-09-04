import { useTranslation } from 'react-i18next'
import { StatusBadge, type Tone } from '@/components'
import type { Incident } from './queries'

/**
 * What is worth knowing about an incident at a glance. Severity is coloured
 * because a high one is the reason somebody scans this list at all; a resolved
 * incident is deliberately quiet.
 */
const statusTone: Record<Incident['status'], Tone> = {
  open: 'danger',
  in_progress: 'info',
  resolved: 'success',
}
const severityTone: Record<Incident['severity'], Tone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
}

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
      <StatusBadge tone={statusTone[incident.status]}>
        {t(`incidents.status.${incident.status}`)}
      </StatusBadge>
      <StatusBadge tone={severityTone[incident.severity]}>
        {t(`incidents.severity.${incident.severity}`)}
      </StatusBadge>
      <StatusBadge tone="neutral">{t(`incidents.kind.${incident.kind}`)}</StatusBadge>
      {showGym && incident.gyms && (
        <StatusBadge tone="neutral">{incident.gyms.name}</StatusBadge>
      )}
    </div>
  )
}
