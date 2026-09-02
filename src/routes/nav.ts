import {
  BookOpen,
  House,
  ListChecks,
  MessagesSquare,
  Newspaper,
  NotebookPen,
  Settings,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

export type NavEntry = {
  to: string
  /** Key under `nav.` in the common namespace. */
  labelKey:
    | 'nav.home'
    | 'nav.news'
    | 'nav.guides'
    | 'nav.checklists'
    | 'nav.dailyLog'
    | 'nav.incidents'
    | 'nav.chat'
    | 'nav.admin'
  icon: LucideIcon
  /**
   * Hidden from staff. Managers see it too: they administer their own gyms'
   * staff (spec §2.1). The database enforces the same rule either way.
   */
  adminOnly?: boolean
  /** Phase that replaces the placeholder with the real module. */
  phase?: string
}

/**
 * The V1 modules (PROJECT_SPEC.md §2.2) in the order staff move through a
 * shift. Sections whose phase has not landed render a placeholder, so the
 * shell is navigable now and each phase swaps in its own page.
 */
export const navEntries: NavEntry[] = [
  { to: '/', labelKey: 'nav.home', icon: House },
  { to: '/news', labelKey: 'nav.news', icon: Newspaper },
  { to: '/guides', labelKey: 'nav.guides', icon: BookOpen },
  { to: '/checklists', labelKey: 'nav.checklists', icon: ListChecks },
  { to: '/daily-log', labelKey: 'nav.dailyLog', icon: NotebookPen },
  { to: '/incidents', labelKey: 'nav.incidents', icon: TriangleAlert },
  { to: '/chat', labelKey: 'nav.chat', icon: MessagesSquare, phase: '6' },
  { to: '/admin', labelKey: 'nav.admin', icon: Settings, adminOnly: true },
]

export function visibleNavEntries(canAdminister: boolean): NavEntry[] {
  return navEntries.filter((entry) => !entry.adminOnly || canAdminister)
}
