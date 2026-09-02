import type { JSONContent } from '@tiptap/react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  emptyDoc,
  isEmptyDoc,
  RichTextEditor,
  toDoc,
  usePublishScope,
} from '@/features/content'
import { useGymScope } from '@/features/gyms'
import {
  useCreateGuide,
  useGuide,
  useGuideCategories,
  useUpdateGuide,
  type Guide,
  type GuideInput,
} from './queries'

/** Route component for `/guides/new` and `/guides/:guideId/edit`. */
export function GuideEditorPage() {
  const { guideId } = useParams<{ guideId: string }>()
  const { t } = useTranslation()
  const existing = useGuide(guideId)

  if (guideId && existing.isPending) {
    return <p className="text-muted-foreground text-sm">{t('guides.loading')}</p>
  }
  if (guideId && !existing.data) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('guides.notFound')}
      </p>
    )
  }

  return <GuideEditor key={guideId ?? 'new'} guide={existing.data} />
}

function GuideEditor({ guide }: { guide?: Guide }) {
  const { t } = useTranslation()
  const fieldId = useId()
  const navigate = useNavigate()
  const scope = usePublishScope()
  const { gymId: currentGym } = useGymScope()
  const categories = useGuideCategories()
  const create = useCreateGuide()
  const update = useUpdateGuide()
  const save = guide ? update : create

  const [title, setTitle] = useState(guide?.title ?? '')
  const [body, setBody] = useState<JSONContent>(() =>
    guide ? toDoc(guide.body) : emptyDoc,
  )
  const [requiresAck, setRequiresAck] = useState(guide?.requires_ack ?? false)
  const [categoryId, setCategoryId] = useState<string | null>(guide?.category_id ?? null)
  // Everyone who confirmed the previous version confirms again.
  const [significantChange, setSignificantChange] = useState(false)
  // Resolved at render, not captured: the profile that says where this author
  // may publish arrives a render after the form mounts.
  const [chosenGymId, setChosenGymId] = useState<string | null | undefined>(
    guide ? guide.gym_id : undefined,
  )

  const defaultGymId = scope.canPublishIn(currentGym)
    ? currentGym
    : scope.canPublishCompanyWide
      ? null
      : (scope.publishableGyms[0]?.id ?? null)
  const gymId = chosenGymId === undefined ? defaultGymId : chosenGymId

  const canSave = title.trim() !== '' && !isEmptyDoc(body) && scope.canPublishIn(gymId)

  const submit = (status: GuideInput['status']) => {
    const input: GuideInput = { gymId, categoryId, title, body, requiresAck, status }

    if (guide) {
      update.mutate(
        {
          id: guide.id,
          version: significantChange ? guide.version + 1 : null,
          ...input,
        },
        { onSuccess: () => void navigate(`/guides/${guide.id}`) },
      )
    } else {
      create.mutate(input, { onSuccess: (id) => void navigate(`/guides/${id}`) })
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit(guide?.status ?? 'draft')
      }}
    >
      <h1 className="text-2xl font-semibold">
        {guide ? t('guides.editTitle') : t('guides.createTitle')}
      </h1>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-scope`}>{t('guides.scope')}</Label>
        <select
          id={`${fieldId}-scope`}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={gymId ?? 'company'}
          onChange={(event) =>
            setChosenGymId(event.target.value === 'company' ? null : event.target.value)
          }
        >
          {scope.canPublishCompanyWide && (
            <option value="company">{t('guides.companyWide')}</option>
          )}
          {scope.publishableGyms.map((gym) => (
            <option key={gym.id} value={gym.id}>
              {gym.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-category`}>{t('guides.category')}</Label>
        <select
          id={`${fieldId}-category`}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={categoryId ?? ''}
          onChange={(event) => setCategoryId(event.target.value || null)}
        >
          <option value="">{t('guides.noCategory')}</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-title`}>{t('guides.guideTitle')}</Label>
        <Input
          id={`${fieldId}-title`}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-body`}>{t('guides.body')}</Label>
        <RichTextEditor
          doc={body}
          onChange={setBody}
          gymId={gymId}
          aria-label={t('guides.body')}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`${fieldId}-ack`}
          type="checkbox"
          className="size-4"
          checked={requiresAck}
          onChange={(event) => setRequiresAck(event.target.checked)}
        />
        <Label htmlFor={`${fieldId}-ack`}>{t('guides.requireAcknowledgement')}</Label>
      </div>

      {guide && requiresAck && (
        <div className="flex items-center gap-2">
          <input
            id={`${fieldId}-significant`}
            type="checkbox"
            className="size-4"
            checked={significantChange}
            onChange={(event) => setSignificantChange(event.target.checked)}
          />
          <Label htmlFor={`${fieldId}-significant`}>
            {t('guides.significantChange')}
          </Label>
        </div>
      )}

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('guides.saveFailed')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={!canSave || save.isPending}>
          {guide?.status === 'published' ? t('guides.save') : t('guides.saveDraft')}
        </Button>
        {guide?.status !== 'published' && (
          <Button
            type="button"
            disabled={!canSave || save.isPending}
            onClick={() => submit('published')}
          >
            {t('guides.publish')}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => void navigate(guide ? `/guides/${guide.id}` : '/guides')}
        >
          {t('guides.cancel')}
        </Button>
      </div>
    </form>
  )
}
