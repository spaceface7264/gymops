import { useTranslation } from 'react-i18next'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { PageHeader } from '@/components'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProfile } from '@/features/auth'

type AdminSection = {
  to: string
  labelKey: 'admin.users.title' | 'admin.gyms.title' | 'admin.audit.title'
  /** Gym management and the audit log are superadmin-only (spec §2.1). */
  superadminOnly?: boolean
}

/** Every admin sees the user list, so `/admin` always has somewhere to go. */
const defaultSection = '/admin/users'

const sections: AdminSection[] = [
  { to: defaultSection, labelKey: 'admin.users.title' },
  { to: '/admin/gyms', labelKey: 'admin.gyms.title', superadminOnly: true },
  { to: '/admin/audit', labelKey: 'admin.audit.title', superadminOnly: true },
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
  const navigate = useNavigate()
  const visible = visibleSections(Boolean(profile?.is_superadmin))

  if (!profile) return null

  if (location.pathname === '/admin') return <Navigate to={defaultSection} replace />

  const current = visible.find((section) => location.pathname.startsWith(section.to))

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.admin')} />

      {/* Tabs that are links: the URL is the state, arrow keys move between
          them, and each one is a real `<a>` for a new tab or a bookmark. */}
      <Tabs
        value={current?.to ?? defaultSection}
        onValueChange={(to) => void navigate(to)}
      >
        <TabsList aria-label={t('nav.admin')}>
          {visible.map((section) => (
            <TabsTrigger key={section.to} value={section.to} asChild>
              <NavLink to={section.to}>{t(section.labelKey)}</NavLink>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
