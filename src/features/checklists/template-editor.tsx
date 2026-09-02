import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePublishScope } from '@/features/content'
import { useGymScope } from '@/features/gyms'
import {
  useChecklistTemplate,
  useSaveChecklistTemplate,
  type ChecklistKind,
  type ChecklistTemplate,
} from './queries'
import { isoWeekdays, weekdayNames } from './weekdays'

const kinds: ChecklistKind[] = ['opening', 'closing', 'custom']

type MissingKey =
  | 'checklists.needsName'
  | 'checklists.needsDay'
  | 'checklists.needsItem'
  | 'checklists.needsPermission'

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
  const missing: MissingKey[] = []
  if (name.trim() === '') missing.push('checklists.needsName')
  if (weekdays.length === 0) missing.push('checklists.needsDay')
  if (filledItems.length === 0) missing.push('checklists.needsItem')
  if (!scope.canPublishIn(gymId)) missing.push('checklists.needsPermission')
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
        <select
          id={`${fieldId}-scope`}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={gymId ?? 'company'}
          onChange={(event) =>
            setChosenGymId(event.target.value === 'company' ? null : event.target.value)
          }
        >
          {scope.canPublishCompanyWide && (
            <option value="company">{t('checklists.companyWide')}</option>
          )}
          {scope.publishableGyms.map((gym) => (
            <option key={gym.id} value={gym.id}>
              {gym.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-kind`}>{t('checklists.kindLabel')}</Label>
        <select
          id={`${fieldId}-kind`}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value as ChecklistKind)}
        >
          {kinds.map((option) => (
            <option key={option} value={option}>
              {t(`checklists.kind.${option}`)}
            </option>
          ))}
        </select>
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

      {missing.length > 0 && (
        <ul className="text-muted-foreground space-y-0.5 text-sm">
          {missing.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      )}

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
