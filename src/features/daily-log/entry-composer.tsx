import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MissingRequirements } from '@/features/content'
import { dailyLogKinds, parseTags, useCreateLogEntry, type DailyLogKind } from './queries'

/** Writing an entry: the kind, what happened, and the tags to find it by. */
export function EntryComposer({ gymId }: { gymId: string }) {
  const { t } = useTranslation()
  const fieldId = useId()
  const create = useCreateLogEntry()

  const [kind, setKind] = useState<DailyLogKind>('note')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')

  const missing = body.trim() === '' ? [t('dailyLog.needsBody')] : []

  return (
    <Card className="p-4">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate(
            { gymId, kind, body, tags: parseTags(tags) },
            {
              onSuccess: () => {
                setBody('')
                setTags('')
                setKind('note')
              },
            },
          )
        }}
      >
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${fieldId}-kind`}>{t('dailyLog.kindLabel')}</Label>
            <select
              id={`${fieldId}-kind`}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as DailyLogKind)}
            >
              {dailyLogKinds.map((option) => (
                <option key={option} value={option}>
                  {t(`dailyLog.kind.${option}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor={`${fieldId}-tags`}>{t('dailyLog.tags')}</Label>
            <Input
              id={`${fieldId}-tags`}
              value={tags}
              placeholder={t('dailyLog.tagsPlaceholder')}
              onChange={(event) => setTags(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${fieldId}-body`}>{t('dailyLog.entry')}</Label>
          <textarea
            id={`${fieldId}-body`}
            className="border-input bg-background min-h-20 w-full rounded-md border p-2 text-sm"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>

        <MissingRequirements reasons={missing} />

        {create.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('dailyLog.saveFailed')}
          </p>
        )}

        <Button type="submit" disabled={missing.length > 0 || create.isPending}>
          {t('dailyLog.add')}
        </Button>
      </form>
    </Card>
  )
}
