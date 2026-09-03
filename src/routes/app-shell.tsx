import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Logo } from '@/components'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { cn } from '@/lib/utils'
import { isFullBleed, visibleNavEntries, type NavEntry } from '@/routes/nav'
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
  const fullBleed = isFullBleed(useLocation().pathname)

  // Managers administer their own gyms' staff, so the admin section is theirs
  // as well; only staff never see it.
  const canAdminister = Boolean(
    profile?.is_admin ||
    profile?.is_superadmin ||
    profile?.gym_memberships.some((membership) => membership.role === 'manager'),
  )
  const entries = visibleNavEntries(canAdminister)

  // Deactivation happens mid-shift on a shared machine: RLS empties every
  // screen at once, so say so rather than showing an app with nothing in it.
  if (profile?.active === false) return <DeactivatedNotice />

  return (
    <div
      className={cn(
        'bg-background text-foreground min-h-dvh md:flex',
        fullBleed && 'md:h-dvh md:overflow-hidden',
      )}
    >
      <nav
        aria-label={t('nav.label')}
        className={cn(
          'bg-card fixed inset-x-0 bottom-0 z-10 flex gap-1 overflow-x-auto border-t px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]',
          'md:static md:h-dvh md:w-60 md:shrink-0 md:flex-col md:gap-1 md:overflow-y-auto md:border-t-0 md:border-r md:p-3',
        )}
      >
        <Logo wordmark className="hidden px-3 pt-1 pb-4 text-base md:inline-flex" />
        {entries.map((entry) => (
          <NavItem
            key={entry.to}
            entry={entry}
            unread={entry.to === '/chat' ? chatUnread : 0}
          />
        ))}
      </nav>

      <div className={cn('flex min-w-0 flex-1 flex-col', fullBleed && 'md:min-h-0')}>
        <UpdateBanner />
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

        {/* Bottom padding keeps the last content clear of the phone nav bar;
            a full-bleed screen takes care of its own. */}
        <main
          className={cn(
            'flex-1',
            fullBleed
              ? 'flex min-h-0 flex-col'
              : 'mx-auto w-full max-w-3xl p-4 pb-28 md:p-6 md:pb-8',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({ entry, unread }: { entry: NavEntry; unread: number }) {
  const { t } = useTranslation()
  const Icon = entry.icon

  return (
    <NavLink
      to={entry.to}
      end={entry.to === '/'}
      className={({ isActive }) =>
        cn(
          // 44px tall on the phone bar; a pill in the sidebar.
          'relative flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors duration-150',
          'md:min-h-0 md:w-full md:flex-row md:justify-start md:gap-3 md:rounded-full md:px-3.5 md:py-2.5 md:text-sm',
          isActive
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      {t(entry.labelKey)}
      {unread > 0 && (
        <span
          className="bg-primary text-primary-foreground absolute top-1 right-2 min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold md:static md:ml-auto"
          aria-label={t('chat.navUnread', { count: unread })}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </NavLink>
  )
}
