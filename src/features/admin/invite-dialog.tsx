import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGymScope } from '@/features/gyms'
import type { Database } from '@/lib/database.types'
import { useInviteUser, type AdminGym, type InviteInput } from './queries'

type GymRole = Database['public']['Enums']['gym_role']
const adminValue = 'admin'

/**
 * Invite one person (P2-04). The choices offered are the ones the inviter may
 * actually make — an admin any gym and either role, a manager staff in the gyms
 * they manage, the company-wide admin only for a superadmin — and the Edge
 * Function checks the same rules again before anything is created.
 */
export function InviteDialog({
  gyms,
  canMakeManagers,
  canMakeAdmins,
  open,
  onOpenChange,
}: {
  gyms: AdminGym[]
  canMakeManagers: boolean
  canMakeAdmins: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { gymId } = useGymScope()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <InviteForm
          gyms={gyms}
          defaultGymId={gymId}
          canMakeManagers={canMakeManagers}
          canMakeAdmins={canMakeAdmins}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function InviteForm({
  gyms,
  defaultGymId,
  canMakeManagers,
  canMakeAdmins,
  onDone,
}: {
  gyms: AdminGym[]
  /** The gym in the shell's switcher, or null under "all gyms". */
  defaultGymId: string | null
  canMakeManagers: boolean
  canMakeAdmins: boolean
  onDone: () => void
}) {
  const { t } = useTranslation()
  const fieldId = useId()
  const invite = useInviteUser()

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  // Whoever is looking at one gym is almost always inviting into it.
  const [gymId, setGymId] = useState(
    gyms.some((gym) => gym.id === defaultGymId)
      ? (defaultGymId ?? '')
      : (gyms[0]?.id ?? ''),
  )
  const [role, setRole] = useState<GymRole | typeof adminValue>('staff')

  const asAdmin = role === adminValue

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const input: InviteInput = asAdmin
      ? { email, fullName, asAdmin: true }
      : { email, fullName, asAdmin: false, gymId, role }

    invite.mutate(input, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t('admin.invite.title')}</DialogTitle>
        <DialogDescription>{t('admin.invite.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-email`}>{t('admin.invite.email')}</Label>
        <Input
          id={`${fieldId}-email`}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-name`}>{t('admin.invite.fullName')}</Label>
        {/* Offered on the accept screen, where they can correct it. */}
        <Input
          id={`${fieldId}-name`}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-role`}>{t('admin.invite.role')}</Label>
        <select
          id={`${fieldId}-role`}
          className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          value={role}
          onChange={(event) => setRole(event.target.value as GymRole | typeof adminValue)}
        >
          <option value="staff">{t('admin.users.staff')}</option>
          {canMakeManagers && <option value="manager">{t('admin.users.manager')}</option>}
          {canMakeAdmins && <option value={adminValue}>{t('admin.users.admin')}</option>}
        </select>
      </div>

      {!asAdmin && (
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-gym`}>{t('admin.invite.gym')}</Label>
          <select
            id={`${fieldId}-gym`}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            required
            value={gymId}
            onChange={(event) => setGymId(event.target.value)}
          >
            {gyms.map((gym) => (
              <option key={gym.id} value={gym.id}>
                {gym.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {invite.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t(`admin.invite.${invite.error.problem}`)}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('admin.cancel')}
        </Button>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? t('admin.invite.sending') : t('admin.invite.send')}
        </Button>
      </DialogFooter>
    </form>
  )
}
