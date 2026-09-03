import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DeactivatedNotice,
  useAuth,
  useLocaleSync,
  useProfile,
  useSignOut,
} from '@/features/auth'
import { GymSwitcher } from '@/features/gyms'
import { NotificationBell } from '@/features/notifications'
import { cn } from '@/lib/utils'
import { visibleNavEntries, type NavEntry } from '@/routes/nav'

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
  useLocaleSync()

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
    <div className="bg-background text-foreground min-h-dvh md:flex">
      <nav
        aria-label={t('nav.label')}
        className={cn(
          // Bottom bar on phones, sidebar from md up.
          'bg-background fixed inset-x-0 bottom-0 z-10 flex gap-1 overflow-x-auto border-t p-2',
          'md:static md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-1 md:overflow-y-auto md:border-t-0 md:border-r md:p-3',
        )}
      >
        <span className="hidden px-2 pb-3 font-semibold tracking-tight md:block">
          {t('app.name')}
        </span>
        {entries.map((entry) => (
          <NavItem key={entry.to} entry={entry} />
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b p-3">
          <GymSwitcher />
          <div className="flex items-center gap-3">
            <NotificationBell />
            {user?.email && (
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {user.email}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
            >
              {signOut.isPending ? t('auth.signingOut') : t('auth.signOut')}
            </Button>
          </div>
        </header>

        {/* Bottom padding keeps the last content clear of the phone nav bar. */}
        <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({ entry }: { entry: NavEntry }) {
  const { t } = useTranslation()
  const Icon = entry.icon

  return (
    <NavLink
      to={entry.to}
      end={entry.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex shrink-0 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs',
          'md:w-full md:flex-row md:gap-3 md:text-sm',
          isActive
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/60',
        )
      }
    >
      <Icon className="size-5 md:size-4" aria-hidden="true" />
      {t(entry.labelKey)}
    </NavLink>
  )
}
