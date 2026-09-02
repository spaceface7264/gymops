import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { useGymScope } from './gym-context'

const allGymsValue = 'all'

/**
 * The gym every screen is scoped to. A native select: one control, correct
 * keyboard and screen-reader behaviour, and it stays usable with a long gym
 * list on a phone.
 */
export function GymSwitcher() {
  const { t } = useTranslation()
  const { gymId, options, canSeeAllGyms, selectGym } = useGymScope()

  const only = options.length === 1 ? options[0] : undefined
  if (options.length === 0) return null
  // Nothing to switch between, so show the gym rather than a dead control.
  if (only && !canSeeAllGyms) {
    return <span className="text-sm font-medium">{only.name}</span>
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="gym-switcher" className="sr-only">
        {t('gym.label')}
      </Label>
      <select
        id="gym-switcher"
        aria-label={t('gym.label')}
        className="border-input bg-background h-9 max-w-44 rounded-md border px-2 text-sm"
        value={gymId ?? allGymsValue}
        onChange={(event) =>
          selectGym(event.target.value === allGymsValue ? null : event.target.value)
        }
      >
        {canSeeAllGyms && <option value={allGymsValue}>{t('gym.all')}</option>}
        {options.map((gym) => (
          <option key={gym.id} value={gym.id}>
            {gym.name}
          </option>
        ))}
      </select>
    </div>
  )
}
