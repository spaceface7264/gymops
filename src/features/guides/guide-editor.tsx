import type { JSONContent } from '@tiptap/react'
import { useFormTouched } from '@/hooks/use-form-touched'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useNavigate, useParams } from 'react-router'
import { LoadingState, PageHeader } from '@/components'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  emptyDoc,
  isEmptyDoc,
  MissingRequirements,
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

// Radix treats an empty value as "no value chosen" and shows the placeholder
// instead of the item, so "no category" needs a value of its own.
const noCategory = 'none'

/** Route component for `/guides/new` and `/guides/:guideId/edit`. */
export function GuideEditorPage() {
  const { guideId } = useParams<{ guideId: string }>()
  const { t } = useTranslation()
  const existing = useGuide(guideId)

  if (guideId && existing.isPending) {
    return <LoadingState rows={5} />
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

  const missing = [
    title.trim() === '' && t('guides.needsTitle'),
    isEmptyDoc(body) && t('guides.needsBody'),
    !scope.canPublishIn(gymId) && t('guides.needsPermission'),
  ].filter((reason): reason is string => Boolean(reason))
  const canSave = missing.length === 0

  const submit = (status: GuideInput['status']) => {
    const input: GuideInput = { gymId, categoryId, title, body, requiresAck, status }
    const saved = () =>
      toast.success(
        status === 'published'
          ? t('guides.published')
          : guide?.status === 'published'
            ? t('guides.saved')
            : t('guides.draftSaved'),
      )

    if (guide) {
      update.mutate(
        {
          id: guide.id,
          version: significantChange ? guide.version + 1 : null,
          ...input,
        },
        {
          onSuccess: () => {
            saved()
            void navigate(`/guides/${guide.id}`)
          },
        },
      )
    } else {
      create.mutate(input, {
        onSuccess: (id) => {
          saved()
          void navigate(`/guides/${id}`)
        },
      })
    }
  }

  const { touched, formProps } = useFormTouched()
  return (
    <form
      {...formProps}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit(guide?.status ?? 'draft')
      }}
    >
      <PageHeader title={guide ? t('guides.editTitle') : t('guides.createTitle')} />

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-scope`}>{t('guides.scope')}</Label>
        <Select
          value={gymId ?? 'company'}
          onValueChange={(value) => {
            // Radix keeps a hidden native select for form submission, and it
            // fires an empty value whenever the current one matches no option
            // — here, the render before the profile that decides the scope
            // arrives. Taking it would scope the post to nobody.
            if (value === '') return
            setChosenGymId(value === 'company' ? null : value)
          }}
        >
          <SelectTrigger id={`${fieldId}-scope`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {scope.canPublishCompanyWide && (
                <SelectItem value="company">{t('guides.companyWide')}</SelectItem>
              )}
              {scope.publishableGyms.map((gym) => (
                <SelectItem key={gym.id} value={gym.id}>
                  {gym.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-category`}>{t('guides.category')}</Label>
        <Select
          value={categoryId ?? noCategory}
          onValueChange={(value) => {
            // Radix keeps a hidden native select for form submission, and it
            // fires an empty value whenever the current one matches no option
            // — here, the render before the profile that decides the scope
            // arrives. Taking it would scope the post to nobody.
            if (value === '') return
            setCategoryId(value === noCategory ? null : value)
          }}
        >
          <SelectTrigger id={`${fieldId}-category`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value={noCategory}>{t('guides.noCategory')}</SelectItem>
              {(categories.data ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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

      <div className="flex min-h-11 items-center gap-3">
        <Checkbox
          id={`${fieldId}-ack`}
          checked={requiresAck}
          onCheckedChange={(checked) => setRequiresAck(checked === true)}
        />
        <Label htmlFor={`${fieldId}-ack`}>{t('guides.requireAcknowledgement')}</Label>
      </div>

      {guide && requiresAck && (
        <div className="flex min-h-11 items-center gap-3">
          <Checkbox
            id={`${fieldId}-significant`}
            checked={significantChange}
            onCheckedChange={(checked) => setSignificantChange(checked === true)}
          />
          <Label htmlFor={`${fieldId}-significant`}>
            {t('guides.significantChange')}
          </Label>
        </div>
      )}

      <MissingRequirements reasons={touched ? missing : []} />

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('guides.saveFailed')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="outline"
          className="w-full md:w-auto"
          disabled={!canSave || save.isPending}
        >
          {guide?.status === 'published' ? t('guides.save') : t('guides.saveDraft')}
        </Button>
        {guide?.status !== 'published' && (
          <Button
            type="button"
            className="w-full md:w-auto"
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
