import { useTranslation } from 'react-i18next'
import {
  HomeEmpty,
  HomeRow,
  HomeRows,
  HomeSection,
  HomeSectionLink,
  LoadingState,
  StatusBadge,
} from '@/components'
import { useGymScope } from '@/features/gyms'
import { useLatestLogEntry } from './queries'

/**
 * The home page's daily log block (P4-10): the last thing written here, which
 * on a shift handover is the one entry somebody arriving needs to have read.
 */
export function LatestLogEntrySection() {
  const { t, i18n } = useTranslation()
  const { gymId } = useGymScope()
  const latest = useLatestLogEntry(gymId)

  const entry = latest.data

  return (
    <HomeSection
      title={t('home.dailyLog.title')}
      action={
        <HomeSectionLink to="/daily-log">{t('home.dailyLog.wholeLog')}</HomeSectionLink>
      }
    >
      {latest.isPending && <LoadingState rows={1} />}
      {latest.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t('dailyLog.loadFailed')}
        </p>
      )}
      {latest.data === null && <HomeEmpty>{t('home.dailyLog.empty')}</HomeEmpty>}

      {entry && (
        <HomeRows>
          <HomeRow
            to="/daily-log"
            badge={
              <StatusBadge tone={entry.kind === 'issue' ? 'warning' : 'neutral'}>
                {t(`dailyLog.kind.${entry.kind}`)}
              </StatusBadge>
            }
            meta={
              t('dailyLog.writtenBy', {
                who: entry.author?.full_name ?? t('dailyLog.someone'),
                when: new Date(entry.created_at).toLocaleString(i18n.language, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              }) + (gymId === null && entry.gyms ? ` · ${entry.gyms.name}` : '')
            }
          >
            {entry.body}
          </HomeRow>
        </HomeRows>
      )}
    </HomeSection>
  )
}
