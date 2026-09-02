import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MissingRequirements, usePublishScope } from '@/features/content'
import { useCreateCategory, useRenameCategory, type GuideCategory } from './queries'

/**
 * Create a category, or rename one. Scope and parent are chosen only when
 * creating: moving a category between gyms would move the guides under it out
 * of the audience that has been reading them.
 */
export function CategoryDialog({
  category,
  categories,
  open,
  onOpenChange,
}: {
  category?: GuideCategory
  categories: GuideCategory[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CategoryForm
          category={category}
          categories={categories}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({
  category,
  categories,
  onDone,
}: {
  category?: GuideCategory
  categories: GuideCategory[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const scope = usePublishScope()
  const create = useCreateCategory()
  const rename = useRenameCategory()
  const save = category ? rename : create

  const [name, setName] = useState(category?.name ?? '')
  const [chosenGymId, setChosenGymId] = useState<string | null | undefined>(undefined)
  const [parentId, setParentId] = useState<string | null>(null)

  const gymId =
    chosenGymId === undefined
      ? scope.canPublishCompanyWide
        ? null
        : (scope.publishableGyms[0]?.id ?? null)
      : chosenGymId

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (category) rename.mutate({ id: category.id, name }, { onSuccess: onDone })
    else create.mutate({ gymId, parentId, name }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {category ? t('guides.renameCategoryTitle') : t('guides.newCategoryTitle')}
        </DialogTitle>
        <DialogDescription>{t('guides.categoryDescription')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-name`}>{t('guides.categoryName')}</Label>
        <Input
          id={`${fieldId}-name`}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      {!category && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-scope`}>{t('guides.scope')}</Label>
            <select
              id={`${fieldId}-scope`}
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={gymId ?? 'company'}
              onChange={(event) =>
                setChosenGymId(
                  event.target.value === 'company' ? null : event.target.value,
                )
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
            <Label htmlFor={`${fieldId}-parent`}>{t('guides.parentCategory')}</Label>
            <select
              id={`${fieldId}-parent`}
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={parentId ?? ''}
              onChange={(event) => setParentId(event.target.value || null)}
            >
              <option value="">{t('guides.noParent')}</option>
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <MissingRequirements
        reasons={name.trim() === '' ? [t('guides.categoryNeedsName')] : []}
      />

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('guides.categorySaveFailed')}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('guides.cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending || name.trim() === ''}>
          {t('guides.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
