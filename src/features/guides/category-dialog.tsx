import { useId, useState } from 'react'
import { useFormTouched } from '@/hooks/use-form-touched'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MissingRequirements, usePublishScope } from '@/features/content'
import { useCreateCategory, useRenameCategory, type GuideCategory } from './queries'

// Radix treats an empty value as "no value chosen" and shows the placeholder
// instead of the item, so "no category" needs a value of its own.
const noParent = 'none'

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
    const saved = () => {
      toast.success(t('guides.categorySaved'))
      onDone()
    }
    if (category) rename.mutate({ id: category.id, name }, { onSuccess: saved })
    else create.mutate({ gymId, parentId, name }, { onSuccess: saved })
  }

  const { touched, formProps } = useFormTouched()
  return (
    <form {...formProps} onSubmit={submit} className="space-y-4">
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
            <Label htmlFor={`${fieldId}-parent`}>{t('guides.parentCategory')}</Label>
            <Select
              value={parentId ?? noParent}
              onValueChange={(value) => {
                // Radix keeps a hidden native select for form submission, and it
                // fires an empty value whenever the current one matches no option
                // — here, the render before the profile that decides the scope
                // arrives. Taking it would scope the post to nobody.
                if (value === '') return
                setParentId(value === noParent ? null : value)
              }}
            >
              <SelectTrigger id={`${fieldId}-parent`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value={noParent}>{t('guides.noParent')}</SelectItem>
                  {categories.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <MissingRequirements
        reasons={touched && name.trim() === '' ? [t('guides.categoryNeedsName')] : []}
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
