import { ArrowLeft, Camera, ImagePlus, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCompletionScope } from '@/features/checklists'
import { MissingRequirements } from '@/features/content'
import { useGymScope } from '@/features/gyms'
import {
  incidentKinds,
  incidentSeverities,
  useCreateIncident,
  useUploadPhotos,
  type IncidentKind,
  type IncidentSeverity,
} from './queries'

/**
 * `/incidents/new`: what happened, how bad, and the photographs. The photos are
 * held here and uploaded once the incident exists, because both the storage
 * path and `incident_attachments` need its id.
 *
 * `?title=` and `?body=` pre-fill the form, which is how P4-09 will turn a
 * daily-log issue into a report.
 */
export function IncidentFormPage() {
  const { t } = useTranslation()
  const fieldId = useId()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { gymId } = useGymScope()
  const { canCompleteIn } = useCompletionScope()
  const create = useCreateIncident()
  const upload = useUploadPhotos()

  const [kind, setKind] = useState<IncidentKind>('other')
  const [severity, setSeverity] = useState<IncidentSeverity>('low')
  const [title, setTitle] = useState(params.get('title') ?? '')
  const [body, setBody] = useState(params.get('body') ?? '')
  const [photos, setPhotos] = useState<File[]>([])
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const canReportHere = gymId !== null && canCompleteIn(gymId)
  const missing = [
    ...(gymId === null ? [t('incidents.pickGym')] : []),
    ...(gymId !== null && !canReportHere ? [t('incidents.notYourGym')] : []),
    ...(title.trim() === '' ? [t('incidents.needsTitle')] : []),
    ...(body.trim() === '' ? [t('incidents.needsBody')] : []),
  ]

  const submit = async () => {
    if (gymId === null) return

    const incidentId = await create.mutateAsync({ gymId, kind, severity, title, body })
    if (photos.length > 0) {
      await upload.mutateAsync({ gymId, incidentId, files: photos })
    }
    void navigate(`/incidents/${incidentId}`)
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/incidents">
          <ArrowLeft className="size-4" />
          {t('incidents.backToList')}
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold">{t('incidents.report')}</h1>

      <Card className="p-4">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            // Both mutations record their own failure; catching here only keeps
            // the rejection from escaping as an unhandled one.
            void submit().catch(() => undefined)
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-title`}>{t('incidents.titleLabel')}</Label>
            <Input
              id={`${fieldId}-title`}
              value={title}
              placeholder={t('incidents.titlePlaceholder')}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${fieldId}-kind`}>{t('incidents.kindLabel')}</Label>
              <select
                id={`${fieldId}-kind`}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={kind}
                onChange={(event) => setKind(event.target.value as IncidentKind)}
              >
                {incidentKinds.map((option) => (
                  <option key={option} value={option}>
                    {t(`incidents.kind.${option}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${fieldId}-severity`}>
                {t('incidents.severityLabel')}
              </Label>
              <select
                id={`${fieldId}-severity`}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
              >
                {incidentSeverities.map((option) => (
                  <option key={option} value={option}>
                    {t(`incidents.severity.${option}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-body`}>{t('incidents.bodyLabel')}</Label>
            <textarea
              id={`${fieldId}-body`}
              className="border-input bg-background min-h-24 w-full rounded-md border p-2 text-sm"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">{t('incidents.photos')}</span>
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              data-testid="incident-camera"
              onChange={(event) =>
                setPhotos((chosen) => [...chosen, ...(event.target.files ?? [])])
              }
            />
            <input
              ref={libraryInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              data-testid="incident-library"
              onChange={(event) =>
                setPhotos((chosen) => [...chosen, ...(event.target.files ?? [])])
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInput.current?.click()}
              >
                <Camera className="size-4" />
                {t('incidents.takePhoto')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => libraryInput.current?.click()}
              >
                <ImagePlus className="size-4" />
                {t('incidents.addPhoto')}
              </Button>
            </div>

            {photos.length > 0 && (
              <ul className="space-y-1">
                {photos.map((photo, index) => (
                  <li
                    key={`${photo.name}-${index}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="truncate">{photo.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t('incidents.removePhoto', { name: photo.name })}
                      onClick={() =>
                        setPhotos((chosen) => chosen.filter((_photo, at) => at !== index))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <MissingRequirements reasons={missing} />

          {(create.isError || upload.isError) && (
            <p role="alert" className="text-destructive text-sm">
              {t('incidents.saveFailed')}
            </p>
          )}

          <Button
            type="submit"
            disabled={missing.length > 0 || create.isPending || upload.isPending}
          >
            {t('incidents.submit')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
