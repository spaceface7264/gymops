import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CategoryNode } from './tree'

type CategoryTreeProps = {
  nodes: CategoryNode[]
  selectedId: string | null
  onSelect: (categoryId: string | null) => void
  canManage: (gymId: string | null) => boolean
  onRename: (node: CategoryNode) => void
  onDelete: (node: CategoryNode) => void
  depth?: number
}

/** The guide tree: company and gym categories in one list (spec §2.2). */
export function CategoryTree({
  nodes,
  selectedId,
  onSelect,
  canManage,
  onRename,
  onDelete,
  depth = 0,
}: CategoryTreeProps) {
  const { t } = useTranslation()

  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="group flex items-center gap-1">
            <button
              type="button"
              aria-current={selectedId === node.id}
              onClick={() => onSelect(node.id)}
              className={cn(
                'hover:bg-accent min-h-9 flex-1 rounded-lg px-2 py-1 text-left text-sm',
                selectedId === node.id && 'bg-accent font-medium',
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {node.name}
            </button>

            {canManage(node.gym_id) && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('guides.renameCategory', { name: node.name })}
                  onClick={() => onRename(node)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('guides.deleteCategory', { name: node.name })}
                  onClick={() => onDelete(node)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>

          {node.children.length > 0 && (
            <CategoryTree
              nodes={node.children}
              selectedId={selectedId}
              onSelect={onSelect}
              canManage={canManage}
              onRename={onRename}
              onDelete={onDelete}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
