import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Database } from '@/lib/database.types'
import {
  useRemoveMembership,
  useSetAdmin,
  useSetMembership,
  type AdminGym,
  type AdminUser,
} from './queries'

type GymRole = Database['public']['Enums']['gym_role']
const noRole = 'none'

/**
 * Who this person is at each gym, and — for a superadmin — whether they are a
 * company-wide admin. Every change is one write, audited by the P2-06 trigger.
 *
 * `assignableGyms` is what the *actor* may hand out: every gym for an admin,
 * the gyms they manage for a manager, who may only make staff.
 */
export function RolesDialog({
  user,
  assignableGyms,
  canMakeManagers,
  canMakeAdmins,
  open,
  onOpenChange,
}: {
  user: AdminUser
  assignableGyms: AdminGym[]
  canMakeManagers: boolean
  canMakeAdmins: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const setMembership = useSetMembership()
  const removeMembership = useRemoveMembership()
  const setAdmin = useSetAdmin()
  const pending =
    setMembership.isPending || removeMembership.isPending || setAdmin.isPending
  const failed = setMembership.isError || removeMembership.isError || setAdmin.isError

  function change(gymId: string, value: string) {
    if (value === noRole) {
      removeMembership.mutate({ userId: user.id, gymId })
    } else {
      setMembership.mutate({ userId: user.id, gymId, role: value as GymRole })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.roles.title')}</DialogTitle>
          <DialogDescription>
            {user.full_name ?? user.email} — {t('admin.roles.description')}
          </DialogDescription>
        </DialogHeader>

        {canMakeAdmins && (
          <div className="flex items-center gap-2">
            <input
              id="roles-admin"
              type="checkbox"
              className="size-4"
              checked={user.is_admin}
              disabled={pending || user.is_superadmin}
              onChange={(event) =>
                setAdmin.mutate({ id: user.id, isAdmin: event.target.checked })
              }
            />
            <Label htmlFor="roles-admin">{t('admin.roles.isAdmin')}</Label>
          </div>
        )}

        {canMakeAdmins && user.is_superadmin && (
          <p className="text-muted-foreground text-sm">
            {t('admin.roles.superadminLocked')}
          </p>
        )}

        <div className="space-y-3">
          {assignableGyms.map((gym) => {
            const current =
              user.gym_memberships.find((membership) => membership.gyms?.id === gym.id)
                ?.role ?? noRole

            return (
              <div key={gym.id} className="flex items-center justify-between gap-3">
                <Label htmlFor={`roles-${gym.id}`}>{gym.name}</Label>
                <Select
                  value={current}
                  disabled={pending}
                  onValueChange={(value) => change(gym.id, value)}
                >
                  <SelectTrigger id={`roles-${gym.id}`} className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value={noRole}>{t('admin.roles.none')}</SelectItem>
                      <SelectItem value="staff">{t('admin.users.staff')}</SelectItem>
                      {canMakeManagers && (
                        <SelectItem value="manager">
                          {t('admin.users.manager')}
                        </SelectItem>
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>

        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t('admin.roles.failed')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
