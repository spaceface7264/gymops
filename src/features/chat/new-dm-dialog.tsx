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
import { Input } from '@/components/ui/input'
import { useDmCandidates, useStartDm, type DmCandidate } from './queries'

/** What a colleague is called in the picker, as in the composer's mentions. */
const candidateName = (person: DmCandidate) => person.full_name?.trim() || person.email

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
  const candidates = useDmCandidates()
  const start = useStartDm()

  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string[]>([])

  const people = (candidates.data ?? []).filter((person) =>
    candidateName(person).toLowerCase().includes(query.trim().toLowerCase()),
  )

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

      <Input
        type="search"
        value={query}
        aria-label={t('chat.findSomebody')}
        placeholder={t('chat.findSomebody')}
        onChange={(event) => setQuery(event.target.value)}
      />

      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {people.map((person) => (
          <li key={person.id}>
            <label className="hover:bg-accent/60 flex items-center gap-2 rounded-md px-2 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={chosen.includes(person.id)}
                onChange={() => toggle(person.id)}
              />
              <span className="min-w-0 flex-1 truncate">{candidateName(person)}</span>
            </label>
          </li>
        ))}
      </ul>

      {!candidates.isPending && people.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('chat.noCandidates')}</p>
      )}

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
