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
import { useCreateGym, useUpdateGym, type AdminGym, type GymInput } from './queries'
import { toSlug } from './slug'

const timezones =
  typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['Europe/Copenhagen']

const emptyGym: GymInput = {
  name: '',
  slug: '',
  city: '',
  timezone: 'Europe/Copenhagen',
}

/**
 * Create or edit one gym. `gym` decides which: absent means create, and the
 * slug then follows the name until it is edited by hand.
 */
export function GymDialog({
  gym,
  open,
  onOpenChange,
}: {
  gym?: AdminGym
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts the content when closed, so the form starts empty
          every time and needs no effect to reset itself. */}
      <DialogContent>
        <GymForm gym={gym} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GymForm({ gym, onDone }: { gym?: AdminGym; onDone: () => void }) {
  const { t } = useTranslation()
  const fieldId = useId()
  const create = useCreateGym()
  const update = useUpdateGym()
  const save = gym ? update : create

  const [values, setValues] = useState<GymInput>(() =>
    gym
      ? { name: gym.name, slug: gym.slug, city: gym.city ?? '', timezone: gym.timezone }
      : emptyGym,
  )
  const [slugEdited, setSlugEdited] = useState(Boolean(gym))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const input: GymInput = { ...values, city: values.city?.trim() || null }

    if (gym) {
      update.mutate({ id: gym.id, ...input }, { onSuccess: onDone })
    } else {
      create.mutate(input, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {gym ? t('admin.gyms.editTitle') : t('admin.gyms.createTitle')}
        </DialogTitle>
        <DialogDescription>{t('admin.gyms.dialogDescription')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-name`}>{t('admin.gyms.name')}</Label>
        <Input
          id={`${fieldId}-name`}
          required
          value={values.name}
          onChange={(event) => {
            const name = event.target.value
            setValues((current) => ({
              ...current,
              name,
              slug: slugEdited ? current.slug : toSlug(name),
            }))
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-slug`}>{t('admin.gyms.slug')}</Label>
        <Input
          id={`${fieldId}-slug`}
          required
          pattern="[a-z0-9-]+"
          value={values.slug}
          onChange={(event) => {
            setSlugEdited(true)
            setValues((current) => ({ ...current, slug: event.target.value }))
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-city`}>{t('admin.gyms.city')}</Label>
        <Input
          id={`${fieldId}-city`}
          value={values.city ?? ''}
          onChange={(event) =>
            setValues((current) => ({ ...current, city: event.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-timezone`}>{t('admin.gyms.timezone')}</Label>
        {/* Checklist runs are generated at 03:00 in this zone (P4-02). */}
        <select
          id={`${fieldId}-timezone`}
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-xl border px-3.5 py-1 text-base outline-none focus-visible:ring-[3px]"
          value={values.timezone}
          onChange={(event) =>
            setValues((current) => ({ ...current, timezone: event.target.value }))
          }
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('admin.gyms.saveFailed')}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('admin.cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t('admin.saving') : t('admin.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
