import { useTranslation } from 'react-i18next'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useProfile } from '@/features/auth'
import { cn } from '@/lib/utils'

type AdminSection = {
  to: string
  labelKey: 'admin.gyms.title'
  /** Gym management and the audit log are superadmin-only (spec §2.1). */
  superadminOnly?: boolean
}

const sections: AdminSection[] = [
  { to: '/admin/gyms', labelKey: 'admin.gyms.title', superadminOnly: true },
]

function visibleSections(isSuperadmin: boolean) {
  return sections.filter((section) => !section.superadminOnly || isSuperadmin)
}

/**
 * The admin module (spec §2.2): gyms, users, invites and the audit log, each
 * its own section. Admins and superadmins reach it; RLS decides the rest.
 */
export function AdminPage() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  const location = useLocation()
  const visible = visibleSections(Boolean(profile?.is_superadmin))

  if (!profile) return null

  const first = visible[0]
  if (location.pathname === '/admin') {
    return first ? <Navigate to={first.to} replace /> : <p>{t('admin.empty')}</p>
  }

  return (
    <div className="space-y-6">
      <nav aria-label={t('nav.admin')} className="flex gap-1 border-b">
        {visible.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 py-2 text-sm',
                isActive
                  ? 'border-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )
            }
          >
            {t(section.labelKey)}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}

/** Sections the signed-in user may not open are not routes they may guess. */
export function RequireSuperadmin({ children }: { children: React.ReactNode }) {
  const { data: profile } = useProfile()

  if (!profile) return null
  if (!profile.is_superadmin) return <Navigate to="/" replace />
  return <>{children}</>
}
