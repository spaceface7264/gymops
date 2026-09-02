import { Camera, ImagePlus } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  useIncidentAttachments,
  useSignedPhotoUrl,
  useUploadPhotos,
  type IncidentAttachment,
} from './queries'

function Photo({ attachment }: { attachment: IncidentAttachment }) {
  const { t } = useTranslation()
  const url = useSignedPhotoUrl(attachment.path)

  if (!url.data) {
    return (
      <div className="bg-muted text-muted-foreground flex h-32 items-center justify-center rounded-md text-xs">
        {url.isError ? t('incidents.photoFailed') : t('incidents.photoLoading')}
      </div>
    )
  }

  return (
    <a href={url.data} target="_blank" rel="noreferrer">
      <img
        src={url.data}
        alt={t('incidents.photoAlt')}
        className="h-32 w-full rounded-md object-cover"
      />
    </a>
  )
}

/**
 * The photographs on an incident, and the two ways to add one. `capture` asks
 * a phone for the rear camera directly — the point of §2.2's "camera capture" —
 * while the second input is the same upload from a laptop's library.
 */
export function PhotoGrid({
  incidentId,
  gymId,
  canAdd,
}: {
  incidentId: string
  gymId: string
  canAdd: boolean
}) {
  const { t } = useTranslation()
  const attachments = useIncidentAttachments(incidentId)
  const upload = useUploadPhotos()
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const add = (files: FileList | null) => {
    if (files && files.length > 0) upload.mutate({ gymId, incidentId, files: [...files] })
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{t('incidents.photos')}</h2>

      {attachments.data && attachments.data.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.data.map((attachment) => (
            <li key={attachment.id}>
              <Photo attachment={attachment} />
            </li>
          ))}
        </ul>
      )}

      {attachments.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('incidents.noPhotos')}</p>
      )}

      {canAdd && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            data-testid="incident-camera"
            onChange={(event) => add(event.target.files)}
          />
          <input
            ref={libraryInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            data-testid="incident-library"
            onChange={(event) => add(event.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={upload.isPending}
            onClick={() => cameraInput.current?.click()}
          >
            <Camera className="size-4" />
            {t('incidents.takePhoto')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={upload.isPending}
            onClick={() => libraryInput.current?.click()}
          >
            <ImagePlus className="size-4" />
            {t('incidents.addPhoto')}
          </Button>
        </div>
      )}

      {upload.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('incidents.uploadFailed')}
        </p>
      )}
    </section>
  )
}
