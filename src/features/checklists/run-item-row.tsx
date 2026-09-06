import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth'
import { useSetRunItemNote, useToggleRunItem, type ChecklistRunItem } from './queries'

/** One line of a run: the tick, who made it, and the note that goes with it. */
export function RunItemRow({
  item,
  canComplete,
}: {
  item: ChecklistRunItem
  canComplete: boolean
}) {
  const { t, i18n } = useTranslation()
  const fieldId = useId()
  const { user } = useAuth()
  const toggle = useToggleRunItem()
  const setNote = useSetRunItemNote()

  // The note is edited locally and saved on blur, so a refetch mid-sentence
  // does not overwrite what is being typed. It follows the saved note again
  // once that actually changes — someone else's edit, or this one landing.
  const [note, setNote_] = useState(item.note ?? '')
  const [savedNote, setSavedNote] = useState(item.note)
  if (savedNote !== item.note) {
    setSavedNote(item.note)
    setNote_(item.note ?? '')
  }
  // A note is the exception, so the field costs a tap (P7M-05): it shows once
  // there is a note, or once somebody asks for one, and stays for the row's
  // lifetime after that.
  const [wantsNote, setWantsNote] = useState(false)
  const showNote = wantsNote || Boolean(item.note) || note !== ''

  const doneBy =
    item.done_by === user?.id ? t('checklists.byYou') : (item.profiles?.full_name ?? null)

  return (
    <div className="space-y-1.5">
      {/* The whole row is the target (DESIGN.md's Checkbox rule), not the 20 px box. */}
      <label htmlFor={`${fieldId}-done`} className="flex min-h-11 items-start gap-3 py-1">
        <Checkbox
          id={`${fieldId}-done`}
          className="mt-0.5"
          checked={Boolean(item.done_at)}
          disabled={!canComplete || toggle.isPending}
          onCheckedChange={(checked) =>
            toggle.mutate(
              { id: item.id, done: checked === true },
              { onError: () => toast.error(t('checklists.tickFailed')) },
            )
          }
        />
        <div className="space-y-0.5">
          <span className="block min-h-6 leading-6">{item.label}</span>
          {!item.required && (
            <p className="text-muted-foreground text-xs">{t('checklists.optional')}</p>
          )}
          {item.done_at && (
            <p className="text-muted-foreground text-xs">
              {doneBy
                ? t('checklists.doneByAt', {
                    who: doneBy,
                    when: new Date(item.done_at).toLocaleTimeString(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit',
                      hourCycle: 'h23',
                    }),
                  })
                : t('checklists.doneAt', {
                    when: new Date(item.done_at).toLocaleTimeString(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit',
                      hourCycle: 'h23',
                    }),
                  })}
            </p>
          )}
        </div>
      </label>

      {showNote ? (
        <div className="pl-8">
          <Input
            className="max-w-md"
            aria-label={t('checklists.noteOn', { label: item.label })}
            placeholder={t('checklists.notePlaceholder')}
            disabled={!canComplete}
            autoFocus={wantsNote && !item.note}
            value={note}
            onChange={(event) => setNote_(event.target.value)}
            onBlur={() => {
              if ((item.note ?? '') !== note)
                setNote.mutate(
                  { id: item.id, note },
                  { onError: () => toast.error(t('checklists.tickFailed')) },
                )
            }}
          />
        </div>
      ) : (
        canComplete && (
          <div className="pl-8">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-4"
              aria-label={t('checklists.addNoteOn', { label: item.label })}
              onClick={() => setWantsNote(true)}
            >
              {t('checklists.addNote')}
            </Button>
          </div>
        )
      )}
    </div>
  )
}
