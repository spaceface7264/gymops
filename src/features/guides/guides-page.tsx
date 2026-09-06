import { BookOpen, FolderPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  LoadError,
} from '@/components'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ContentSearch, excerpt, toDoc, usePublishScope } from '@/features/content'
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
  const [deletingCategory, setDeletingCategory] = useState<GuideCategory | undefined>()

  const categoryList = categories.data ?? []
  const visible = selectedCategory
    ? categoryWithDescendants(categoryList, selectedCategory)
    : null
  const shown = (guides.data ?? []).filter(
    (guide) => !visible || (guide.category_id && visible.has(guide.category_id)),
  )

  const newGuideAction = scope.canPublishSomewhere && (
    <Button asChild>
      <Link to="/guides/new">
        <Plus className="size-4" />
        {t('guides.newGuide')}
      </Link>
    </Button>
  )

  const headerAction = scope.canPublishSomewhere && (
    <>
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
      {newGuideAction}
    </>
  )

  return (
    <div className="space-y-4">
      <PageHeader title={t('guides.title')} action={headerAction} />

      <ContentSearch />

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <nav aria-label={t('guides.categories')} className="space-y-0.5">
          <button
            type="button"
            aria-current={selectedCategory === null}
            onClick={() => setSelectedCategory(null)}
            className={`hover:bg-accent min-h-11 w-full rounded-lg px-2 py-1 text-left text-sm md:min-h-9 ${
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
            onDelete={(node) => setDeletingCategory(node)}
          />
        </nav>

        <ConfirmDialog
          open={deletingCategory !== undefined}
          onOpenChange={(open) => {
            if (!open) setDeletingCategory(undefined)
          }}
          title={t('guides.deleteCategoryConfirm', {
            name: deletingCategory?.name ?? '',
          })}
          body={t('guides.deleteCategoryDescription')}
          confirmLabel={t('guides.delete')}
          pending={removeCategory.isPending}
          error={removeCategory.isError ? t('guides.categoryInUse') : undefined}
          onConfirm={() => {
            if (!deletingCategory) return
            removeCategory.mutate(deletingCategory.id, {
              onSuccess: () => setDeletingCategory(undefined),
            })
          }}
        />

        <div className="space-y-3">
          {guides.isPending && <LoadingState rows={5} />}
          {guides.isError && (
            <LoadError
              message={t('guides.loadFailed')}
              onRetry={() => void guides.refetch()}
            />
          )}
          {guides.data && shown.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title={t('guides.empty')}
              action={newGuideAction}
            />
          )}

          <ul aria-label={t('guides.title')} className="space-y-3">
            {shown.map((guide) => (
              <li key={guide.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone="neutral">
                      {guide.gyms?.name ?? t('guides.companyWide')}
                    </StatusBadge>
                    {guide.guide_categories && (
                      <StatusBadge tone="neutral">
                        {guide.guide_categories.name}
                      </StatusBadge>
                    )}
                    {guide.status === 'draft' && (
                      <StatusBadge tone="warning">{t('guides.draft')}</StatusBadge>
                    )}
                    {guide.requires_ack && (
                      <StatusBadge tone="new">{t('guides.mustConfirm')}</StatusBadge>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold">
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
