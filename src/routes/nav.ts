import {
  BookOpen,
  CalendarDays,
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
    | 'nav.events'
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
  { to: '/events', labelKey: 'nav.events', icon: CalendarDays },
  { to: '/guides', labelKey: 'nav.guides', icon: BookOpen },
  { to: '/checklists', labelKey: 'nav.checklists', icon: ListChecks },
  { to: '/daily-log', labelKey: 'nav.dailyLog', icon: NotebookPen },
  { to: '/incidents', labelKey: 'nav.incidents', icon: TriangleAlert },
  { to: '/chat', labelKey: 'nav.chat', icon: MessagesSquare },
  { to: '/admin', labelKey: 'nav.admin', icon: Settings, adminOnly: true },
]

export function visibleNavEntries(canAdminister: boolean): NavEntry[] {
  return navEntries.filter((entry) => !entry.adminOnly || canAdminister)
}

/**
 * Screens that take the whole frame instead of the shell's centred column,
 * because they scroll their own panes: the chat list and conversation would
 * otherwise move the composer off the bottom of a phone. Kept here rather than
 * in the shell so the routes stay the one place that knows about routes.
 */
export const fullBleedRoutes = ['/chat']

export function isFullBleed(pathname: string): boolean {
  return fullBleedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}
