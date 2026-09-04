import { ExternalLink, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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

      <h3 className="text-lg font-semibold">{event.title}</h3>
      <p className="text-muted-foreground text-sm">
        {formatEventWhen(event, i18n.language)}
      </p>

      {event.description && (
        <p className="text-sm whitespace-pre-line">{event.description}</p>
      )}

      {event.link && (
        // Outward, user-supplied links: a new tab, and no window handle or
        // referrer handed to whatever is on the other end.
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-accent-foreground inline-flex min-h-11 items-center gap-1 text-sm underline"
            >
              {linkLabel(event.link)}
              <ExternalLink className="size-3" aria-label={t('events.opensInNewTab')} />
            </a>
          </TooltipTrigger>
          <TooltipContent>{event.link}</TooltipContent>
        </Tooltip>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('events.deleteConfirm')}
        confirmLabel={t('events.delete')}
        pending={remove.isPending}
        error={remove.isError ? t('events.deleteFailed') : undefined}
        onConfirm={() =>
          remove.mutate(event.id, { onSuccess: () => setConfirming(false) })
        }
      />
    </Card>
  )
}
