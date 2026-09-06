import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { personName } from './channel-name'
import type { Colleague } from './queries'

/**
 * The list of people a dialog picks from: search, then tick. Two dialogs need
 * it — starting a DM (P6-06) and seating somebody in a channel — and both are
 * picking from the same list, the one `profiles_select` shows.
 */
export function PeoplePicker({
  people,
  chosen,
  onToggle,
  empty,
}: {
  people: Colleague[]
  chosen: string[]
  onToggle: (id: string) => void
  empty: string
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const shown = people.filter((person) =>
    personName(person).toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div className="space-y-2">
      <Input
        type="search"
        value={query}
        aria-label={t('chat.findSomebody')}
        placeholder={t('chat.findSomebody')}
        onChange={(event) => setQuery(event.target.value)}
      />

      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {shown.map((person) => (
          <li key={person.id}>
            <label className="hover:bg-accent/60 flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm">
              <Checkbox
                checked={chosen.includes(person.id)}
                onCheckedChange={() => onToggle(person.id)}
              />
              <span className="min-w-0 flex-1 truncate">{personName(person)}</span>
            </label>
          </li>
        ))}
      </ul>

      {shown.length === 0 && <EmptyState title={empty} as="p" />}
    </div>
  )
}
