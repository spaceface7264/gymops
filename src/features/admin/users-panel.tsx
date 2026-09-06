import { Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState, LoadingState, StatusBadge, LoadError } from '@/components'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProfile } from '@/features/auth'
import { MissingRequirements } from '@/features/content'
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
      <StatusBadge tone="neutral">
        {user.is_superadmin ? t('admin.users.superadmin') : t('admin.users.admin')}
      </StatusBadge>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {user.gym_memberships.map((membership) => (
        <StatusBadge key={`${membership.gyms?.id}-${membership.role}`} tone="neutral">
          {membership.gyms?.name}: {t(`admin.users.${membership.role}`)}
        </StatusBadge>
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
  // The id, not the row: the dialog writes as soon as a control changes, and
  // it has to show the row as it comes back from the refetch, not the snapshot
  // it was opened with.
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const editing = users.data?.find((user) => user.id === editingId)
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

      <MissingRequirements
        reasons={assignableGyms.length === 0 ? [t('admin.users.noAssignableGyms')] : []}
      />

      {users.isPending && <LoadingState rows={6} />}
      {users.isError && (
        <LoadError message={t('admin.loadFailed')} onRetry={() => void users.refetch()} />
      )}

      {users.data && (
        // One table, two shapes: rows below `md`, where four columns do not
        // fit 390 px and a clipped column has no scroll affordance.
        <Table>
          <TableHeader className="hidden md:table-header-group">
            <TableRow>
              <TableHead>{t('admin.users.name')}</TableHead>
              <TableHead>{t('admin.users.roles')}</TableHead>
              <TableHead>{t('admin.users.status')}</TableHead>
              <TableHead className="sr-only">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((user) => (
              <TableRow key={user.id} className="block py-3 md:table-row md:py-0">
                <TableCell className="block px-0 py-1 md:table-cell md:px-2 md:py-3">
                  <span className="font-medium">{user.full_name ?? user.email}</span>
                  <span className="text-muted-foreground block text-xs">
                    {user.email}
                  </span>
                </TableCell>
                <TableCell className="block px-0 py-1 md:table-cell md:px-2 md:py-3">
                  <RoleBadges user={user} />
                </TableCell>
                <TableCell className="block px-0 py-1 md:table-cell md:px-2 md:py-3">
                  <StatusBadge tone={user.active ? 'success' : 'neutral'}>
                    {user.active ? t('admin.users.active') : t('admin.users.inactive')}
                  </StatusBadge>
                </TableCell>
                <TableCell className="block space-x-2 px-0 py-1 whitespace-nowrap md:table-cell md:px-2 md:py-3 md:text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(user.id)}
                  >
                    {t('admin.roles.edit')}
                  </Button>
                  {isAdmin && user.id === profile?.id && (
                    <Tooltip>
                      {/* A disabled button fires no pointer events, so the
                          wrapper is what the tooltip listens to. */}
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="inline-flex">
                          <Button
                            variant="outline"
                            size="sm"
                            // Deactivating yourself would end the session you are
                            // working in and leave nobody able to undo it.
                            disabled={setActive.isPending || user.id === profile?.id}
                            onClick={() =>
                              setActive.mutate(
                                { id: user.id, active: !user.active },
                                {
                                  onSuccess: () =>
                                    toast.success(
                                      t(
                                        user.active
                                          ? 'admin.users.deactivated'
                                          : 'admin.users.reactivated',
                                        { name: user.full_name ?? user.email },
                                      ),
                                    ),
                                  onError: () => toast.error(t('admin.saveFailed')),
                                },
                              )
                            }
                          >
                            {user.active
                              ? t('admin.users.deactivate')
                              : t('admin.users.reactivate')}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('admin.users.cannotDeactivateSelf')}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {isAdmin && user.id !== profile?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      // Deactivating yourself would end the session you are
                      // working in and leave nobody able to undo it.
                      disabled={setActive.isPending || user.id === profile?.id}
                      onClick={() =>
                        setActive.mutate(
                          { id: user.id, active: !user.active },
                          {
                            onSuccess: () =>
                              toast.success(
                                t(
                                  user.active
                                    ? 'admin.users.deactivated'
                                    : 'admin.users.reactivated',
                                  { name: user.full_name ?? user.email },
                                ),
                              ),
                            onError: () => toast.error(t('admin.saveFailed')),
                          },
                        )
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
          onOpenChange={() => setEditingId(undefined)}
        />
      )}

      {users.data?.length === 0 && (
        <EmptyState icon={Users} title={t('admin.users.empty')} />
      )}
    </section>
  )
}
