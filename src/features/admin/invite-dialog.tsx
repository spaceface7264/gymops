import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

    invite.mutate(input, {
      onSuccess: () => {
        toast.success(t('admin.invite.sent', { email }))
        onDone()
      },
    })
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
        <Select
          value={role}
          onValueChange={(value) => setRole(value as GymRole | typeof adminValue)}
        >
          <SelectTrigger id={`${fieldId}-role`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              <SelectItem value="staff">{t('admin.users.staff')}</SelectItem>
              {canMakeManagers && (
                <SelectItem value="manager">{t('admin.users.manager')}</SelectItem>
              )}
              {canMakeAdmins && (
                <SelectItem value={adminValue}>{t('admin.users.admin')}</SelectItem>
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {!asAdmin && (
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-gym`}>{t('admin.invite.gym')}</Label>
          <Select
            value={gymId}
            required
            onValueChange={(value) => {
              // Radix keeps a hidden native select for form submission, and it
              // fires an empty value whenever the current one matches no option
              // — here, the render before the profile that decides the scope
              // arrives. Taking it would scope the post to nobody.
              if (value === '') return
              setGymId(value)
            }}
          >
            <SelectTrigger id={`${fieldId}-gym`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {gyms.map((gym) => (
                  <SelectItem key={gym.id} value={gym.id}>
                    {gym.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
