import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProfile } from '@/features/auth'
import { useGymScope } from '@/features/gyms'
import { useAdminGyms, useAdminUsers, useSetUserActive, type AdminUser } from './queries'
import { InviteDialog } from './invite-dialog'
import { RolesDialog } from './roles-dialog'

/**
 * Who this person is, in the order that decides what they may do: the
 * company-wide flag if they have one, then one badge per gym they work at.
 */
function RoleBadges({ user }: { user: AdminUser }) {
  const { t } = useTranslation()

  if (user.is_superadmin || user.is_admin) {
    return (
      <Badge>
        {user.is_superadmin ? t('admin.users.superadmin') : t('admin.users.admin')}
      </Badge>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {user.gym_memberships.map((membership) => (
        <Badge key={`${membership.gyms?.id}-${membership.role}`} variant="outline">
          {membership.gyms?.name}: {t(`admin.users.${membership.role}`)}
        </Badge>
      ))}
    </div>
  )
}

/**
 * User management (P2-02). The gym in the shell's switcher is the filter;
 * "all gyms" lists everyone the viewer may see, including the admins, who hold
 * no membership anywhere.
 */
export function UsersPanel() {
  const { t } = useTranslation()
  const { gymId } = useGymScope()
  const { data: profile } = useProfile()
  const users = useAdminUsers(gymId)
  const gyms = useAdminGyms()
  const setActive = useSetUserActive()
  const [editing, setEditing] = useState<AdminUser | undefined>(undefined)
  const [inviting, setInviting] = useState(false)
  const isAdmin = Boolean(profile?.is_admin || profile?.is_superadmin)

  // An admin may assign any open gym; a manager only the ones they manage, and
  // there only staff. `gym_memberships` enforces both.
  const managedGymIds = useMemo(
    () =>
      profile?.gym_memberships
        .filter((membership) => membership.role === 'manager')
        .map((membership) => membership.gyms?.id) ?? [],
    [profile],
  )
  const assignableGyms = (gyms.data ?? []).filter(
    (gym) => gym.active && (isAdmin || managedGymIds.includes(gym.id)),
  )

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('admin.users.title')}</h2>
        <Button
          size="sm"
          disabled={assignableGyms.length === 0}
          onClick={() => setInviting(true)}
        >
          {t('admin.invite.invite')}
        </Button>
      </div>

      {users.isPending && (
        <p className="text-muted-foreground text-sm">{t('admin.loading')}</p>
      )}
      {users.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('admin.loadFailed')}
        </p>
      )}

      {users.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.users.name')}</TableHead>
              <TableHead>{t('admin.users.roles')}</TableHead>
              <TableHead>{t('admin.users.status')}</TableHead>
              <TableHead className="sr-only">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <span className="font-medium">{user.full_name ?? user.email}</span>
                  <span className="text-muted-foreground block text-xs">
                    {user.email}
                  </span>
                </TableCell>
                <TableCell>
                  <RoleBadges user={user} />
                </TableCell>
                <TableCell>
                  <Badge variant={user.active ? 'default' : 'outline'}>
                    {user.active ? t('admin.users.active') : t('admin.users.inactive')}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right whitespace-nowrap">
                  <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
                    {t('admin.roles.edit')}
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      // Deactivating yourself would end the session you are
                      // working in and leave nobody able to undo it.
                      disabled={setActive.isPending || user.id === profile?.id}
                      onClick={() =>
                        setActive.mutate({ id: user.id, active: !user.active })
                      }
                    >
                      {user.active
                        ? t('admin.users.deactivate')
                        : t('admin.users.reactivate')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <InviteDialog
        gyms={assignableGyms}
        canMakeManagers={isAdmin}
        canMakeAdmins={Boolean(profile?.is_superadmin)}
        open={inviting}
        onOpenChange={setInviting}
      />

      {editing && (
        <RolesDialog
          user={editing}
          assignableGyms={assignableGyms}
          canMakeManagers={isAdmin}
          canMakeAdmins={Boolean(profile?.is_superadmin)}
          open
          onOpenChange={() => setEditing(undefined)}
        />
      )}

      {users.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('admin.users.empty')}</p>
      )}
    </section>
  )
}
