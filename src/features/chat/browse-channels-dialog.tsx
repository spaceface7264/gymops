import { Hash, Lock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState, LoadingState } from '@/components'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useJoinChannel, useJoinableChannels } from './queries'

/**
 * The custom channels this person can see and has not joined. Reading one is
 * not being in it — posting takes membership (P6-01) — so the list joins and
 * then opens, rather than showing a conversation with no way to answer.
 */
export function BrowseChannelsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const channels = useJoinableChannels()
  const join = useJoinChannel()

  const rows = channels.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chat.browse')}</DialogTitle>
          <DialogDescription>{t('chat.browseHint')}</DialogDescription>
        </DialogHeader>

        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {rows.map((channel) => (
            <li
              key={channel.id}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm"
            >
              {channel.kind === 'gym' ? (
                <Users className="size-4 shrink-0" aria-hidden="true" />
              ) : channel.is_private ? (
                <Lock className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Hash className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{channel.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {channel.description ||
                    t('chat.membersCount', { count: channel.members })}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={join.isPending}
                onClick={() =>
                  join.mutate(channel.id, {
                    onSuccess: () => {
                      onOpenChange(false)
                      void navigate(`/chat/${channel.id}`)
                    },
                  })
                }
              >
                {t('chat.join')}
              </Button>
            </li>
          ))}
        </ul>

        {channels.isPending && <LoadingState rows={3} />}
        {!channels.isPending && rows.length === 0 && (
          <EmptyState title={t('chat.nothingToJoin')} as="p" />
        )}

        {join.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('chat.joinFailed')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('chat.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
