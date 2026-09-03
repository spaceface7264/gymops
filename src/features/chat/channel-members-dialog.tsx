import { X } from 'lucide-react'
import { useState } from 'react'
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
import { PeoplePicker } from './people-picker'
import {
  useAddChannelMembers,
  useChannelMembers,
  useColleagues,
  useRemoveChannelMember,
  type Channel,
} from './queries'

/**
 * Who is in a custom channel, and — for whoever manages it — who else could
 * be. A private channel is joined by invitation only (P6-01), so this dialog
 * is the only way into one.
 */
export function ChannelMembersDialog({
  channel,
  canModerate,
  open,
  onOpenChange,
}: {
  channel: Channel
  canModerate: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const members = useChannelMembers([channel.id])
  const colleagues = useColleagues()
  const add = useAddChannelMembers()
  const remove = useRemoveChannelMember()

  const [chosen, setChosen] = useState<string[]>([])

  const seated = members.data ?? []
  const seatedIds = new Set(seated.map((member) => member.user_id))
  const addable = (colleagues.data ?? []).filter((person) => !seatedIds.has(person.id))

  const toggle = (id: string) =>
    setChosen((already) =>
      already.includes(id) ? already.filter((one) => one !== id) : [...already, id],
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('chat.members')}</DialogTitle>
          <DialogDescription>
            {t('chat.membersCount', { count: seated.length })}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {seated.map((member) => (
            <li
              key={member.user_id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {member.full_name?.trim() || member.email || t('chat.someone')}
              </span>
              {canModerate && (
                <button
                  type="button"
                  aria-label={t('chat.removeMember', {
                    name: member.full_name?.trim() || member.email,
                  })}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate({ channelId: channel.id, userId: member.user_id })
                  }
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {canModerate && (
          <>
            <p className="text-sm font-medium">{t('chat.addMembers')}</p>
            <PeoplePicker
              people={addable}
              chosen={chosen}
              onToggle={toggle}
              empty={t('chat.everybodyIsIn')}
            />
          </>
        )}

        {(add.isError || remove.isError) && (
          <p role="alert" className="text-destructive text-sm">
            {t('chat.membersFailed')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('chat.close')}
          </Button>
          {canModerate && (
            <Button
              type="button"
              disabled={chosen.length === 0 || add.isPending}
              onClick={() =>
                add.mutate(
                  { channelId: channel.id, userIds: chosen },
                  { onSuccess: () => setChosen([]) },
                )
              }
            >
              {t('chat.add')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
