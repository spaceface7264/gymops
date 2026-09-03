import { useState } from 'react'
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
import { PeoplePicker } from './people-picker'
import { useColleagues, useStartDm } from './queries'

/**
 * Starting a conversation. Several people can be picked, because §2.2's DMs
 * are "2+ people", and the same set twice is the same channel — `start_dm()`
 * hands back the one that already exists rather than opening a second, so this
 * dialog never has to ask whether it is new.
 */
export function NewDmDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts the content when closed, so the picker starts empty
          every time and needs no effect to reset itself. */}
      <DialogContent>
        <NewDmForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function NewDmForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const colleagues = useColleagues()
  const start = useStartDm()

  const [chosen, setChosen] = useState<string[]>([])

  const toggle = (id: string) =>
    setChosen((already) =>
      already.includes(id) ? already.filter((one) => one !== id) : [...already, id],
    )

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (chosen.length === 0) return

    start.mutate(chosen, {
      onSuccess: (channelId) => {
        onDone()
        void navigate(`/chat/${channelId}`)
      },
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t('chat.newDm')}</DialogTitle>
        <DialogDescription>{t('chat.newDmHint')}</DialogDescription>
      </DialogHeader>

      <PeoplePicker
        people={colleagues.data ?? []}
        chosen={chosen}
        onToggle={toggle}
        empty={t('chat.noCandidates')}
      />

      {start.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('chat.newDmFailed')}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('chat.cancel')}
        </Button>
        <Button type="submit" disabled={chosen.length === 0 || start.isPending}>
          {t('chat.startDm')}
        </Button>
      </DialogFooter>
    </form>
  )
}
