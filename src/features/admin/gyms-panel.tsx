import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LoadingState, StatusBadge, LoadError } from '@/components'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GymDialog } from './gym-dialog'
import { useAdminGyms, useSetGymActive, type AdminGym } from './queries'

/**
 * Gym management (P2-01). Superadmin-only, both here and in `gyms_insert` /
 * `gyms_update`; the route already refuses everyone else.
 */
export function GymsPanel() {
  const { t } = useTranslation()
  const gyms = useAdminGyms()
  const setActive = useSetGymActive()
  const [editing, setEditing] = useState<AdminGym | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(gym: AdminGym) {
    setEditing(gym)
    setDialogOpen(true)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('admin.gyms.title')}</h2>
        <Button size="sm" onClick={openCreate}>
          {t('admin.gyms.create')}
        </Button>
      </div>

      {gyms.isPending && <LoadingState rows={6} />}
      {gyms.isError && (
        <LoadError message={t('admin.loadFailed')} onRetry={() => void gyms.refetch()} />
      )}

      {gyms.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.gyms.name')}</TableHead>
              <TableHead>{t('admin.gyms.city')}</TableHead>
              <TableHead>{t('admin.gyms.timezone')}</TableHead>
              <TableHead>{t('admin.gyms.status')}</TableHead>
              <TableHead className="sr-only">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gyms.data.map((gym) => (
              <TableRow key={gym.id}>
                <TableCell>
                  <span className="font-medium">{gym.name}</span>
                  <span className="text-muted-foreground block text-xs">{gym.slug}</span>
                </TableCell>
                <TableCell>{gym.city ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {gym.timezone}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={gym.active ? 'success' : 'neutral'}>
                    {gym.active ? t('admin.gyms.active') : t('admin.gyms.inactive')}
                  </StatusBadge>
                </TableCell>
                <TableCell className="space-x-2 text-right whitespace-nowrap">
                  <Button variant="outline" size="sm" onClick={() => openEdit(gym)}>
                    {t('admin.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setActive.isPending}
                    onClick={() =>
                      setActive.mutate(
                        { id: gym.id, active: !gym.active },
                        { onError: () => toast.error(t('admin.saveFailed')) },
                      )
                    }
                  >
                    {gym.active ? t('admin.gyms.deactivate') : t('admin.gyms.reactivate')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <GymDialog gym={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </section>
  )
}
