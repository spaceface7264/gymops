import type { GuideCategory } from './queries'

export type CategoryNode = GuideCategory & { children: CategoryNode[] }

/**
 * The flat category rows as one tree. A category whose parent the viewer
 * cannot see (RLS filtered it out) is kept at the root rather than dropped —
 * losing a whole branch is worse than showing it one level too high.
 */
export function buildCategoryTree(categories: GuideCategory[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(
    categories.map((category) => [category.id, { ...category, children: [] }]),
  )
  const roots: CategoryNode[] = []

  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (list: CategoryNode[]) => {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    list.forEach((node) => sort(node.children))
    return list
  }

  return sort(roots)
}

/** A category and everything under it — what "show this category" means. */
export function categoryWithDescendants(
  categories: GuideCategory[],
  categoryId: string,
): Set<string> {
  const ids = new Set([categoryId])
  let added = true

  while (added) {
    added = false
    for (const category of categories) {
      if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id)
        added = true
      }
    }
  }

  return ids
}
