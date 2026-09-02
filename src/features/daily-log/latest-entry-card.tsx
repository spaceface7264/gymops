import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGymScope } from '@/features/gyms'
import { useLatestLogEntry } from './queries'

/**
 * The home page's daily log block (P4-10): the last thing written here, which
 * on a shift handover is the one entry somebody arriving needs to have read.
 */
export function LatestLogEntryCard() {
  const { t, i18n } = useTranslation()
  const { gymId } = useGymScope()
  const latest = useLatestLogEntry(gymId)

  const entry = latest.data

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('home.dailyLog.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {latest.isPending && (
          <p className="text-muted-foreground text-sm">{t('dailyLog.loading')}</p>
        )}
        {latest.isError && (
          <p role="alert" className="text-destructive text-sm">
            {t('dailyLog.loadFailed')}
          </p>
        )}
        {latest.data === null && (
          <p className="text-muted-foreground text-sm">{t('home.dailyLog.empty')}</p>
        )}

        {entry && (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={entry.kind === 'issue' ? 'default' : 'outline'}>
                {t(`dailyLog.kind.${entry.kind}`)}
              </Badge>
              {gymId === null && entry.gyms && (
                <Badge variant="outline">{entry.gyms.name}</Badge>
              )}
              <span className="text-muted-foreground text-xs">
                {t('dailyLog.writtenBy', {
                  who: entry.author?.full_name ?? t('dailyLog.someone'),
                  when: new Date(entry.created_at).toLocaleString(i18n.language, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </span>
            </div>
            <p className="line-clamp-3 text-sm whitespace-pre-line">{entry.body}</p>
          </div>
        )}

        <Link to="/daily-log" className="text-sm underline">
          {t('home.dailyLog.wholeLog')}
        </Link>
      </CardContent>
    </Card>
  )
}
