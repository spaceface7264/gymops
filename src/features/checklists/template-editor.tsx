import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
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
import { MissingRequirements, usePublishScope } from '@/features/content'
import { useGymScope } from '@/features/gyms'
import {
  useChecklistTemplate,
  useSaveChecklistTemplate,
  type ChecklistKind,
  type ChecklistTemplate,
} from './queries'
import { isoWeekdays, weekdayNames } from './weekdays'

const kinds: ChecklistKind[] = ['opening', 'closing', 'custom']

/** An item while it is being edited: `key` survives reordering, `id` is the saved row. */
type DraftItem = { key: string; id?: string; label: string; required: boolean }

const newDraftItem = (): DraftItem => ({
  key: crypto.randomUUID(),
  label: '',
  required: true,
})

/** Route component for `/checklists/templates/new` and `…/:templateId/edit`. */
export function ChecklistTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const { t } = useTranslation()
  const existing = useChecklistTemplate(templateId)

  if (templateId && existing.isPending) {
    return <p className="text-muted-foreground text-sm">{t('checklists.loading')}</p>
  }
  if (templateId && !existing.data) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t('checklists.notFound')}
      </p>
    )
  }

  return <TemplateEditor key={templateId ?? 'new'} template={existing.data} />
}

function TemplateEditor({ template }: { template?: ChecklistTemplate }) {
  const { t, i18n } = useTranslation()
  const fieldId = useId()
  const navigate = useNavigate()
  const scope = usePublishScope()
  const { gymId: currentGym } = useGymScope()
  const save = useSaveChecklistTemplate()

  const [name, setName] = useState(template?.name ?? '')
  const [kind, setKind] = useState<ChecklistKind>(template?.kind ?? 'opening')
  const [weekdays, setWeekdays] = useState<number[]>(
    template?.weekdays ?? [...isoWeekdays],
  )
  const [active, setActive] = useState(template?.active ?? true)
  const [items, setItems] = useState<DraftItem[]>(() =>
    template
      ? template.checklist_template_items.map((item) => ({
          key: item.id,
          id: item.id,
          label: item.label,
          required: item.required,
        }))
      : [newDraftItem()],
  )
  // Resolved at render, not captured: the profile that says where this manager
  // may publish arrives a render after the form mounts.
  const [chosenGymId, setChosenGymId] = useState<string | null | undefined>(
    template ? template.gym_id : undefined,
  )

  const defaultGymId = scope.canPublishIn(currentGym)
    ? currentGym
    : scope.canPublishCompanyWide
      ? null
      : (scope.publishableGyms[0]?.id ?? null)
  const gymId = chosenGymId === undefined ? defaultGymId : chosenGymId

  const filledItems = items.filter((item) => item.label.trim() !== '')
  // What still stands between this form and a saved checklist. Saying it is
  // the point: a greyed-out button with no reason is a dead end.
  const missing = [
    name.trim() === '' && t('checklists.needsName'),
    weekdays.length === 0 && t('checklists.needsDay'),
    filledItems.length === 0 && t('checklists.needsItem'),
    !scope.canPublishIn(gymId) && t('checklists.needsPermission'),
  ].filter((reason): reason is string => Boolean(reason))
  const canSave = missing.length === 0

  const updateItem = (key: string, change: Partial<DraftItem>) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    )

  const moveItem = (index: number, by: -1 | 1) =>
    setItems((current) => {
      const next = [...current]
      const moved = next[index]
      if (!moved) return current
      next.splice(index, 1)
      next.splice(index + by, 0, moved)
      return next
    })

  const names = weekdayNames(i18n.language)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate(
          {
            id: template?.id,
            gymId,
            kind,
            name,
            weekdays,
            active,
            // An item whose label was left blank was never really added.
            items: filledItems.map(({ id, label, required }) => ({
              id,
              label,
              required,
            })),
          },
          { onSuccess: () => void navigate('/checklists/templates') },
        )
      }}
    >
      <h1 className="text-2xl font-semibold">
        {template ? t('checklists.editTitle') : t('checklists.createTitle')}
      </h1>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-scope`}>{t('checklists.scope')}</Label>
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
                <SelectItem value="company">{t('checklists.companyWide')}</SelectItem>
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
        <Label htmlFor={`${fieldId}-kind`}>{t('checklists.kindLabel')}</Label>
        <Select value={kind} onValueChange={(value) => setKind(value as ChecklistKind)}>
          <SelectTrigger id={`${fieldId}-kind`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {kinds.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`checklists.kind.${option}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-name`}>{t('checklists.name')}</Label>
        <Input
          id={`${fieldId}-name`}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('checklists.schedule')}</legend>
        <div className="flex flex-wrap gap-3">
          {isoWeekdays.map((day) => (
            <div key={day} className="flex items-center gap-1.5">
              <input
                id={`${fieldId}-day-${day}`}
                type="checkbox"
                className="size-4"
                checked={weekdays.includes(day)}
                onChange={(event) =>
                  setWeekdays((current) =>
                    event.target.checked
                      ? [...current, day].sort((a, b) => a - b)
                      : current.filter((selected) => selected !== day),
                  )
                }
              />
              <Label htmlFor={`${fieldId}-day-${day}`}>{names[day - 1]}</Label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('checklists.items')}</legend>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={item.key} className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-48 flex-1"
                aria-label={t('checklists.itemLabel', { position: index + 1 })}
                value={item.label}
                onChange={(event) => updateItem(item.key, { label: event.target.value })}
              />
              <div className="flex items-center gap-1.5">
                <input
                  id={`${fieldId}-required-${item.key}`}
                  type="checkbox"
                  className="size-4"
                  checked={item.required}
                  onChange={(event) =>
                    updateItem(item.key, { required: event.target.checked })
                  }
                />
                <Label htmlFor={`${fieldId}-required-${item.key}`}>
                  {t('checklists.required')}
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('checklists.moveUp')}
                disabled={index === 0}
                onClick={() => moveItem(index, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('checklists.moveDown')}
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('checklists.remove')}
                onClick={() =>
                  setItems((current) =>
                    current.filter((candidate) => candidate.key !== item.key),
                  )
                }
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          onClick={() => setItems((current) => [...current, newDraftItem()])}
        >
          <Plus className="size-4" />
          {t('checklists.addItem')}
        </Button>
      </fieldset>

      {template && (
        <div className="flex items-center gap-2">
          <input
            id={`${fieldId}-active`}
            type="checkbox"
            className="size-4"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          <Label htmlFor={`${fieldId}-active`}>{t('checklists.active')}</Label>
        </div>
      )}

      <MissingRequirements reasons={missing} />

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('checklists.saveFailed')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!canSave || save.isPending}>
          {t('checklists.save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void navigate('/checklists/templates')}
        >
          {t('checklists.cancel')}
        </Button>
      </div>
    </form>
  )
}
