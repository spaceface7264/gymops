import { ExternalLink, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EventBadges } from './event-badges'
import { formatEventWhen, linkLabel } from './event-date'
import { useDeleteEvent, type GymEvent } from './queries'

/** One event in the list: what it is, when it is, and where to read more. */
export function EventCard({
  event,
  canManage,
  onEdit,
}: {
  event: GymEvent
  canManage: boolean
  onEdit: (event: GymEvent) => void
}) {
  const { t, i18n } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const remove = useDeleteEvent()

  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <EventBadges event={event} />
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={t('events.actions')}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(event)}>
                {t('events.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirming(true)}
              >
                {t('events.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <h3 className="font-medium">{event.title}</h3>
      <p className="text-muted-foreground text-sm">
        {formatEventWhen(event, i18n.language)}
      </p>

      {event.description && (
        <p className="text-sm whitespace-pre-line">{event.description}</p>
      )}

      {event.link && (
        // Outward, user-supplied links: a new tab, and no window handle or
        // referrer handed to whatever is on the other end.
        <a
          href={event.link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={event.link}
          className="text-primary inline-flex items-center gap-1 text-sm underline"
        >
          {linkLabel(event.link)}
          <ExternalLink className="size-3" aria-label={t('events.opensInNewTab')} />
        </a>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('events.deleteConfirm')}</DialogTitle>
          </DialogHeader>
          {remove.isError && (
            <p role="alert" className="text-destructive text-sm">
              {t('events.deleteFailed')}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t('events.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(event.id, { onSuccess: () => setConfirming(false) })
              }
            >
              {t('events.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
