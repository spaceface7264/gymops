import { useQueryClient } from '@tanstack/react-query'
import { Ellipsis, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Logo, PullIndicator, UnreadCount } from '@/components'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DeactivatedNotice,
  useAuth,
  useLocaleSync,
  useProfile,
  useSignOut,
} from '@/features/auth'
import { useChatUnread } from '@/features/chat'
import { GymSwitcher } from '@/features/gyms'
import { NotificationBell } from '@/features/notifications'
import { usePhone } from '@/hooks/use-media-query'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { useRefetchOnResume } from '@/hooks/use-refetch-on-resume'
import { cn } from '@/lib/utils'
import { isConversation, isFullBleed, phoneNav, type NavEntry } from '@/routes/nav'
import { UpdateBanner } from '@/routes/update-banner'

/** The letters shown on the account avatar: initials from a name, or the
 * first letter of the email when there is no name to draw from. */
export function initials(
  name: string | null | undefined,
  email: string | undefined,
): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  const last = parts[parts.length - 1] ?? ''
  if (parts.length >= 2) return (first.charAt(0) + last.charAt(0)).toUpperCase()
  if (parts.length === 1) return first.charAt(0).toUpperCase()
  return (email?.charAt(0) ?? '?').toUpperCase()
}

/**
 * Frame for every signed-in screen: a sidebar on desktop, a bottom bar on
 * phones — staff use this one-handed mid-shift — and a header carrying the gym
 * switcher, who is signed in and the way out.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const signOut = useSignOut()
  const chatUnread = useChatUnread()
  useLocaleSync()

  // A screen may ask for the whole frame instead of the centred column: chat
  // scrolls its own panes, and a page that scrolls as well would move the
  // composer off the bottom of a phone.
  const { pathname } = useLocation()
  const fullBleed = isFullBleed(pathname)
  // A conversation carries its own header on a phone (with the bell); two
  // stacked headers cost a fifth of the screen. Decided in JS, not CSS: the
  // bell holds a Realtime subscription and may exist only once.
  const phone = usePhone()
  const headerless = phone && isConversation(pathname)
  // A standalone PWA has no reload button: coming back to it refetches what
  // has gone stale, and pulling the page down from the top refetches every
  // query on screen (the Refresh row in More does the same without the
  // gesture). Chat scrolls inside itself and is live.
  useRefetchOnResume()
  const queryClient = useQueryClient()
  const { refresh, ...pullToRefresh } = usePullToRefresh({
    enabled: phone && !fullBleed,
    onRefresh: () => queryClient.refetchQueries({ type: 'active' }),
  })

  // Managers administer their own gyms' staff, so the admin section is theirs
  // as well; only staff never see it.
  const canAdminister = Boolean(
    profile?.is_admin ||
    profile?.is_superadmin ||
    profile?.gym_memberships.some((membership) => membership.role === 'manager'),
  )
  const { bar, more } = phoneNav(canAdminister)

  // Deactivation happens mid-shift on a shared machine: RLS empties every
  // screen at once, so say so rather than showing an app with nothing in it.
  if (profile?.active === false) return <DeactivatedNotice />

  return (
    <div
      className={cn(
        'bg-background text-foreground min-h-dvh md:flex',
        // Locked at every width, not only from `md`: on a phone the chat's
        // list scrolls inside itself and the composer stays put above the bar.
        fullBleed && 'h-dvh overflow-hidden',
      )}
    >
      <a
        href="#main"
        className="bg-card text-foreground focus-visible:ring-ring/40 sr-only rounded-full px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus-visible:ring-[3px]"
      >
        {t('app.skipToContent')}
      </a>
      <nav
        aria-label={t('nav.label')}
        className={cn(
          // Five equal tabs on a phone, nothing to scroll: the rest are behind More.
          'bg-card fixed inset-x-0 bottom-0 z-10 flex gap-1 border-t px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]',
          'md:static md:h-dvh md:w-60 md:shrink-0 md:flex-col md:gap-1 md:overflow-y-auto md:border-t-0 md:border-r md:p-3',
        )}
      >
        <Logo wordmark className="hidden px-3 pt-1 pb-4 text-base md:inline-flex" />
        {bar.map((entry) => (
          <NavItem
            key={entry.to}
            entry={entry}
            unread={entry.to === '/chat' ? chatUnread : 0}
          />
        ))}
        <MoreTab
          entries={more}
          pathname={pathname}
          onRefresh={phone && !fullBleed ? refresh : undefined}
        />
        {more.map((entry) => (
          <NavItem key={entry.to} entry={entry} unread={0} className="hidden md:flex" />
        ))}
      </nav>

      <div className={cn('flex min-w-0 flex-1 flex-col', fullBleed && 'h-full min-h-0')}>
        <UpdateBanner />
        {!headerless && (
          <header className="bg-card flex items-center justify-between gap-3 border-b px-3 py-2 md:px-5">
            <GymSwitcher />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('auth.account.menu')}
                    className="focus-visible:ring-ring/40 flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-[3px]"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback>
                        {initials(profile?.full_name, user?.email)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="truncate font-normal">
                    <span className="block font-semibold">
                      {profile?.full_name ?? user?.email}
                    </span>
                    {profile?.full_name && (
                      <span className="text-muted-foreground block text-xs">
                        {user?.email}
                      </span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account">{t('auth.account.title')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/notifications/preferences">
                      {t('auth.account.preferences')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => signOut.mutate()}
                    disabled={signOut.isPending}
                  >
                    {signOut.isPending ? t('auth.signingOut') : t('auth.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
        )}

        {phone && !fullBleed && <PullIndicator {...pullToRefresh} />}

        {/* Bottom padding keeps the last content clear of the phone nav bar;
            a full-bleed screen takes care of its own. */}
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            'flex-1 outline-none',
            fullBleed
              ? 'flex min-h-0 flex-col'
              : 'mx-auto w-full max-w-3xl p-4 pb-[calc(var(--nav-bar-clearance)+2rem)] md:p-6 md:pb-8',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** One tab of the phone bar, one pill of the sidebar. */
const navItemClass = (active: boolean) =>
  cn(
    // 44px tall and an equal share of the phone bar; a pill in the sidebar.
    'relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors duration-150',
    'md:min-h-0 md:w-full md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-full md:px-3.5 md:py-2.5 md:text-sm',
    active
      ? 'bg-accent text-accent-foreground font-semibold'
      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
  )

function NavItem({
  entry,
  unread,
  className,
}: {
  entry: NavEntry
  unread: number
  className?: string
}) {
  const { t } = useTranslation()
  const Icon = entry.icon

  return (
    <NavLink
      to={entry.to}
      end={entry.to === '/'}
      className={({ isActive }) => cn(navItemClass(isActive), className)}
    >
      <Icon className="size-5" aria-hidden="true" />
      {t(entry.labelKey)}
      <UnreadCount
        count={unread}
        className="absolute top-1 right-2 md:static md:ml-auto"
        aria-label={t('chat.navUnread', { count: unread })}
      />
    </NavLink>
  )
}

/**
 * The phone bar's fifth tab (P7M-02): a sheet from the bottom with the
 * sections that did not fit. It reads as the current tab while the reader is
 * in one of them, so "where am I" never points at nothing. Hidden from `md`
 * up, where the sidebar lists everything.
 */
function MoreTab({
  entries,
  pathname,
  onRefresh,
}: {
  entries: NavEntry[]
  pathname: string
  /** Set on a page that can be pulled to refresh: the same reload as a row. */
  onRefresh?: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const active = entries.some(
    (entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`),
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-current={active ? 'true' : undefined}
          className={cn(navItemClass(active), 'md:hidden')}
        >
          <Ellipsis className="size-5" aria-hidden="true" />
          {t('nav.more')}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-1 p-2 pt-4">
        <SheetTitle className="px-3 pb-2">{t('nav.more')}</SheetTitle>
        {entries.map((entry) => {
          const Icon = entry.icon
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'hover:bg-accent/60',
                )
              }
            >
              <Icon className="text-muted-foreground size-5" aria-hidden="true" />
              {t(entry.labelKey)}
            </NavLink>
          )
        })}
        {onRefresh && (
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onRefresh()
            }}
            className="hover:bg-accent/60 flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium transition-colors duration-150"
          >
            <RefreshCw className="text-muted-foreground size-5" aria-hidden="true" />
            {t('nav.refresh')}
          </button>
        )}
      </SheetContent>
    </Sheet>
  )
}
