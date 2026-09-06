import {
  BookOpen,
  CalendarDays,
  House,
  ListChecks,
  MessagesSquare,
  Newspaper,
  NotebookPen,
  Settings,
  Sparkles,
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
    | 'nav.ask'
    | 'nav.admin'
    | 'nav.more'
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
 * The V1 modules (PROJECT_SPEC.md §2.2). The phone bar has room for four of
 * them beside a More tab, so the first four are the ones a shift lives in:
 * home, the people on shift, the checklist, the log. The rest follow in the
 * order staff reach for them, and open from More on a phone (P7M-02).
 */
export const navEntries: NavEntry[] = [
  { to: '/', labelKey: 'nav.home', icon: House },
  { to: '/chat', labelKey: 'nav.chat', icon: MessagesSquare },
  { to: '/checklists', labelKey: 'nav.checklists', icon: ListChecks },
  { to: '/daily-log', labelKey: 'nav.dailyLog', icon: NotebookPen },
  { to: '/incidents', labelKey: 'nav.incidents', icon: TriangleAlert },
  { to: '/news', labelKey: 'nav.news', icon: Newspaper },
  { to: '/events', labelKey: 'nav.events', icon: CalendarDays },
  { to: '/guides', labelKey: 'nav.guides', icon: BookOpen },
  { to: '/ask', labelKey: 'nav.ask', icon: Sparkles },
  { to: '/admin', labelKey: 'nav.admin', icon: Settings, adminOnly: true },
]

export function visibleNavEntries(canAdminister: boolean): NavEntry[] {
  return navEntries.filter((entry) => !entry.adminOnly || canAdminister)
}

/** How many entries the phone bar shows beside More: five tabs of 390 px, with
 *  room for "Tjeklister". */
export const phoneBarCount = 4

/** The phone bar's own tabs and what goes behind More. */
export function phoneNav(canAdminister: boolean): { bar: NavEntry[]; more: NavEntry[] } {
  const entries = visibleNavEntries(canAdminister)
  return { bar: entries.slice(0, phoneBarCount), more: entries.slice(phoneBarCount) }
}

/**
 * Screens that take the whole frame instead of the shell's centred column,
 * because they scroll their own panes: the chat list and conversation, and
 * the assistant's thread, would otherwise move the composer off the bottom of
 * a phone. Kept here rather than in the shell so the routes stay the one
 * place that knows about routes.
 */
export const fullBleedRoutes = ['/chat', '/ask']

/**
 * A conversation on a phone is one screen with its own header (back, the
 * channel, its menu); the shell's header would be a second one above it.
 */
export function isConversation(pathname: string): boolean {
  return /^\/chat\/[^/]+/.test(pathname)
}

export function isFullBleed(pathname: string): boolean {
  return fullBleedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}
