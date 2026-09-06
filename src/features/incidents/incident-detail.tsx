import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { LoadingState, PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompletionScope } from '@/features/checklists'
import { usePublishScope } from '@/features/content'
import { useGymScope } from '@/features/gyms'
import { CommentThread } from './comment-thread'
import { IncidentBadges } from './incident-badges'
import { PhotoGrid } from './photo-grid'
import {
  incidentSeverities,
  incidentStatuses,
  useGymMembers,
  useIncident,
  useUpdateIncident,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
} from './queries'

/**
 * Status, severity and assignee: the handling half of §2.1, offered only to
 * the people `can_publish_content()` lets through. The member list comes from
 * `gym_memberships`, which RLS shows to exactly those people.
 */
function HandlingControls({ incident }: { incident: Incident }) {
  const { t } = useTranslation()
  const update = useUpdateIncident()
  const members = useGymMembers(incident.gym_id)

  return (
    <Card className="space-y-3 p-4">
      <div className="space-y-1">
        <span className="text-sm font-medium">{t('incidents.statusLabel')}</span>
        <ToggleGroup
          type="single"
          aria-label={t('incidents.statusLabel')}
          value={incident.status}
          disabled={update.isPending}
          onValueChange={(status) => {
            if (status)
              update.mutate({ id: incident.id, status: status as IncidentStatus })
          }}
        >
          {incidentStatuses.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {t(`incidents.status.${option}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label htmlFor="incident-severity">{t('incidents.severityLabel')}</Label>
          <Select
            value={incident.severity}
            disabled={update.isPending}
            onValueChange={(value) =>
              update.mutate({
                id: incident.id,
                severity: value as IncidentSeverity,
              })
            }
          >
            <SelectTrigger id="incident-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {incidentSeverities.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`incidents.severity.${option}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="incident-assignee">{t('incidents.assigneeLabel')}</Label>
          <NativeSelect
            id="incident-assignee"

            value={incident.assignee_id ?? ''}
            disabled={update.isPending}
            onChange={(event) =>
              update.mutate({
                id: incident.id,
                assignee_id: event.target.value || null,
              })
            }
          >
            <option value="">{t('incidents.nobody')}</option>
            {(members.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name ?? t('incidents.someone')}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {update.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('incidents.saveFailed')}
        </p>
      )}
    </Card>
  )
}

/** `/incidents/:incidentId`: the report, its photographs and its thread. */
export function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>()
  const { t, i18n } = useTranslation()
  const { gymId } = useGymScope()
  const { canCompleteIn } = useCompletionScope()
  const publish = usePublishScope()
  const incident = useIncident(incidentId ?? '')

  if (incident.isPending) return <LoadingState rows={5} />
  if (!incident.data) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('incidents.notFound')}
      </p>
    )
  }

  const canHandle = publish.canPublishIn(incident.data.gym_id)
  // Adding to somebody else's report is working in that gym, same as filing one.
  const canContribute = canCompleteIn(incident.data.gym_id)

  return (
    <article className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/incidents">
          <ArrowLeft className="size-4" />
          {t('incidents.backToList')}
        </Link>
      </Button>

      <header className="space-y-2">
        <IncidentBadges incident={incident.data} showGym={gymId === null} />
        <PageHeader title={incident.data.title} />
        <p className="text-muted-foreground text-sm">
          {t('incidents.reportedBy', {
            who: incident.data.reporter?.full_name ?? t('incidents.someone'),
            when: new Date(incident.data.created_at).toLocaleString(i18n.language, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            }),
          })}
        </p>
        <p className="text-muted-foreground text-sm">
          {incident.data.assignee
            ? t('incidents.assignedTo', {
                who: incident.data.assignee.full_name ?? t('incidents.someone'),
              })
            : t('incidents.unassigned')}
        </p>
      </header>

      <p className="text-sm whitespace-pre-line">{incident.data.body}</p>

      {canHandle && <HandlingControls incident={incident.data} />}

      <PhotoGrid
        incidentId={incident.data.id}
        gymId={incident.data.gym_id}
        canAdd={canContribute}
      />

      <CommentThread incidentId={incident.data.id} canComment={canContribute} />
    </article>
  )
}
