import { FolderPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { excerpt, toDoc, usePublishScope } from '@/features/content'
import { CategoryDialog } from './category-dialog'
import { CategoryTree } from './category-tree'
import {
  useDeleteCategory,
  useGuideCategories,
  useGuides,
  type GuideCategory,
} from './queries'
import { buildCategoryTree, categoryWithDescendants } from './tree'

/** `/guides`: the category tree beside the guides in the chosen category. */
export function GuidesPage() {
  const { t } = useTranslation()
  const scope = usePublishScope()
  const categories = useGuideCategories()
  const guides = useGuides()
  const removeCategory = useDeleteCategory()

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<GuideCategory | undefined>()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)

  const categoryList = categories.data ?? []
  const visible = selectedCategory
    ? categoryWithDescendants(categoryList, selectedCategory)
    : null
  const shown = (guides.data ?? []).filter(
    (guide) => !visible || (guide.category_id && visible.has(guide.category_id)),
  )

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('guides.title')}</h1>
        {scope.canPublishSomewhere && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingCategory(undefined)
                setCategoryDialogOpen(true)
              }}
            >
              <FolderPlus className="size-4" />
              {t('guides.newCategory')}
            </Button>
            <Button asChild>
              <Link to="/guides/new">
                <Plus className="size-4" />
                {t('guides.newGuide')}
              </Link>
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <nav aria-label={t('guides.categories')} className="space-y-0.5">
          <button
            type="button"
            aria-current={selectedCategory === null}
            onClick={() => setSelectedCategory(null)}
            className={`hover:bg-accent w-full rounded-md px-2 py-1 text-left text-sm ${
              selectedCategory === null ? 'bg-accent font-medium' : ''
            }`}
          >
            {t('guides.allGuides')}
          </button>
          <CategoryTree
            nodes={buildCategoryTree(categoryList)}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
            canManage={scope.canPublishIn}
            onRename={(node) => {
              setEditingCategory(node)
              setCategoryDialogOpen(true)
            }}
            onDelete={(node) => removeCategory.mutate(node.id)}
          />
          {removeCategory.isError && (
            <p role="alert" className="text-destructive text-xs">
              {t('guides.categoryInUse')}
            </p>
          )}
        </nav>

        <div className="space-y-3">
          {guides.isPending && (
            <p className="text-muted-foreground text-sm">{t('guides.loading')}</p>
          )}
          {guides.isError && (
            <p role="alert" className="text-destructive text-sm">
              {t('guides.loadFailed')}
            </p>
          )}
          {guides.data && shown.length === 0 && (
            <p className="text-muted-foreground text-sm">{t('guides.empty')}</p>
          )}

          <ul aria-label={t('guides.title')} className="space-y-3">
            {shown.map((guide) => (
              <li key={guide.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">
                      {guide.gyms?.name ?? t('guides.companyWide')}
                    </Badge>
                    {guide.guide_categories && (
                      <Badge variant="outline">{guide.guide_categories.name}</Badge>
                    )}
                    {guide.status === 'draft' && (
                      <Badge variant="secondary">{t('guides.draft')}</Badge>
                    )}
                    {guide.requires_ack && <Badge>{t('guides.mustConfirm')}</Badge>}
                  </div>
                  <h2 className="text-lg font-medium">
                    <Link to={`/guides/${guide.id}`} className="hover:underline">
                      {guide.title}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {excerpt(toDoc(guide.body))}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <CategoryDialog
        key={editingCategory?.id ?? 'new'}
        category={editingCategory}
        categories={categoryList}
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      />
    </div>
  )
}
