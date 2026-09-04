import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePublishScope } from '@/features/content'
import { useCreateChannel, useUpdateChannel, type Channel } from './queries'

/** The value the scope select carries for a channel that belongs to no gym. */
const companyWide = 'company'

/**
 * Opening a custom channel, or renaming one. `channel` decides which.
 *
 * Creating asks for the scope and whether it is private; editing asks for
 * neither. Both are what the people in the channel joined — and moving one
 * into another gym would hand it to a different set of managers, which is not
 * a rename.
 */
export function ChannelDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel?: Channel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ChannelForm channel={channel} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ChannelForm({ channel, onDone }: { channel?: Channel; onDone: () => void }) {
  const { t } = useTranslation()
  const fieldId = useId()
  const navigate = useNavigate()
  const { publishableGyms, canPublishCompanyWide } = usePublishScope()
  const create = useCreateChannel()
  const update = useUpdateChannel()
  const save = channel ? update : create

  const [name, setName] = useState(channel?.name ?? '')
  const [description, setDescription] = useState(channel?.description ?? '')
  const [scope, setScope] = useState<string>(
    channel?.gym_id ??
      (canPublishCompanyWide ? companyWide : (publishableGyms[0]?.id ?? '')),
  )
  const [isPrivate, setIsPrivate] = useState(false)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

    const described = description.trim() || null

    if (channel) {
      update.mutate(
        { id: channel.id, name: name.trim(), description: described },
        {
          onSuccess: onDone,
        },
      )
      return
    }

    create.mutate(
      {
        name: name.trim(),
        description: described,
        gymId: scope === companyWide ? null : scope,
        isPrivate,
      },
      {
        onSuccess: (channelId) => {
          onDone()
          void navigate(`/chat/${channelId}`)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {channel ? t('chat.editChannel') : t('chat.newChannel')}
        </DialogTitle>
        <DialogDescription>
          {channel ? t('chat.editChannelHint') : t('chat.newChannelHint')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-name`}>{t('chat.channelName')}</Label>
        <Input
          id={`${fieldId}-name`}
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-description`}>{t('chat.channelDescription')}</Label>
        <Input
          id={`${fieldId}-description`}
          maxLength={200}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {!channel && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-scope`}>{t('chat.channelScope')}</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id={`${fieldId}-scope`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canPublishCompanyWide && (
                  <SelectItem value={companyWide}>{t('chat.companyWide')}</SelectItem>
                )}
                {publishableGyms.map((gym) => (
                  <SelectItem key={gym.id} value={gym.id}>
                    {gym.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex min-h-11 items-start gap-3 py-1 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={isPrivate}
              onCheckedChange={(checked) => setIsPrivate(checked === true)}
            />
            <span>
              {t('chat.channelPrivate')}
              <span className="text-muted-foreground block text-xs">
                {t('chat.channelPrivateHint')}
              </span>
            </span>
          </label>
        </>
      )}

      {save.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('chat.channelSaveFailed')}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('chat.cancel')}
        </Button>
        <Button type="submit" disabled={!name.trim() || save.isPending}>
          {channel ? t('chat.save') : t('chat.createChannel')}
        </Button>
      </DialogFooter>
    </form>
  )
}
